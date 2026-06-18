import { Hono } from "hono";
import type { AppEnv } from "../lib/app";
import { badRequest, notFound, paginated, pagination, readBody, uid, vStr, vUrl } from "../lib/http";
import { buildCredentialUpdates, hashPassword } from "../lib/auth";
import { requireRole } from "../middleware";

const adminOnly = requireRole("super_admin", "school_admin");

const teachers = new Hono<AppEnv>();

teachers.get("/", adminOnly, async (c) => {
  const { page, perPage, offset } = pagination(c);
  const conds: string[] = [];
  const vals: unknown[] = [];
  const q = c.req.query("q")?.trim();
  if (q) {
    conds.push("(u.full_name LIKE ? OR t.specialization LIKE ?)");
    vals.push(`%${q}%`, `%${q}%`);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM teachers t JOIN users u ON u.id = t.user_id ${where}`)
    .bind(...vals)
    .first<{ n: number }>();
  const { results } = await c.env.DB.prepare(
    `SELECT t.id, t.user_id, t.specialization, t.resource_url, u.full_name, u.username, u.phone, u.email, u.is_active
     FROM teachers t JOIN users u ON u.id = t.user_id ${where} ORDER BY u.full_name LIMIT ? OFFSET ?`,
  )
    .bind(...vals, perPage, offset)
    .all();
  return c.json(paginated(results, countRow?.n ?? 0, page, perPage));
});

teachers.post("/", adminOnly, async (c) => {
  const body = await readBody(c);
  const username = vStr(body, "username", { required: true, max: 100 })!.toLowerCase();
  const password = vStr(body, "password", { required: true, max: 200 })!;
  if (password.length < 8) throw badRequest("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
  const fullName = vStr(body, "full_name", { required: true, max: 200 })!;

  const exists = await c.env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
  if (exists) throw badRequest("اسم المستخدم مستخدم مسبقاً");
  const schoolRow = await c.env.DB.prepare("SELECT id FROM schools LIMIT 1").first<{ id: string }>();
  if (!schoolRow) throw notFound();

  const userId = uid();
  const teacherId = uid();
  const hash = await hashPassword(password);
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO users (id, school_id, role, username, password_hash, full_name, email, phone) VALUES (?,?,?,?,?,?,?,?)").bind(
      userId,
      schoolRow.id,
      "teacher",
      username,
      hash,
      fullName,
      vStr(body, "email", { max: 200 }),
      vStr(body, "phone", { max: 30 }),
    ),
    c.env.DB.prepare("INSERT INTO teachers (id, user_id, school_id, specialization, resource_url) VALUES (?,?,?,?,?)").bind(
      teacherId,
      userId,
      schoolRow.id,
      vStr(body, "specialization", { max: 100 }),
      vUrl(body, "resource_url"),
    ),
  ]);
  return c.json({ id: teacherId }, 201);
});

teachers.get("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT t.id, t.user_id, t.specialization, t.resource_url, u.full_name, u.username, u.phone, u.email, u.is_active
     FROM teachers t JOIN users u ON u.id = t.user_id WHERE t.id = ?`,
  )
    .bind(id)
    .first();
  if (!row) throw notFound();
  const { results: assignments } = await c.env.DB.prepare(
    `SELECT tcs.id, tcs.teacher_id, tcs.class_id, tcs.subject_id, c.name AS class_name, s.name AS subject_name
     FROM teacher_class_subjects tcs
     JOIN classes c ON c.id = tcs.class_id
     JOIN subjects s ON s.id = tcs.subject_id
     WHERE tcs.teacher_id = ? ORDER BY c.name, s.name`,
  )
    .bind(id)
    .all();
  return c.json({ teacher: row, assignments });
});

teachers.patch("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const body = await readBody(c);
  const teacher = await c.env.DB.prepare("SELECT user_id FROM teachers WHERE id = ?").bind(id).first<{ user_id: string }>();
  if (!teacher) throw notFound();

  const resourceUrl = "resource_url" in body ? vUrl(body, "resource_url") : undefined;
  await c.env.DB.prepare(
    `UPDATE teachers SET specialization = COALESCE(?, specialization),
     resource_url = CASE WHEN ? THEN ? ELSE resource_url END, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(vStr(body, "specialization", { max: 100 }), resourceUrl !== undefined ? 1 : 0, resourceUrl ?? null, id)
    .run();

  await c.env.DB.prepare(
    `UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email), phone = COALESCE(?, phone),
     is_active = COALESCE(?, is_active), updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(
      vStr(body, "full_name", { max: 200 }),
      vStr(body, "email", { max: 200 }),
      vStr(body, "phone", { max: 30 }),
      "is_active" in body ? (body.is_active ? 1 : 0) : null,
      teacher.user_id,
    )
    .run();

  const credStmts = await buildCredentialUpdates(c.env.DB, teacher.user_id, body);
  if (credStmts.length) await c.env.DB.batch(credStmts);

  return c.json({ ok: true });
});

// Deactivate (soft delete)
teachers.delete("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const teacher = await c.env.DB.prepare("SELECT user_id FROM teachers WHERE id = ?").bind(id).first<{ user_id: string }>();
  if (!teacher) throw notFound();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?").bind(teacher.user_id),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(teacher.user_id),
  ]);
  return c.json({ ok: true });
});

