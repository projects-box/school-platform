import { Hono } from "hono";
import type { AppEnv } from "../lib/app";
import { assertCanViewStudent, inPlaceholders, isAdmin, teacherScope } from "../lib/app";
import { badRequest, forbidden, notFound, paginated, pagination, readBody, uid, vDate, vEnum, vStr, vUrl } from "../lib/http";
import { hashPassword } from "../lib/auth";
import { requireRole } from "../middleware";

const adminOnly = requireRole("super_admin", "school_admin");

const students = new Hono<AppEnv>();

const STUDENT_SELECT = `
  SELECT s.id, s.user_id, s.class_id, s.student_number, s.date_of_birth, s.gender, s.address,
         s.document_url, s.status, u.full_name, u.username, c.name AS class_name, g.name AS grade_name
  FROM students s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN classes c ON c.id = s.class_id
  LEFT JOIN grades g ON g.id = c.grade_id`;

// List students. Admin: all (filterable). Teacher: students of assigned classes only.
students.get("/", async (c) => {
  const user = c.get("user");
  const { page, perPage, offset } = pagination(c);
  const conds: string[] = [];
  const vals: unknown[] = [];

  if (isAdmin(c)) {
    // no base restriction
  } else if (user.role === "teacher") {
    const scope = await teacherScope(c);
    if (!scope.classIds.length) return c.json(paginated([], 0, page, perPage));
    conds.push(`s.class_id IN ${inPlaceholders(scope.classIds.length)}`);
    vals.push(...scope.classIds);
  } else {
    throw forbidden();
  }

  const classId = c.req.query("class_id");
  if (classId) {
    conds.push("s.class_id = ?");
    vals.push(classId);
  }
  const status = c.req.query("status");
  if (status && ["active", "inactive", "graduated"].includes(status)) {
    conds.push("s.status = ?");
    vals.push(status);
  }
  const q = c.req.query("q")?.trim();
  if (q) {
    conds.push("(u.full_name LIKE ? OR s.student_number LIKE ?)");
    vals.push(`%${q}%`, `%${q}%`);
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM students s JOIN users u ON u.id = s.user_id ${where}`)
    .bind(...vals)
    .first<{ n: number }>();
  const { results } = await c.env.DB.prepare(`${STUDENT_SELECT} ${where} ORDER BY u.full_name LIMIT ? OFFSET ?`)
    .bind(...vals, perPage, offset)
    .all();
  return c.json(paginated(results, countRow?.n ?? 0, page, perPage));
});

students.post("/", adminOnly, async (c) => {
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
  const studentId = uid();
  const hash = await hashPassword(password);
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO users (id, school_id, role, username, password_hash, full_name, email, phone) VALUES (?,?,?,?,?,?,?,?)").bind(
      userId,
      schoolRow.id,
      "student",
      username,
      hash,
      fullName,
      vStr(body, "email", { max: 200 }),
      vStr(body, "phone", { max: 30 }),
    ),
    c.env.DB.prepare(
      "INSERT INTO students (id, user_id, school_id, class_id, student_number, date_of_birth, gender, address, document_url, status) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ).bind(
      studentId,
      userId,
      schoolRow.id,
      vStr(body, "class_id"),
      vStr(body, "student_number", { max: 30 }),
      vDate(body, "date_of_birth"),
      vEnum(body, "gender", ["male", "female"] as const),
      vStr(body, "address", { max: 300 }),
      vUrl(body, "document_url"),
      vEnum(body, "status", ["active", "inactive", "graduated"] as const) ?? "active",
    ),
  ]);
  return c.json({ id: studentId }, 201);
});

students.get("/:id", async (c) => {
  const id = c.req.param("id");
  await assertCanViewStudent(c, id);
  const row = await c.env.DB.prepare(`${STUDENT_SELECT} WHERE s.id = ?`).bind(id).first();
  if (!row) throw notFound();
  const { results: parents } = await c.env.DB.prepare(
    `SELECT l.id, l.student_id, l.parent_user_id, l.relationship, u.full_name AS parent_name, u.phone AS parent_phone
     FROM student_parent_links l JOIN users u ON u.id = l.parent_user_id WHERE l.student_id = ?`,
  )
    .bind(id)
    .all();
  return c.json({ student: row, parents });
});

students.patch("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const body = await readBody(c);
  const student = await c.env.DB.prepare("SELECT user_id FROM students WHERE id = ?").bind(id).first<{ user_id: string }>();
  if (!student) throw notFound();

  const docUrl = "document_url" in body ? vUrl(body, "document_url") : undefined;
  const classId = "class_id" in body ? vStr(body, "class_id") : undefined;
  await c.env.DB.prepare(
    `UPDATE students SET
       class_id = CASE WHEN ? THEN ? ELSE class_id END,
       student_number = COALESCE(?, student_number),
       date_of_birth = COALESCE(?, date_of_birth),
       gender = COALESCE(?, gender),
       address = COALESCE(?, address),
       document_url = CASE WHEN ? THEN ? ELSE document_url END,
       status = COALESCE(?, status),
       updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(
      classId !== undefined ? 1 : 0,
      classId ?? null,
      vStr(body, "student_number", { max: 30 }),
      vDate(body, "date_of_birth"),
      vEnum(body, "gender", ["male", "female"] as const),
      vStr(body, "address", { max: 300 }),
      docUrl !== undefined ? 1 : 0,
      docUrl ?? null,
      vEnum(body, "status", ["active", "inactive", "graduated"] as const),
      id,
    )
    .run();

  const fullName = vStr(body, "full_name", { max: 200 });
  const statusVal = vEnum(body, "status", ["active", "inactive", "graduated"] as const);
  if (fullName || statusVal) {
    await c.env.DB.prepare(
      "UPDATE users SET full_name = COALESCE(?, full_name), is_active = COALESCE(?, is_active), updated_at = datetime('now') WHERE id = ?",
    )
      .bind(fullName, statusVal ? (statusVal === "active" ? 1 : 0) : null, student.user_id)
      .run();
  }
  return c.json({ ok: true });
});

// Deactivate (soft delete): keeps history (attendance, marks) intact.
students.delete("/:id", adminOnly, async (c) => {
  const id = c.req.param("id");
  const student = await c.env.DB.prepare("SELECT user_id FROM students WHERE id = ?").bind(id).first<{ user_id: string }>();
  if (!student) throw notFound();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE students SET status = 'inactive', updated_at = datetime('now') WHERE id = ?").bind(id),
    c.env.DB.prepare("UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?").bind(student.user_id),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(student.user_id),
  ]);
  return c.json({ ok: true });
});

