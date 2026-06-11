import type { Context } from "hono";
import type { Role, SafeUser } from "../../shared/types";
import { forbidden, notFound } from "./http";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export interface TeacherScope {
  teacherId: string;
  classIds: string[];
  pairs: { class_id: string; subject_id: string }[];
}

export interface StudentScope {
  studentId: string;
  classId: string | null;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: SafeUser;
    _teacherScope?: TeacherScope | null;
    _studentScope?: StudentScope | null;
    _parentStudents?: { id: string; class_id: string | null }[];
  };
};

export type AppContext = Context<AppEnv>;

export const ADMIN_ROLES: Role[] = ["super_admin", "school_admin"];

export function isAdmin(c: AppContext): boolean {
  return ADMIN_ROLES.includes(c.get("user").role);
}

/** Teacher scope: teacher row id + assigned class/subject pairs. Cached per request. */
export async function teacherScope(c: AppContext): Promise<TeacherScope> {
  const cached = c.get("_teacherScope");
  if (cached !== undefined) {
    if (cached === null) throw forbidden();
    return cached;
  }
  const user = c.get("user");
  const teacher = await c.env.DB.prepare("SELECT id FROM teachers WHERE user_id = ?").bind(user.id).first<{ id: string }>();
  if (!teacher) {
    c.set("_teacherScope", null);
    throw forbidden();
  }
  const { results } = await c.env.DB.prepare("SELECT class_id, subject_id FROM teacher_class_subjects WHERE teacher_id = ?")
    .bind(teacher.id)
    .all<{ class_id: string; subject_id: string }>();
  const scope: TeacherScope = {
    teacherId: teacher.id,
    classIds: [...new Set(results.map((r) => r.class_id))],
    pairs: results,
  };
  c.set("_teacherScope", scope);
  return scope;
}

/** Student scope: own student row. */
export async function studentScope(c: AppContext): Promise<StudentScope> {
  const cached = c.get("_studentScope");
  if (cached !== undefined) {
    if (cached === null) throw forbidden();
    return cached;
  }
  const user = c.get("user");
  const row = await c.env.DB.prepare("SELECT id, class_id FROM students WHERE user_id = ?")
    .bind(user.id)
    .first<{ id: string; class_id: string | null }>();
  if (!row) {
    c.set("_studentScope", null);
    throw forbidden();
  }
  const scope: StudentScope = { studentId: row.id, classId: row.class_id };
  c.set("_studentScope", scope);
  return scope;
}

/** Parent scope: linked children (id + class). */
export async function parentStudents(c: AppContext): Promise<{ id: string; class_id: string | null }[]> {
  const cached = c.get("_parentStudents");
  if (cached !== undefined) return cached;
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.class_id FROM student_parent_links l JOIN students s ON s.id = l.student_id WHERE l.parent_user_id = ?`,
  )
    .bind(user.id)
    .all<{ id: string; class_id: string | null }>();
  c.set("_parentStudents", results);
  return results;
}

/**
 * Throws 403/404 unless the current user may view this student.
 * Admin: any. Teacher: students in assigned classes. Student: self. Parent: linked children.
 */
export async function assertCanViewStudent(c: AppContext, studentId: string): Promise<void> {
  const role = c.get("user").role;
  if (ADMIN_ROLES.includes(role)) return;
  if (role === "teacher") {
    const scope = await teacherScope(c);
    const row = await c.env.DB.prepare("SELECT class_id FROM students WHERE id = ?").bind(studentId).first<{ class_id: string | null }>();
    if (!row) throw notFound();
    if (!row.class_id || !scope.classIds.includes(row.class_id)) throw forbidden();
    return;
  }
  if (role === "student") {
    const scope = await studentScope(c);
    if (scope.studentId !== studentId) throw forbidden();
    return;
  }
  if (role === "parent") {
    const children = await parentStudents(c);
    if (!children.some((s) => s.id === studentId)) throw forbidden();
    return;
  }
  throw forbidden();
}

/** Class ids the current user may read data for. `null` means all (admin). */
export async function visibleClassIds(c: AppContext): Promise<string[] | null> {
  const role = c.get("user").role;
  if (ADMIN_ROLES.includes(role)) return null;
  if (role === "teacher") return (await teacherScope(c)).classIds;
  if (role === "student") {
    const scope = await studentScope(c);
    return scope.classId ? [scope.classId] : [];
  }
  if (role === "parent") {
    const children = await parentStudents(c);
    return [...new Set(children.map((s) => s.class_id).filter((x): x is string => !!x))];
  }
  return [];
}

/** SQL helper: builds `(?,?,?)` placeholders for an IN clause. */
export function inPlaceholders(count: number): string {
  return `(${Array.from({ length: count }, () => "?").join(",")})`;
}
