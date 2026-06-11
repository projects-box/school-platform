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

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value.includes("T") ? value : `${value}T00:00:00`).toLocaleDateString("ar", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
