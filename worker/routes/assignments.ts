import { Hono } from "hono";
import type { AppEnv, AppContext } from "../lib/app";
import { inPlaceholders, isAdmin, studentScope, teacherScope, visibleClassIds } from "../lib/app";
import { badRequest, forbidden, notFound, paginated, pagination, readBody, uid, vDate, vStr, vUrl } from "../lib/http";

async function assertCanManageAssignment(c: AppContext, classId: string, teacherId?: string): Promise<string | null> {
  if (isAdmin(c)) return null;
  if (c.get("user").role === "teacher") {
    const scope = await teacherScope(c);
    if (!scope.classIds.includes(classId)) throw forbidden();
    if (teacherId && teacherId !== scope.teacherId) throw forbidden();
    return scope.teacherId;
  }
  throw forbidden();
}

export const assignments = new Hono<AppEnv>();

assignments.get("/", async (c) => {
  const user = c.get("user");
  const { page, perPage, offset } = pagination(c);
  const conds: string[] = [];
  const vals: unknown[] = [];

  const allowed = await visibleClassIds(c);
  if (allowed !== null) {
    if (!allowed.length) return c.json(paginated([], 0, page, perPage));
    conds.push(`a.class_id IN ${inPlaceholders(allowed.length)}`);
    vals.push(...allowed);
  }
  const classId = c.req.query("class_id");
  if (classId) {
    conds.push("a.class_id = ?");
    vals.push(classId);
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM assignments a ${where}`).bind(...vals).first<{ n: number }>();

  // For students, include their own submission status inline.
  let mySubJoin = "";
  const preVals: unknown[] = [];
  if (user.role === "student") {
    const scope = await studentScope(c);
    mySubJoin = "LEFT JOIN assignment_submissions ms ON ms.assignment_id = a.id AND ms.student_id = ?";
    preVals.push(scope.studentId);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.class_id, a.subject_id, a.teacher_id, a.title, a.description, a.resource_url, a.due_date,
            c2.name AS class_name, s.name AS subject_name, u.full_name AS teacher_name,
            (SELECT COUNT(*) FROM assignment_submissions sub WHERE sub.assignment_id = a.id) AS submissions_count
            ${mySubJoin ? ", ms.id AS my_submission_id, ms.status AS my_submission_status" : ""}
     FROM assignments a
     JOIN classes c2 ON c2.id = a.class_id
     LEFT JOIN subjects s ON s.id = a.subject_id
     JOIN teachers t ON t.id = a.teacher_id
     JOIN users u ON u.id = t.user_id
     ${mySubJoin}
     ${where} ORDER BY a.due_date DESC, a.created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...preVals, ...vals, perPage, offset)
    .all();
  return c.json(paginated(results, countRow?.n ?? 0, page, perPage));
});

assignments.post("/", async (c) => {
  const body = await readBody(c);
  const classId = vStr(body, "class_id", { required: true })!;
  const teacherId = await assertCanManageAssignment(c, classId);

  // Admin must specify the teacher; teachers create as themselves.
  let finalTeacherId = teacherId;
  if (!finalTeacherId) {
    finalTeacherId = vStr(body, "teacher_id");
    if (!finalTeacherId) {
      const fallback = await c.env.DB.prepare(
        "SELECT teacher_id FROM teacher_class_subjects WHERE class_id = ? LIMIT 1",
      ).bind(classId).first<{ teacher_id: string }>();
      if (!fallback) throw badRequest("يجب تحديد المعلم المسؤول عن الواجب");
      finalTeacherId = fallback.teacher_id;
    }
  }

  const id = uid();
  await c.env.DB.prepare(
    "INSERT INTO assignments (id, class_id, subject_id, teacher_id, title, description, resource_url, due_date) VALUES (?,?,?,?,?,?,?,?)",
  )
    .bind(
      id,
      classId,
      vStr(body, "subject_id"),
      finalTeacherId,
      vStr(body, "title", { required: true, max: 200 }),
      vStr(body, "description", { max: 2000 }),
      vUrl(body, "resource_url"),
      vDate(body, "due_date"),
    )
    .run();
  return c.json({ id }, 201);
});

assignments.get("/:id", async (c) => {
  const user = c.get("user");
  const row = await c.env.DB.prepare(
    `SELECT a.id, a.class_id, a.subject_id, a.teacher_id, a.title, a.description, a.resource_url, a.due_date,
            c2.name AS class_name, s.name AS subject_name, u.full_name AS teacher_name
     FROM assignments a
     JOIN classes c2 ON c2.id = a.class_id
     LEFT JOIN subjects s ON s.id = a.subject_id
     JOIN teachers t ON t.id = a.teacher_id
     JOIN users u ON u.id = t.user_id
     WHERE a.id = ?`,
  )
    .bind(c.req.param("id"))
    .first<{ id: string; class_id: string }>();
  if (!row) throw notFound();
  const allowed = await visibleClassIds(c);
  if (allowed !== null && !allowed.includes(row.class_id)) throw forbidden();

  let mySubmission = null;
  if (user.role === "student") {
    const scope = await studentScope(c);
    mySubmission = await c.env.DB.prepare(
      "SELECT id, assignment_id, student_id, submission_text, submission_url, status, feedback FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?",
    )
      .bind(row.id, scope.studentId)
      .first();
  }
  return c.json({ assignment: row, my_submission: mySubmission });
});

assignments.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT class_id, teacher_id FROM assignments WHERE id = ?").bind(id).first<{ class_id: string; teacher_id: string }>();
  if (!row) throw notFound();
  await assertCanManageAssignment(c, row.class_id, row.teacher_id);
  const body = await readBody(c);
  const resourceUrl = "resource_url" in body ? vUrl(body, "resource_url") : undefined;
  await c.env.DB.prepare(
    `UPDATE assignments SET title = COALESCE(?, title), description = COALESCE(?, description),
     due_date = COALESCE(?, due_date), subject_id = COALESCE(?, subject_id),
     resource_url = CASE WHEN ? THEN ? ELSE resource_url END, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(
      vStr(body, "title", { max: 200 }),
      vStr(body, "description", { max: 2000 }),
      vDate(body, "due_date"),
      vStr(body, "subject_id"),
      resourceUrl !== undefined ? 1 : 0,
      resourceUrl ?? null,
      id,
    )
    .run();
  return c.json({ ok: true });
});

assignments.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT class_id, teacher_id FROM assignments WHERE id = ?").bind(id).first<{ class_id: string; teacher_id: string }>();
  if (!row) throw notFound();
  await assertCanManageAssignment(c, row.class_id, row.teacher_id);
  await c.env.DB.prepare("DELETE FROM assignments WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

// Submissions of an assignment (teacher/admin).
assignments.get("/:id/submissions", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT class_id FROM assignments WHERE id = ?").bind(id).first<{ class_id: string }>();
  if (!row) throw notFound();
  await assertCanManageAssignment(c, row.class_id);
  const { results } = await c.env.DB.prepare(
    `SELECT sub.id, sub.assignment_id, sub.student_id, sub.submission_text, sub.submission_url, sub.status, sub.feedback, sub.created_at,
            u.full_name AS student_name
     FROM assignment_submissions sub
     JOIN students s ON s.id = sub.student_id
     JOIN users u ON u.id = s.user_id
     WHERE sub.assignment_id = ? ORDER BY u.full_name`,
  )
    .bind(id)
    .all();
  return c.json({ items: results });
});

export const submissions = new Hono<AppEnv>();

// Student submits (text and/or external link only — no file uploads in the MVP).
submissions.post("/", async (c) => {
  const user = c.get("user");
  if (user.role !== "student") throw forbidden();
  const scope = await studentScope(c);
  const body = await readBody(c);
  const assignmentId = vStr(body, "assignment_id", { required: true })!;

  const assignment = await c.env.DB.prepare("SELECT class_id FROM assignments WHERE id = ?").bind(assignmentId).first<{ class_id: string }>();
  if (!assignment) throw notFound();
  if (!scope.classId || assignment.class_id !== scope.classId) throw forbidden();

  const text = vStr(body, "submission_text", { max: 4000 });
  const url = vUrl(body, "submission_url");
  if (!text && !url) throw badRequest("أدخل إجابة نصية أو رابطاً خارجياً");

  const existing = await c.env.DB.prepare("SELECT id, status FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?")
    .bind(assignmentId, scope.studentId)
    .first<{ id: string; status: string }>();
  if (existing) {
    if (existing.status === "reviewed") throw badRequest("تمت مراجعة التسليم، لا يمكن تعديله");
    await c.env.DB.prepare(
      "UPDATE assignment_submissions SET submission_text = ?, submission_url = ?, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(text, url, existing.id)
      .run();
    return c.json({ id: existing.id });
  }
  const id = uid();
  await c.env.DB.prepare(
    "INSERT INTO assignment_submissions (id, assignment_id, student_id, submission_text, submission_url) VALUES (?,?,?,?,?)",
  )
    .bind(id, assignmentId, scope.studentId, text, url)
    .run();
  return c.json({ id }, 201);
});

// Teacher reviews a submission (feedback + mark reviewed).
submissions.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const sub = await c.env.DB.prepare(
    `SELECT sub.id, a.class_id, a.teacher_id FROM assignment_submissions sub JOIN assignments a ON a.id = sub.assignment_id WHERE sub.id = ?`,
  )
    .bind(id)
    .first<{ id: string; class_id: string; teacher_id: string }>();
  if (!sub) throw notFound();
  await assertCanManageAssignment(c, sub.class_id);
  const body = await readBody(c);
  await c.env.DB.prepare(
    `UPDATE assignment_submissions SET feedback = COALESCE(?, feedback), status = COALESCE(?, status), updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(vStr(body, "feedback", { max: 1000 }), body.status === "reviewed" ? "reviewed" : body.status === "submitted" ? "submitted" : null, id)
    .run();
  return c.json({ ok: true });
});

export default assignments;
