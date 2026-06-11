import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv } from "../lib/app";
import { createSession, deleteSession, hashPassword, verifyPassword } from "../lib/auth";
import { ApiError, badRequest, readBody, vStr } from "../lib/http";
import { SESSION_COOKIE, requireAuth } from "../middleware";

const auth = new Hono<AppEnv>();

auth.post("/login", async (c) => {
  const body = await readBody(c);
  const username = vStr(body, "username", { required: true, max: 100 })!;
  const password = vStr(body, "password", { required: true, max: 200 })!;

  const row = await c.env.DB.prepare(
    "SELECT id, school_id, role, username, password_hash, full_name, email, phone, is_active FROM users WHERE username = ?",
  )
    .bind(username.toLowerCase())
    .first<{ id: string; password_hash: string; is_active: number } & Record<string, unknown>>();

  const valid = row ? await verifyPassword(password, row.password_hash) : false;
  if (!row || !valid || !row.is_active) {
    throw new ApiError(401, "اسم المستخدم أو كلمة المرور غير صحيحة");
  }

  const { token, expiresAt } = await createSession(c.env.DB, row.id);
  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });

  const { password_hash: _ph, ...user } = row;
  return c.json({ user });
});

auth.post("/logout", requireAuth, async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await deleteSession(c.env.DB, token);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

auth.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  let profile: Record<string, unknown> | null = null;
  if (user.role === "student") {
    profile = await c.env.DB.prepare(
      `SELECT s.id AS student_id, s.class_id, s.student_number, s.status, c.name AS class_name
       FROM students s LEFT JOIN classes c ON c.id = s.class_id WHERE s.user_id = ?`,
    )
      .bind(user.id)
      .first();
  } else if (user.role === "teacher") {
    profile = await c.env.DB.prepare("SELECT id AS teacher_id, specialization, resource_url FROM teachers WHERE user_id = ?")
      .bind(user.id)
      .first();
  }
  return c.json({ user, profile });
});

// Update own contact info / password
auth.patch("/me", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await readBody(c);
  const email = vStr(body, "email", { max: 200 });
  const phone = vStr(body, "phone", { max: 30 });
  const newPassword = vStr(body, "new_password", { max: 200 });

  if (newPassword) {
    if (newPassword.length < 8) throw badRequest("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل");
    const current = vStr(body, "current_password", { required: true, max: 200 })!;
    const row = await c.env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(user.id).first<{ password_hash: string }>();
    if (!row || !(await verifyPassword(current, row.password_hash))) {
      throw badRequest("كلمة المرور الحالية غير صحيحة");
    }
    const hash = await hashPassword(newPassword);
    await c.env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").bind(hash, user.id).run();
  }

  await c.env.DB.prepare("UPDATE users SET email = ?, phone = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(email ?? user.email, phone ?? user.phone, user.id)
    .run();

  return c.json({ ok: true });
});

export default auth;
