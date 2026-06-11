import type { SafeUser } from "../../shared/types";

const PBKDF2_ITERATIONS = 100_000;
const SESSION_DAYS = 7;

const enc = new TextEncoder();

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toBase64(salt)}:${toBase64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  if (!iterations || iterations > 1_000_000) return false;
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const bits = new Uint8Array(await deriveBits(password, salt, iterations));
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(db: D1Database, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...tokenBytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const id = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(id, userId, expiresAt.toISOString())
    .run();
  return { token, expiresAt };
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  const id = await sha256Hex(token);
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
}

export async function getUserBySessionToken(db: D1Database, token: string): Promise<SafeUser | null> {
  const id = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT u.id, u.school_id, u.role, u.username, u.full_name, u.email, u.phone, u.is_active, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .bind(id)
    .first<SafeUser & { expires_at: string }>();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now() || !row.is_active) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
    return null;
  }
  const { expires_at: _ignored, ...user } = row;
  return user;
}