// ---- class/subject assignments ----
teachers.post("/:id/assignments", adminOnly, async (c) => {
  const teacherId = c.req.param("id");
  const body = await readBody(c);
  const classId = vStr(body, "class_id", { required: true })!;
  const subjectId = vStr(body, "subject_id", { required: true })!;
  const teacher = await c.env.DB.prepare("SELECT id FROM teachers WHERE id = ?").bind(teacherId).first();
  if (!teacher) throw notFound();
  const dup = await c.env.DB.prepare("SELECT id FROM teacher_class_subjects WHERE teacher_id = ? AND class_id = ? AND subject_id = ?")
    .bind(teacherId, classId, subjectId)
    .first();
  if (dup) throw badRequest("هذا الإسناد موجود مسبقاً");
  const id = uid();
  await c.env.DB.prepare("INSERT INTO teacher_class_subjects (id, teacher_id, class_id, subject_id) VALUES (?,?,?,?)")
    .bind(id, teacherId, classId, subjectId)
    .run();
  return c.json({ id }, 201);
});

teachers.delete("/:id/assignments/:assignmentId", adminOnly, async (c) => {
  const res = await c.env.DB.prepare("DELETE FROM teacher_class_subjects WHERE id = ? AND teacher_id = ?")
    .bind(c.req.param("assignmentId"), c.req.param("id"))
    .run();
  if (!res.meta.changes) throw notFound();
  return c.json({ ok: true });
});

export default teachers;

// ---- parents (users with role 'parent') ----
export const parents = new Hono<AppEnv>();

parents.get("/", adminOnly, async (c) => {
  const { page, perPage, offset } = pagination(c);
  const q = c.req.query("q")?.trim();
  const where = q ? "AND (full_name LIKE ? OR username LIKE ?)" : "";
  const vals = q ? [`%${q}%`, `%${q}%`] : [];
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'parent' ${where}`)
    .bind(...vals)
    .first<{ n: number }>();
  const { results } = await c.env.DB.prepare(
    `SELECT id, username, full_name, email, phone, is_active,
            (SELECT COUNT(*) FROM student_parent_links l WHERE l.parent_user_id = users.id) AS children_count
     FROM users WHERE role = 'parent' ${where} ORDER BY full_name LIMIT ? OFFSET ?`,
  )
    .bind(...vals, perPage, offset)
    .all();
  return c.json(paginated(results, countRow?.n ?? 0, page, perPage));
});

parents.post("/", adminOnly, async (c) => {
  const body = await readBody(c);
  const username = vStr(body, "username", { required: true, max: 100 })!.toLowerCase();
  const password = vStr(body, "password", { required: true, max: 200 })!;
  if (password.length < 8) throw badRequest("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
  const exists = await c.env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
  if (exists) throw badRequest("اسم المستخدم مستخدم مسبقاً");
  const schoolRow = await c.env.DB.prepare("SELECT id FROM schools LIMIT 1").first<{ id: string }>();
  if (!schoolRow) throw notFound();
  const id = uid();
  await c.env.DB.prepare("INSERT INTO users (id, school_id, role, username, password_hash, full_name, email, phone) VALUES (?,?,?,?,?,?,?,?)")
    .bind(
      id,
      schoolRow.id,
      "parent",
      username,
      await hashPassword(password),
      vStr(body, "full_name", { required: true, max: 200 }),
      vStr(body, "email", { max: 200 }),
      vStr(body, "phone", { max: 30 }),
    )
    .run();
  return c.json({ id }, 201);
});

parents.get("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const parent = await c.env.DB.prepare(
    "SELECT id, username, full_name, email, phone, is_active FROM users WHERE id = ? AND role = 'parent'",
  )
    .bind(id)
    .first();
  if (!parent) throw notFound();
  const { results: children } = await c.env.DB.prepare(
    `SELECT l.id AS link_id, l.relationship, s.id AS student_id, u.full_name AS student_name,
            s.status, c.name AS class_name
     FROM student_parent_links l
     JOIN students s ON s.id = l.student_id
     JOIN users u ON u.id = s.user_id
     LEFT JOIN classes c ON c.id = s.class_id
     WHERE l.parent_user_id = ? ORDER BY u.full_name`,
  )
    .bind(id)
    .all();
  return c.json({ parent, children });
});

parents.patch("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const parent = await c.env.DB.prepare("SELECT id FROM users WHERE id = ? AND role = 'parent'").bind(id).first();
  if (!parent) throw notFound();
  const body = await readBody(c);
  await c.env.DB.prepare(
    `UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email), phone = COALESCE(?, phone),
     is_active = COALESCE(?, is_active), updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(
      vStr(body, "full_name", { max: 200 }),
      vStr(body, "email", { max: 200 }),
      vStr(body, "phone", { max: 30 }),
      "is_active" in body ? (body.is_active ? 1 : 0) : null,
      id,
    )
    .run();
  // If deactivated, drop active sessions so the parent can't keep browsing.
  if ("is_active" in body && !body.is_active) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  }

  const credStmts = await buildCredentialUpdates(c.env.DB, id, body);
  if (credStmts.length) await c.env.DB.batch(credStmts);

  return c.json({ ok: true });
});