// ---- parent links ----
students.post("/:id/parents", adminOnly, async (c) => {
  const studentId = c.req.param("id");
  const body = await readBody(c);
  const parentUserId = vStr(body, "parent_user_id", { required: true })!;
  const parent = await c.env.DB.prepare("SELECT id FROM users WHERE id = ? AND role = 'parent'").bind(parentUserId).first();
  if (!parent) throw badRequest("ولي الأمر غير موجود");
  const student = await c.env.DB.prepare("SELECT id FROM students WHERE id = ?").bind(studentId).first();
  if (!student) throw notFound();
  const dup = await c.env.DB.prepare("SELECT id FROM student_parent_links WHERE student_id = ? AND parent_user_id = ?")
    .bind(studentId, parentUserId)
    .first();
  if (dup) throw badRequest("ولي الأمر مرتبط بالطالب مسبقاً");
  const id = uid();
  await c.env.DB.prepare("INSERT INTO student_parent_links (id, student_id, parent_user_id, relationship) VALUES (?,?,?,?)")
    .bind(id, studentId, parentUserId, vStr(body, "relationship", { max: 50 }))
    .run();
  return c.json({ id }, 201);
});

students.delete("/:id/parents/:linkId", adminOnly, async (c) => {
  const res = await c.env.DB.prepare("DELETE FROM student_parent_links WHERE id = ? AND student_id = ?")
    .bind(c.req.param("linkId"), c.req.param("id"))
    .run();
  if (!res.meta.changes) throw notFound();
  return c.json({ ok: true });
});

export default students;
