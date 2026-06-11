import { Hono } from "hono";
import type { AppEnv } from "../lib/app";
import { inPlaceholders, isAdmin, parentStudents, studentScope, teacherScope } from "../lib/app";
import type { AttendanceStatus } from "../../shared/types";
import { badRequest, forbidden, paginated, pagination, readBody, uid, vDate } from "../lib/http";

const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

async function assertCanManageClass(c: Parameters<typeof teacherScope>[0], classId: string): Promise<string | null> {
  if (isAdmin(c)) return null;
  if (c.get("user").role === "teacher") {
    const scope = await teacherScope(c);
    if (!scope.classIds.includes(classId)) throw forbidden();
    return scope.teacherId;
  }
  throw forbidden();
}

const attendance = new Hono<AppEnv>();

// Roster of a class for a given date, with any recorded statuses.
attendance.get("/", async (c) => {
  const classId = c.req.query("class_id");
  const date = c.req.query("date");
  if (!classId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest("يجب تحديد الفصل والتاريخ");
  await assertCanManageClass(c, classId);
  const { results } = await c.env.DB.prepare(
    `SELECT s.id AS student_id, u.full_name AS student_name, s.student_number,
            a.id AS record_id, a.status, a.note
     FROM students s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN attendance_records a ON a.student_id = s.id AND a.date = ?
     WHERE s.class_id = ? AND s.status = 'active'
     ORDER BY u.full_name`,
  )
    .bind(date, classId)
    .all();
  return c.json({ items: results, class_id: classId, date });
});

// Bulk upsert attendance for a class/date.
attendance.post("/", async (c) => {
  const body = await readBody(c);
  const classId = (body.class_id as string) || "";
  const date = vDate(body, "date", { required: true })!;
  if (!classId) throw badRequest("الحقل مطلوب: class_id");
  await assertCanManageClass(c, classId);

  const records = body.records;
  if (!Array.isArray(records) || records.length === 0 || records.length > 200) {
    throw badRequest("سجلات الحضور غير صالحة");
  }

  // Only accept students that actually belong to this class.
  const { results: classStudents } = await c.env.DB.prepare("SELECT id FROM students WHERE class_id = ? AND status = 'active'")
    .bind(classId)
    .all<{ id: string }>();
  const allowed = new Set(classStudents.map((s) => s.id));

  const userId = c.get("user").id;
  const stmts: D1PreparedStatement[] = [];
  for (const rec of records) {
    if (typeof rec !== "object" || rec === null) throw badRequest("سجل حضور غير صالح");
    const r = rec as Record<string, unknown>;
    const studentId = String(r.student_id ?? "");
    const status = String(r.status ?? "");
    const note = r.note ? String(r.note).slice(0, 300) : null;
    if (!allowed.has(studentId)) throw badRequest("أحد الطلاب لا ينتمي لهذا الفصل");
    if (!STATUSES.includes(status as AttendanceStatus)) throw badRequest("حالة حضور غير صالحة");
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO attendance_records (id, student_id, class_id, date, status, note, recorded_by)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(student_id, date) DO UPDATE SET
           status = excluded.status, note = excluded.note, recorded_by = excluded.recorded_by,
           class_id = excluded.class_id, updated_at = datetime('now')`,
      ).bind(uid(), studentId, classId, date, status, note, userId),
    );
  }
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, saved: stmts.length });
});

// Attendance reports: role-scoped, filterable by class/student/date range, paginated, with summary.
attendance.get("/reports", async (c) => {
  const user = c.get("user");
  const { page, perPage, offset } = pagination(c);
  const conds: string[] = [];
  const vals: unknown[] = [];

  const classId = c.req.query("class_id");
  const studentId = c.req.query("student_id");
  const from = c.req.query("from");
  const to = c.req.query("to");

  if (isAdmin(c)) {
    // unrestricted
  } else if (user.role === "teacher") {
    const scope = await teacherScope(c);
    if (!scope.classIds.length) return c.json({ ...paginated([], 0, page, perPage), summary: emptySummary() });
    conds.push(`a.class_id IN ${inPlaceholders(scope.classIds.length)}`);
    vals.push(...scope.classIds);
  } else if (user.role === "student") {
    const scope = await studentScope(c);
    conds.push("a.student_id = ?");
    vals.push(scope.studentId);
  } else if (user.role === "parent") {
    const children = await parentStudents(c);
    if (!children.length) return c.json({ ...paginated([], 0, page, perPage), summary: emptySummary() });
    const requested = studentId && children.some((s) => s.id === studentId) ? [studentId] : children.map((s) => s.id);
    conds.push(`a.student_id IN ${inPlaceholders(requested.length)}`);
    vals.push(...requested);
  } else {
    throw forbidden();
  }

  if (classId && user.role !== "parent" && user.role !== "student") {
    conds.push("a.class_id = ?");
    vals.push(classId);
  }
  if (studentId && (isAdmin(c) || user.role === "teacher")) {
    conds.push("a.student_id = ?");
    vals.push(studentId);
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    conds.push("a.date >= ?");
    vals.push(from);
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    conds.push("a.date <= ?");
    vals.push(to);
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const summaryRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
            SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent,
            SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late,
            SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) AS excused
     FROM attendance_records a ${where}`,
  )
    .bind(...vals)
    .first<{ n: number; present: number; absent: number; late: number; excused: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.student_id, a.class_id, a.date, a.status, a.note,
            u.full_name AS student_name, c2.name AS class_name
     FROM attendance_records a
     JOIN students s ON s.id = a.student_id
     JOIN users u ON u.id = s.user_id
     JOIN classes c2 ON c2.id = a.class_id
     ${where} ORDER BY a.date DESC, u.full_name LIMIT ? OFFSET ?`,
  )
    .bind(...vals, perPage, offset)
    .all();

  return c.json({
    ...paginated(results, summaryRow?.n ?? 0, page, perPage),
    summary: {
      present: summaryRow?.present ?? 0,
      absent: summaryRow?.absent ?? 0,
      late: summaryRow?.late ?? 0,
      excused: summaryRow?.excused ?? 0,
    },
  });
});

function emptySummary() {
  return { present: 0, absent: 0, late: 0, excused: 0 };
}

export default attendance;
