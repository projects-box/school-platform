import { Hono } from "hono";
import type { AppEnv, AppContext } from "../lib/app";
import { inPlaceholders, isAdmin, parentStudents, studentScope, teacherScope, visibleClassIds } from "../lib/app";
import { badRequest, forbidden, notFound, paginated, pagination, readBody, uid, vDate, vNum, vStr, vUrl } from "../lib/http";

async function assertCanManageClassSubject(c: AppContext, classId: string, subjectId?: string | null): Promise<void> {
  if (isAdmin(c)) return;
  if (c.get("user").role === "teacher") {
    const scope = await teacherScope(c);
    if (subjectId) {
      if (scope.pairs.some((p) => p.class_id === classId && p.subject_id === subjectId)) return;
    } else if (scope.classIds.includes(classId)) {
      return;
    }
  }
  throw forbidden();
}

export const exams = new Hono<AppEnv>();

exams.get("/", async (c) => {
  const { page, perPage, offset } = pagination(c);
  const conds: string[] = [];
  const vals: unknown[] = [];

  const allowed = await visibleClassIds(c);
  if (allowed !== null) {
    if (!allowed.length) return c.json(paginated([], 0, page, perPage));
    conds.push(`e.class_id IN ${inPlaceholders(allowed.length)}`);
    vals.push(...allowed);
  }
  const classId = c.req.query("class_id");
  if (classId) {
    conds.push("e.class_id = ?");
    vals.push(classId);
  }
  const subjectId = c.req.query("subject_id");
  if (subjectId) {
    conds.push("e.subject_id = ?");
    vals.push(subjectId);
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM exams e ${where}`).bind(...vals).first<{ n: number }>();
  const { results } = await c.env.DB.prepare(
    `SELECT e.id, e.class_id, e.subject_id, e.term_id, e.title, e.exam_date, e.max_score, e.resource_url,
            c2.name AS class_name, s.name AS subject_name,
            (SELECT COUNT(*) FROM marks m WHERE m.exam_id = e.id) AS marks_count
     FROM exams e JOIN classes c2 ON c2.id = e.class_id JOIN subjects s ON s.id = e.subject_id
     ${where} ORDER BY e.exam_date DESC, e.created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...vals, perPage, offset)
    .all();
  return c.json(paginated(results, countRow?.n ?? 0, page, perPage));
});

exams.post("/", async (c) => {
  const body = await readBody(c);
  const classId = vStr(body, "class_id", { required: true })!;
  const subjectId = vStr(body, "subject_id", { required: true })!;
  await assertCanManageClassSubject(c, classId, subjectId);
  const schoolRow = await c.env.DB.prepare("SELECT id FROM schools LIMIT 1").first<{ id: string }>();
  if (!schoolRow) throw notFound();
  const id = uid();
  await c.env.DB.prepare(
    "INSERT INTO exams (id, school_id, class_id, subject_id, term_id, title, exam_date, max_score, resource_url, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)",
  )
    .bind(
      id,
      schoolRow.id,
      classId,
      subjectId,
      vStr(body, "term_id"),
      vStr(body, "title", { required: true, max: 200 }),
      vDate(body, "exam_date"),
      vNum(body, "max_score", { min: 1, max: 1000 }) ?? 100,
      vUrl(body, "resource_url"),
      c.get("user").id,
    )
    .run();
  return c.json({ id }, 201);
});

exams.get("/:id", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT e.id, e.class_id, e.subject_id, e.term_id, e.title, e.exam_date, e.max_score, e.resource_url,
            c2.name AS class_name, s.name AS subject_name
     FROM exams e JOIN classes c2 ON c2.id = e.class_id JOIN subjects s ON s.id = e.subject_id WHERE e.id = ?`,
  )
    .bind(c.req.param("id"))
    .first<{ id: string; class_id: string }>();
  if (!row) throw notFound();
  const allowed = await visibleClassIds(c);
  if (allowed !== null && !allowed.includes(row.class_id)) throw forbidden();
  return c.json({ exam: row });
});

exams.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const exam = await c.env.DB.prepare("SELECT class_id, subject_id FROM exams WHERE id = ?").bind(id).first<{ class_id: string; subject_id: string }>();
  if (!exam) throw notFound();
  await assertCanManageClassSubject(c, exam.class_id, exam.subject_id);
  const body = await readBody(c);
  const resourceUrl = "resource_url" in body ? vUrl(body, "resource_url") : undefined;
  await c.env.DB.prepare(
    `UPDATE exams SET title = COALESCE(?, title), exam_date = COALESCE(?, exam_date), max_score = COALESCE(?, max_score),
     term_id = COALESCE(?, term_id), resource_url = CASE WHEN ? THEN ? ELSE resource_url END, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(
      vStr(body, "title", { max: 200 }),
      vDate(body, "exam_date"),
      vNum(body, "max_score", { min: 1, max: 1000 }),
      vStr(body, "term_id"),
      resourceUrl !== undefined ? 1 : 0,
      resourceUrl ?? null,
      id,
    )
    .run();
  return c.json({ ok: true });
});

