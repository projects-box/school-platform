import { Hono } from "hono";
import type { AppEnv, AppContext } from "../lib/app";
import { inPlaceholders, parentStudents, studentScope, teacherScope } from "../lib/app";
import type { Announcement, Assignment, AttendanceSummary, DashboardData, Mark, TeacherAssignment } from "../../shared/types";
import { forbidden } from "../lib/http";

const dashboard = new Hono<AppEnv>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function recentAnnouncements(c: AppContext, classIds: string[] | null): Promise<Announcement[]> {
  let where = "";
  const vals: unknown[] = [];
  if (classIds !== null) {
    if (classIds.length) {
      where = `WHERE (a.class_id IS NULL OR a.class_id IN ${inPlaceholders(classIds.length)})`;
      vals.push(...classIds);
    } else {
      where = "WHERE a.class_id IS NULL";
    }
  }
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.class_id, a.title, a.body, a.attachment_url, a.created_by, a.created_at, c2.name AS class_name, u.full_name AS author_name
     FROM announcements a LEFT JOIN classes c2 ON c2.id = a.class_id LEFT JOIN users u ON u.id = a.created_by
     ${where} ORDER BY a.created_at DESC LIMIT 5`,
  )
    .bind(...vals)
    .all<Announcement>();
  return results;
}

async function attendanceSummaryFor(c: AppContext, conds: string, vals: unknown[]): Promise<AttendanceSummary> {
  const row = await c.env.DB.prepare(
    `SELECT SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
            SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent,
            SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late,
            SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) AS excused
     FROM attendance_records WHERE ${conds}`,
  )
    .bind(...vals)
    .first<AttendanceSummary>();
  return {
    present: row?.present ?? 0,
    absent: row?.absent ?? 0,
    late: row?.late ?? 0,
    excused: row?.excused ?? 0,
  };
}

dashboard.get("/", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  const data: DashboardData = { role: user.role };

  if (user.role === "super_admin" || user.role === "school_admin") {
    const totals = await db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM students WHERE status = 'active') AS students,
                (SELECT COUNT(*) FROM teachers t JOIN users u ON u.id = t.user_id WHERE u.is_active = 1) AS teachers,
                (SELECT COUNT(*) FROM classes WHERE is_active = 1) AS classes,
                (SELECT COUNT(*) FROM students WHERE status = 'active') AS total_active`,
      )
      .first<{ students: number; teachers: number; classes: number; total_active: number }>();
    const todayAttendance = await attendanceSummaryFor(c, "date = ?", [today()]);
    data.totals = { students: totals?.students ?? 0, teachers: totals?.teachers ?? 0, classes: totals?.classes ?? 0 };
    data.today_attendance = { ...todayAttendance, total_active: totals?.total_active ?? 0 };
    data.announcements = await recentAnnouncements(c, null);
  } else if (user.role === "teacher") {
    const scope = await teacherScope(c);
    const { results: myClasses } = await db
      .prepare(
        `SELECT tcs.id, tcs.teacher_id, tcs.class_id, tcs.subject_id, c2.name AS class_name, s.name AS subject_name, c2.timetable_url
         FROM teacher_class_subjects tcs
         JOIN classes c2 ON c2.id = tcs.class_id
         JOIN subjects s ON s.id = tcs.subject_id
         WHERE tcs.teacher_id = ? ORDER BY c2.name`,
      )
      .bind(scope.teacherId)
      .all<TeacherAssignment & { timetable_url: string | null }>();
    data.my_classes = myClasses;

    if (scope.classIds.length) {
      const { results: pending } = await db
        .prepare(
          `SELECT cl.id AS class_id, cl.name AS class_name FROM classes cl
           WHERE cl.id IN ${inPlaceholders(scope.classIds.length)}
             AND NOT EXISTS (SELECT 1 FROM attendance_records a WHERE a.class_id = cl.id AND a.date = ?)`,
        )
        .bind(...scope.classIds, today())
        .all<{ class_id: string; class_name: string }>();
      data.pending_attendance = pending;
    } else {
      data.pending_attendance = [];
    }
    data.announcements = await recentAnnouncements(c, scope.classIds);
  } else if (user.role === "student") {
    const scope = await studentScope(c);
    data.attendance_summary = await attendanceSummaryFor(c, "student_id = ?", [scope.studentId]);
    const { results: recentMarks } = await db
      .prepare(
        `SELECT m.id, m.exam_id, m.student_id, m.score, e.title AS exam_title, e.max_score, e.exam_date, s.name AS subject_name
         FROM marks m JOIN exams e ON e.id = m.exam_id JOIN subjects s ON s.id = e.subject_id
         WHERE m.student_id = ? ORDER BY e.exam_date DESC LIMIT 5`,
      )
      .bind(scope.studentId)
      .all<Mark>();
    data.recent_marks = recentMarks;
    if (scope.classId) {
      data.my_class = (await db
        .prepare("SELECT id, name, timetable_url FROM classes WHERE id = ?")
        .bind(scope.classId)
        .first()) as DashboardData["my_class"];
      const { results: assignments } = await db
        .prepare(
          `SELECT a.id, a.class_id, a.subject_id, a.teacher_id, a.title, a.resource_url, a.due_date, s.name AS subject_name,
                  ms.status AS my_submission_status
           FROM assignments a
           LEFT JOIN subjects s ON s.id = a.subject_id
           LEFT JOIN assignment_submissions ms ON ms.assignment_id = a.id AND ms.student_id = ?
           WHERE a.class_id = ? ORDER BY a.due_date DESC LIMIT 5`,
        )
        .bind(scope.studentId, scope.classId)
        .all<Assignment>();
      data.assignments = assignments;
    } else {
      data.my_class = null;
      data.assignments = [];
    }
    data.announcements = await recentAnnouncements(c, scope.classId ? [scope.classId] : []);
  } else if (user.role === "parent") {
    const children = await parentStudents(c);
    const summaries = [];
    for (const child of children) {
      const info = await db
        .prepare(
          `SELECT s.id AS student_id, u.full_name, s.class_id, c2.name AS class_name
           FROM students s JOIN users u ON u.id = s.user_id LEFT JOIN classes c2 ON c2.id = s.class_id WHERE s.id = ?`,
        )
        .bind(child.id)
        .first<{ student_id: string; full_name: string; class_id: string | null; class_name: string | null }>();
      if (!info) continue;
      const attendance = await attendanceSummaryFor(c, "student_id = ?", [child.id]);
      const { results: recentMarks } = await db
        .prepare(
          `SELECT m.id, m.exam_id, m.student_id, m.score, e.title AS exam_title, e.max_score, e.exam_date, s.name AS subject_name
           FROM marks m JOIN exams e ON e.id = m.exam_id JOIN subjects s ON s.id = e.subject_id
           WHERE m.student_id = ? ORDER BY e.exam_date DESC LIMIT 3`,
        )
        .bind(child.id)
        .all<Mark>();
      summaries.push({ ...info, attendance, recent_marks: recentMarks });
    }
    data.children = summaries;
    const classIds = [...new Set(children.map((s) => s.class_id).filter((x): x is string => !!x))];
    data.announcements = await recentAnnouncements(c, classIds);
  } else {
    throw forbidden();
  }

  return c.json(data);
});

export default dashboard;
