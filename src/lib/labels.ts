import type { AttendanceStatus, Role, StudentStatus, SubmissionStatus } from "../../shared/types";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "مدير المنصة",
  school_admin: "مدير المدرسة",
  teacher: "معلم",
  student: "طالب",
  parent: "ولي أمر",
};

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  active: "نشط",
  inactive: "غير نشط",
  graduated: "متخرج",
};

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  excused: "بعذر",
};

export const ATTENDANCE_COLORS: Record<AttendanceStatus, string> = {
  present: "bg-emerald-100 text-emerald-800",
  absent: "bg-red-100 text-red-800",
  late: "bg-amber-100 text-amber-800",
  excused: "bg-sky-100 text-sky-800",
};

export const SUBMISSION_LABELS: Record<SubmissionStatus, string> = {
  submitted: "تم التسليم",
  reviewed: "تمت المراجعة",
};

// Accepts date-only ("2026-06-18") and SQLite UTC datetimes ("2026-06-18 12:34:56")
// as well as ISO strings, returning a Date or null if unparseable.
function parseDate(value: string): Date | null {
  let iso = value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    iso = `${value}T00:00:00`; // date only → local midnight
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    iso = `${value.replace(" ", "T")}Z`; // SQLite datetime('now') is UTC
  }
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = parseDate(value);
  if (!d) return value;
  return d.toLocaleDateString("ar", { year: "numeric", month: "long", day: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = parseDate(value);
  if (!d) return value;
  return d.toLocaleString("ar", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
