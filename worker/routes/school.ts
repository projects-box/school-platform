import { Hono } from "hono";
import type { AppEnv } from "../lib/app";
import { notFound, readBody, uid, vDate, vNum, vStr, vUrl } from "../lib/http";
import { requireRole } from "../middleware";

const adminOnly = requireRole("super_admin", "school_admin");

// ---- school profile ----
export const school = new Hono<AppEnv>();

school.get("/", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT id, name, address, phone, email, website_url, general_timetable_url FROM schools LIMIT 1",
  ).first();
  if (!row) throw notFound();
  const year = await c.env.DB.prepare(
    "SELECT id, name, start_date, end_date, is_current FROM academic_years WHERE is_current = 1 LIMIT 1",
  ).first();
  const term = await c.env.DB.prepare(
    "SELECT id, academic_year_id, name, start_date, end_date, is_current FROM terms WHERE is_current = 1 LIMIT 1",
  ).first();
  return c.json({ school: row, current_year: year, current_term: term });
});

school.patch("/", adminOnly, async (c) => {
  const body = await readBody(c);
  const existing = await c.env.DB.prepare("SELECT id FROM schools LIMIT 1").first<{ id: string }>();
  if (!existing) throw notFound();
  const fields = {
    name: vStr(body, "name", { max: 200 }),
    address: vStr(body, "address", { max: 300 }),
    phone: vStr(body, "phone", { max: 30 }),
    email: vStr(body, "email", { max: 200 }),
    website_url: vUrl(body, "website_url"),
    general_timetable_url: vUrl(body, "general_timetable_url"),
  };
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (k in body) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (sets.length) {
    await c.env.DB.prepare(`UPDATE schools SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...vals, existing.id)
      .run();
  }
  return c.json({ ok: true });
});

// ---- academic years & terms ----
export const years = new Hono<AppEnv>();

years.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, start_date, end_date, is_current FROM academic_years ORDER BY name DESC",
  ).all();
  return c.json({ items: results });
});

years.post("/", adminOnly, async (c) => {
  const body = await readBody(c);
  const schoolRow = await c.env.DB.prepare("SELECT id FROM schools LIMIT 1").first<{ id: string }>();
  if (!schoolRow) throw notFound();
  const id = uid();
  const isCurrent = body.is_current ? 1 : 0;
  if (isCurrent) await c.env.DB.prepare("UPDATE academic_years SET is_current = 0").run();
  await c.env.DB.prepare(
    "INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_current) VALUES (?,?,?,?,?,?)",
  )
    .bind(id, schoolRow.id, vStr(body, "name", { required: true, max: 50 }), vDate(body, "start_date"), vDate(body, "end_date"), isCurrent)
    .run();
  return c.json({ id }, 201);
});

years.patch("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const body = await readBody(c);
  if (body.is_current) await c.env.DB.prepare("UPDATE academic_years SET is_current = 0").run();
  const res = await c.env.DB.prepare(
    `UPDATE academic_years SET name = COALESCE(?, name), start_date = COALESCE(?, start_date),
     end_date = COALESCE(?, end_date), is_current = COALESCE(?, is_current), updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(vStr(body, "name", { max: 50 }), vDate(body, "start_date"), vDate(body, "end_date"), "is_current" in body ? (body.is_current ? 1 : 0) : null, id)
    .run();
  if (!res.meta.changes) throw notFound();
  return c.json({ ok: true });
});

years.delete("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const used = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM terms WHERE academic_year_id = ?").bind(id).first<{ n: number }>();
  if (used && used.n > 0) {
    return c.json({ error: "لا يمكن حذف السنة الدراسية لوجود فصول دراسية مرتبطة بها — احذف الفصول أولاً" }, 409);
  }
  const res = await c.env.DB.prepare("DELETE FROM academic_years WHERE id = ?").bind(id).run();
  if (!res.meta.changes) throw notFound();
  return c.json({ ok: true });
});

export const terms = new Hono<AppEnv>();

