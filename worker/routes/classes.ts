import { Hono } from "hono";
import type { AppEnv } from "../lib/app";
import { inPlaceholders, visibleClassIds } from "../lib/app";
import { notFound, readBody, uid, vStr, vUrl } from "../lib/http";
import { requireRole } from "../middleware";

const adminOnly = requireRole("super_admin", "school_admin");

export const classes = new Hono<AppEnv>();

// Admin sees all classes; teacher/student/parent only the classes relevant to them.
classes.get("/", async (c) => {
  const conds: string[] = [];
  const vals: unknown[] = [];
  const allowed = await visibleClassIds(c);
  if (allowed !== null) {
    if (!allowed.length) return c.json({ items: [] });
    conds.push(`cl.id IN ${inPlaceholders(allowed.length)}`);
    vals.push(...allowed);
  }
  const gradeId = c.req.query("grade_id");
  if (gradeId) {
    conds.push("cl.grade_id = ?");
    vals.push(gradeId);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(
    `SELECT cl.id, cl.grade_id, cl.name, cl.timetable_url, cl.is_active, g.name AS grade_name,
            (SELECT COUNT(*) FROM students s WHERE s.class_id = cl.id AND s.status = 'active') AS students_count
     FROM classes cl JOIN grades g ON g.id = cl.grade_id ${where}
     ORDER BY g.level, cl.name`,
  )
    .bind(...vals)
    .all();
  return c.json({ items: results });
});

classes.get("/:id", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT cl.id, cl.grade_id, cl.name, cl.timetable_url, cl.is_active, g.name AS grade_name,
            (SELECT COUNT(*) FROM students s WHERE s.class_id = cl.id AND s.status = 'active') AS students_count
     FROM classes cl JOIN grades g ON g.id = cl.grade_id WHERE cl.id = ?`,
  )
    .bind(c.req.param("id"))
    .first();
  if (!row) throw notFound();
  const { results: teachers } = await c.env.DB.prepare(
    `SELECT t.id AS teacher_id, u.full_name AS teacher_name, sub.name AS subject_name, tcs.id, tcs.subject_id, tcs.class_id
     FROM teacher_class_subjects tcs
     JOIN teachers t ON t.id = tcs.teacher_id
     JOIN users u ON u.id = t.user_id
     JOIN subjects sub ON sub.id = tcs.subject_id
     WHERE tcs.class_id = ? ORDER BY sub.name`,
  )
    .bind(c.req.param("id"))
    .all();
  return c.json({ class: row, teachers });
});

classes.post("/", adminOnly, async (c) => {
  const body = await readBody(c);
  const schoolRow = await c.env.DB.prepare("SELECT id FROM schools LIMIT 1").first<{ id: string }>();
  if (!schoolRow) throw notFound();
  const id = uid();
  await c.env.DB.prepare("INSERT INTO classes (id, school_id, grade_id, name, timetable_url) VALUES (?,?,?,?,?)")
    .bind(id, schoolRow.id, vStr(body, "grade_id", { required: true })!, vStr(body, "name", { required: true, max: 80 }), vUrl(body, "timetable_url"))
    .run();
  return c.json({ id }, 201);
});

classes.patch("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const body = await readBody(c);
  const timetable = "timetable_url" in body ? vUrl(body, "timetable_url") : undefined;
  const res = await c.env.DB.prepare(
    `UPDATE classes SET name = COALESCE(?, name), grade_id = COALESCE(?, grade_id),
     is_active = COALESCE(?, is_active),
     timetable_url = CASE WHEN ? THEN ? ELSE timetable_url END,
     updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(
      vStr(body, "name", { max: 80 }),
      vStr(body, "grade_id"),
      "is_active" in body ? (body.is_active ? 1 : 0) : null,
      timetable !== undefined ? 1 : 0,
      timetable ?? null,
      id,
    )
    .run();
  if (!res.meta.changes) throw notFound();
  return c.json({ ok: true });
});

classes.delete("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const used = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM students WHERE class_id = ?").bind(id).first<{ n: number }>();
  if (used && used.n > 0) {
    return c.json({ error: "لا يمكن حذف الفصل لوجود طلاب مسجلين فيه" }, 409);
  }
  const res = await c.env.DB.prepare("DELETE FROM classes WHERE id = ?").bind(id).run();
  if (!res.meta.changes) throw notFound();
  return c.json({ ok: true });
});

export const subjects = new Hono<AppEnv>();

subjects.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, name, code FROM subjects ORDER BY name").all();
  return c.json({ items: results });
});

subjects.post("/", adminOnly, async (c) => {
  const body = await readBody(c);
  const schoolRow = await c.env.DB.prepare("SELECT id FROM schools LIMIT 1").first<{ id: string }>();
  if (!schoolRow) throw notFound();
  const id = uid();
  await c.env.DB.prepare("INSERT INTO subjects (id, school_id, name, code) VALUES (?,?,?,?)")
    .bind(id, schoolRow.id, vStr(body, "name", { required: true, max: 100 }), vStr(body, "code", { max: 20 }))
    .run();
  return c.json({ id }, 201);
});

subjects.patch("/:id", adminOnly, async (c) => {
  const body = await readBody(c);
  const res = await c.env.DB.prepare(
    "UPDATE subjects SET name = COALESCE(?, name), code = COALESCE(?, code), updated_at = datetime('now') WHERE id = ?",
  )
    .bind(vStr(body, "name", { max: 100 }), vStr(body, "code", { max: 20 }), c.req.param("id"))
    .run();
  if (!res.meta.changes) throw notFound();
  return c.json({ ok: true });
});

subjects.delete("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const used = await c.env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM teacher_class_subjects WHERE subject_id = ?) + (SELECT COUNT(*) FROM exams WHERE subject_id = ?) AS n",
  )
    .bind(id, id)
    .first<{ n: number }>();
  if (used && used.n > 0) {
    return c.json({ error: "لا يمكن حذف المادة لوجود بيانات مرتبطة بها" }, 409);
  }
  const res = await c.env.DB.prepare("DELETE FROM subjects WHERE id = ?").bind(id).run();
  if (!res.meta.changes) throw notFound();
  return c.json({ ok: true });
});
