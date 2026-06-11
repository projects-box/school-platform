import { Hono } from "hono";
import type { AppEnv } from "../lib/app";
import { inPlaceholders, isAdmin, teacherScope, visibleClassIds } from "../lib/app";
import { forbidden, notFound, paginated, pagination, readBody, uid, vStr, vUrl } from "../lib/http";

const announcements = new Hono<AppEnv>();

// General announcements + class announcements relevant to the current user.
announcements.get("/", async (c) => {
  const { page, perPage, offset } = pagination(c);
  const allowed = await visibleClassIds(c);

  let where: string;
  const vals: unknown[] = [];
  if (allowed === null) {
    where = "";
  } else if (allowed.length) {
    where = `WHERE (a.class_id IS NULL OR a.class_id IN ${inPlaceholders(allowed.length)})`;
    vals.push(...allowed);
  } else {
    where = "WHERE a.class_id IS NULL";
  }

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM announcements a ${where}`).bind(...vals).first<{ n: number }>();
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.class_id, a.title, a.body, a.attachment_url, a.created_by, a.created_at,
            c2.name AS class_name, u.full_name AS author_name
     FROM announcements a
     LEFT JOIN classes c2 ON c2.id = a.class_id
     LEFT JOIN users u ON u.id = a.created_by
     ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...vals, perPage, offset)
    .all();
  return c.json(paginated(results, countRow?.n ?? 0, page, perPage));
});

// Admin: general or any class. Teacher: only assigned classes.
announcements.post("/", async (c) => {
  const user = c.get("user");
  const body = await readBody(c);
  const classId = vStr(body, "class_id");

  if (isAdmin(c)) {
    // ok
  } else if (user.role === "teacher") {
    if (!classId) throw forbidden();
    const scope = await teacherScope(c);
    if (!scope.classIds.includes(classId)) throw forbidden();
  } else {
    throw forbidden();
  }

  const schoolRow = await c.env.DB.prepare("SELECT id FROM schools LIMIT 1").first<{ id: string }>();
  if (!schoolRow) throw notFound();
  const id = uid();
  await c.env.DB.prepare(
    "INSERT INTO announcements (id, school_id, class_id, title, body, attachment_url, created_by) VALUES (?,?,?,?,?,?,?)",
  )
    .bind(
      id,
      schoolRow.id,
      classId,
      vStr(body, "title", { required: true, max: 200 }),
      vStr(body, "body", { max: 4000 }),
      vUrl(body, "attachment_url"),
      user.id,
    )
    .run();
  return c.json({ id }, 201);
});

announcements.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const row = await c.env.DB.prepare("SELECT created_by FROM announcements WHERE id = ?").bind(id).first<{ created_by: string | null }>();
  if (!row) throw notFound();
  if (!isAdmin(c) && row.created_by !== user.id) throw forbidden();
  const body = await readBody(c);
  const attachment = "attachment_url" in body ? vUrl(body, "attachment_url") : undefined;
  await c.env.DB.prepare(
    `UPDATE announcements SET title = COALESCE(?, title), body = COALESCE(?, body),
     attachment_url = CASE WHEN ? THEN ? ELSE attachment_url END, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(vStr(body, "title", { max: 200 }), vStr(body, "body", { max: 4000 }), attachment !== undefined ? 1 : 0, attachment ?? null, id)
    .run();
  return c.json({ ok: true });
});

announcements.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const row = await c.env.DB.prepare("SELECT created_by FROM announcements WHERE id = ?").bind(id).first<{ created_by: string | null }>();
  if (!row) throw notFound();
  if (!isAdmin(c) && row.created_by !== user.id) throw forbidden();
  await c.env.DB.prepare("DELETE FROM announcements WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

export default announcements;