exams.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const exam = await c.env.DB.prepare("SELECT class_id, subject_id FROM exams WHERE id = ?").bind(id).first<{ class_id: string; subject_id: string }>();
  if (!exam) throw notFound();
  await assertCanManageClassSubject(c, exam.class_id, exam.subject_id);
  await c.env.DB.prepare("DELETE FROM exams WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

// Marks sheet for an exam: all active students of the class with current scores.
exams.get("/:id/marks", async (c) => {
  const id = c.req.param("id");
  const exam = await c.env.DB.prepare("SELECT class_id, subject_id, max_score FROM exams WHERE id = ?")
    .bind(id)
    .first<{ class_id: string; subject_id: string; max_score: number }>();
  if (!exam) throw notFound();
  await assertCanManageClassSubject(c, exam.class_id, exam.subject_id);
  const { results } = await c.env.DB.prepare(
    `SELECT s.id AS student_id, u.full_name AS student_name, s.student_number, m.id AS mark_id, m.score
     FROM students s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN marks m ON m.student_id = s.id AND m.exam_id = ?
     WHERE s.class_id = ? AND s.status = 'active'
     ORDER BY u.full_name`,
  )
    .bind(id, exam.class_id)
    .all();
  return c.json({ items: results, max_score: exam.max_score });
});

export const marks = new Hono<AppEnv>();

// Bulk upsert marks for an exam (teacher of class/subject or admin).
marks.post("/", async (c) => {
  const body = await readBody(c);
  const examId = vStr(body, "exam_id", { required: true })!;
  const exam = await c.env.DB.prepare("SELECT class_id, subject_id, max_score FROM exams WHERE id = ?")
    .bind(examId)
    .first<{ class_id: string; subject_id: string; max_score: number }>();
  if (!exam) throw notFound();
  await assertCanManageClassSubject(c, exam.class_id, exam.subject_id);

  const entries = body.marks;
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 200) throw badRequest("الدرجات غير صالحة");

  const { results: classStudents } = await c.env.DB.prepare("SELECT id FROM students WHERE class_id = ?")
    .bind(exam.class_id)
    .all<{ id: string }>();
  const allowed = new Set(classStudents.map((s) => s.id));

  const userId = c.get("user").id;
  const stmts: D1PreparedStatement[] = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) throw badRequest("سجل درجات غير صالح");
    const e = entry as Record<string, unknown>;
    const studentId = String(e.student_id ?? "");
    if (!allowed.has(studentId)) throw badRequest("أحد الطلاب لا ينتمي لفصل هذا الاختبار");
    if (e.score === null || e.score === "") {
      stmts.push(c.env.DB.prepare("DELETE FROM marks WHERE exam_id = ? AND student_id = ?").bind(examId, studentId));
      continue;
    }
    const score = Number(e.score);
    if (!isFinite(score) || score < 0 || score > exam.max_score) {
      throw badRequest(`درجة غير صالحة (يجب أن تكون بين 0 و ${exam.max_score})`);
    }
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO marks (id, exam_id, student_id, score, graded_by) VALUES (?,?,?,?,?)
         ON CONFLICT(exam_id, student_id) DO UPDATE SET score = excluded.score, graded_by = excluded.graded_by, updated_at = datetime('now')`,
      ).bind(uid(), examId, studentId, score, userId),
    );
  }
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, saved: stmts.length });
});

// Marks of one student (student: self, parent: linked child, teacher/admin: scoped).
marks.get("/", async (c) => {
  const user = c.get("user");
  const { page, perPage, offset } = pagination(c);
  let studentId = c.req.query("student_id");

  if (user.role === "student") {
    studentId = (await studentScope(c)).studentId;
  } else if (user.role === "parent") {
    const children = await parentStudents(c);
    if (!children.length) return c.json(paginated([], 0, page, perPage));
    if (!studentId || !children.some((s) => s.id === studentId)) {
      studentId = children[0].id;
    }
  } else if (user.role === "teacher") {
    if (!studentId) throw badRequest("يجب تحديد الطالب");
    const scope = await teacherScope(c);
    const st = await c.env.DB.prepare("SELECT class_id FROM students WHERE id = ?").bind(studentId).first<{ class_id: string | null }>();
    if (!st || !st.class_id || !scope.classIds.includes(st.class_id)) throw forbidden();
  } else if (!isAdmin(c)) {
    throw forbidden();
  } else if (!studentId) {
    throw badRequest("يجب تحديد الطالب");
  }

  const countRow = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM marks WHERE student_id = ?").bind(studentId).first<{ n: number }>();
  const { results } = await c.env.DB.prepare(
    `SELECT m.id, m.exam_id, m.student_id, m.score, e.title AS exam_title, e.max_score, e.exam_date, s.name AS subject_name
     FROM marks m JOIN exams e ON e.id = m.exam_id JOIN subjects s ON s.id = e.subject_id
     WHERE m.student_id = ? ORDER BY e.exam_date DESC LIMIT ? OFFSET ?`,
  )
    .bind(studentId, perPage, offset)
    .all();
  return c.json({ ...paginated(results, countRow?.n ?? 0, page, perPage), student_id: studentId });
});

export default exams;