terms.get("/", async (c) => {
  const yearId = c.req.query("academic_year_id");
  const sql = yearId
    ? "SELECT id, academic_year_id, name, start_date, end_date, is_current FROM terms WHERE academic_year_id = ? ORDER BY start_date"
    : "SELECT id, academic_year_id, name, start_date, end_date, is_current FROM terms ORDER BY start_date";
  const stmt = yearId ? c.env.DB.prepare(sql).bind(yearId) : c.env.DB.prepare(sql);
  const { results } = await stmt.all();
  return c.json({ items: results });
});

terms.post("/", adminOnly, async (c) => {
  const body = await readBody(c);
  const id = uid();
  const isCurrent = body.is_current ? 1 : 0;
  if (isCurrent) await c.env.DB.prepare("UPDATE terms SET is_current = 0").run();
  await c.env.DB.prepare("INSERT INTO terms (id, academic_year_id, name, start_date, end_date, is_current) VALUES (?,?,?,?,?,?)")
    .bind(
      id,
      vStr(body, "academic_year_id", { required: true })!,
      vStr(body, "name", { required: true, max: 80 }),
      vDate(body, "start_date"),
      vDate(body, "end_date"),
      isCurrent,
    )
    .run();
  return c.json({ id }, 201);
});

terms.patch("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const body = await readBody(c);
  if (body.is_current) await c.env.DB.prepare("UPDATE terms SET is_current = 0").run();
  const res = await c.env.DB.prepare(
    `UPDATE terms SET name = COALESCE(?, name), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
     is_current = COALESCE(?, is_current), updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(vStr(body, "name", { max: 80 }), vDate(body, "start_date"), vDate(body, "end_date"), "is_current" in body ? (body.is_current ? 1 : 0) : null, id)
    .run();
  if (!res.meta.changes) throw notFound();
  return c.json({ ok: true });
});

terms.delete("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const used = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM exams WHERE term_id = ?").bind(id).first<{ n: number }>();
  if (used && used.n > 0) {
    return c.json({ error: "لا يمكن حذف الفصل الدراسي لوجود اختبارات مرتبطة به" }, 409);
  }
  const res = await c.env.DB.prepare("DELETE FROM terms WHERE id = ?").bind(id).run();
  if (!res.meta.changes) throw notFound();
  return c.json({ ok: true });
});

// ---- grade levels ----
export const grades = new Hono<AppEnv>();

grades.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.level, g.timetable_url, COUNT(cl.id) AS classes_count
     FROM grades g LEFT JOIN classes cl ON cl.grade_id = g.id
     GROUP BY g.id ORDER BY g.level`,
  ).all();
  return c.json({ items: results });
});

grades.post("/", adminOnly, async (c) => {
  const body = await readBody(c);
  const schoolRow = await c.env.DB.prepare("SELECT id FROM schools LIMIT 1").first<{ id: string }>();
  if (!schoolRow) throw notFound();
  const id = uid();
  await c.env.DB.prepare("INSERT INTO grades (id, school_id, name, level, timetable_url) VALUES (?,?,?,?,?)")
    .bind(id, schoolRow.id, vStr(body, "name", { required: true, max: 80 }), vNum(body, "level", { min: 0, max: 20 }) ?? 0, vUrl(body, "timetable_url"))
    .run();
  return c.json({ id }, 201);
});

grades.patch("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const body = await readBody(c);
  const timetable = "timetable_url" in body ? vUrl(body, "timetable_url") : undefined;
  const res = await c.env.DB.prepare(
    `UPDATE grades SET name = COALESCE(?, name), level = COALESCE(?, level),
     timetable_url = CASE WHEN ? THEN ? ELSE timetable_url END, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(vStr(body, "name", { max: 80 }), vNum(body, "level", { min: 0, max: 20 }), timetable !== undefined ? 1 : 0, timetable ?? null, id)
    .run();
  if (!res.meta.changes) throw notFound();
  return c.json({ ok: true });
});

grades.delete("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const used = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM classes WHERE grade_id = ?").bind(id).first<{ n: number }>();
  if (used && used.n > 0) {
    return c.json({ error: "لا يمكن حذف المرحلة لوجود فصول مرتبطة بها" }, 409);
  }
  const res = await c.env.DB.prepare("DELETE FROM grades WHERE id = ?").bind(id).run();
  if (!res.meta.changes) throw notFound();
  return c.json({ ok: true });
});
