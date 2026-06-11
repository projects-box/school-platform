// Shared types between the worker API and the React frontend.

export type Role = "super_admin" | "school_admin" | "teacher" | "student" | "parent";
export type StudentStatus = "active" | "inactive" | "graduated";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type SubmissionStatus = "submitted" | "reviewed";

export interface SafeUser {
  id: string;
  school_id: string | null;
  role: Role;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: number;
}

export interface School {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  general_timetable_url: string | null;
}

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: number;
}

export interface Term {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: number;
}

export interface GradeLevel {
  id: string;
  name: string;
  level: number;
  timetable_url: string | null;
  classes_count?: number;
}

export interface ClassRoom {
  id: string;
  grade_id: string;
  name: string;
  timetable_url: string | null;
  is_active: number;
  grade_name?: string;
  students_count?: number;
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
}

export interface Student {
  id: string;
  user_id: string;
  class_id: string | null;
  student_number: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | null;
  address: string | null;
  document_url: string | null;
  status: StudentStatus;
  full_name: string;
  username?: string;
  class_name?: string;
  grade_name?: string;
}

export interface ParentLink {
  id: string;
  student_id: string;
  parent_user_id: string;
  relationship: string | null;
  parent_name?: string;
  parent_phone?: string | null;
  student_name?: string;
}

export interface Teacher {
  id: string;
  user_id: string;
  specialization: string | null;
  resource_url: string | null;
  full_name: string;
  username?: string;
  phone?: string | null;
  email?: string | null;
  is_active?: number;
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  class_name?: string;
  subject_name?: string;
  teacher_name?: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  student_name?: string;
  class_name?: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export interface Exam {
  id: string;
  class_id: string;
  subject_id: string;
  term_id: string | null;
  title: string;
  exam_date: string | null;
  max_score: number;
  resource_url: string | null;
  class_name?: string;
  subject_name?: string;
  marks_count?: number;
}

export interface Mark {
  id: string;
  exam_id: string;
  student_id: string;
  score: number;
  student_name?: string;
  exam_title?: string;
  max_score?: number;
  subject_name?: string;
  exam_date?: string | null;
}

export interface Assignment {
  id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string;
  title: string;
  description: string | null;
  resource_url: string | null;
  due_date: string | null;
  class_name?: string;
  subject_name?: string;
  teacher_name?: string;
  my_submission?: AssignmentSubmission | null;
  submissions_count?: number;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_text: string | null;
  submission_url: string | null;
  status: SubmissionStatus;
  feedback: string | null;
  student_name?: string;
  created_at?: string;
}

export interface Announcement {
  id: string;
  class_id: string | null;
  title: string;
  body: string | null;
  attachment_url: string | null;
  created_by: string | null;
  created_at: string;
  class_name?: string;
  author_name?: string;
}

export interface TimetableLink {
  scope: "school" | "grade" | "class";
  scope_id: string;
  label: string;
  url: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface ChildSummary {
  student_id: string;
  full_name: string;
  class_id: string | null;
  class_name: string | null;
  attendance: AttendanceSummary;
  recent_marks: Mark[];
}

export interface DashboardData {
  role: Role;
  // admin
  totals?: { students: number; teachers: number; classes: number };
  today_attendance?: AttendanceSummary & { total_active: number };
  // teacher
  my_classes?: (TeacherAssignment & { timetable_url?: string | null })[];
  pending_attendance?: { class_id: string; class_name: string }[];
  // student
  attendance_summary?: AttendanceSummary;
  recent_marks?: Mark[];
  my_class?: { id: string; name: string; timetable_url: string | null } | null;
  assignments?: Assignment[];
  // parent
  children?: ChildSummary[];
  // shared
  announcements?: Announcement[];
}

export const GRADE_LABELS: { min: number; label: string }[] = [
  { min: 90, label: "ممتاز" },
  { min: 80, label: "جيد جداً" },
  { min: 65, label: "جيد" },
  { min: 50, label: "مقبول" },
  { min: 0, label: "راسب" },
];

export function gradeStatus(score: number, maxScore: number): { percentage: number; label: string; pass: boolean } {
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0;
  const label = GRADE_LABELS.find((g) => percentage >= g.min)?.label ?? "راسب";
  return { percentage, label, pass: percentage >= 50 };
}
