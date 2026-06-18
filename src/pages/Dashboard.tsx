import { Link } from "react-router-dom";
import type { Announcement, DashboardData } from "../../shared/types";
import { gradeStatus } from "../../shared/types";
import { useApiData } from "../lib/useApi";
import { useAuth } from "../lib/auth";
import { ATTENDANCE_COLORS, ATTENDANCE_LABELS, formatDate, formatDateTime } from "../lib/labels";
import { Badge, Card, EmptyState, ErrorState, ExternalLink, PageHeader, Spinner } from "../components/ui";

function StatCard({ label, value, color = "text-teal-700" }: { label: string; value: number | string; color?: string }) {
  return (
    <Card className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </Card>
  );
}

function AttendanceStats({ s }: { s: { present: number; absent: number; late: number; excused: number } }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <StatCard label={ATTENDANCE_LABELS.present} value={s.present} color="text-emerald-600" />
      <StatCard label={ATTENDANCE_LABELS.absent} value={s.absent} color="text-red-600" />
      <StatCard label={ATTENDANCE_LABELS.late} value={s.late} color="text-amber-600" />
      <StatCard label={ATTENDANCE_LABELS.excused} value={s.excused} color="text-sky-600" />
    </div>
  );
}

function AnnouncementsList({ items }: { items: Announcement[] }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold text-slate-700">آخر الإعلانات</h2>
        <Link to="/announcements" className="text-sm font-medium text-teal-700 hover:underline">
          عرض الكل
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState message="لا توجد إعلانات بعد" />
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{a.title}</p>
                  {a.body && <p className="mt-1 text-sm text-slate-500 line-clamp-2">{a.body}</p>}
                  <p className="mt-1 text-xs text-slate-400">
                    {a.class_name ? `فصل ${a.class_name}` : "عام"} · {formatDateTime(a.created_at)}
                  </p>
                </div>
                {a.attachment_url && <ExternalLink url={a.attachment_url} label="فتح الرابط" small />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApiData<DashboardData>("/api/dashboard");

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || !user) return null;

  return (
    <div className="space-y-6">
      <PageHeader title={`مرحباً، ${user.full_name}`} />

      {/* admin */}
      {data.totals && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="الطلاب" value={data.totals.students} />
            <StatCard label="المعلمون" value={data.totals.teachers} />
            <StatCard label="الفصول" value={data.totals.classes} />
          </div>
          {data.today_attendance && (
            <section>
              <h2 className="mb-2 font-bold text-slate-700">حضور اليوم</h2>
              <AttendanceStats s={data.today_attendance} />
              <p className="mt-2 text-xs text-slate-400">
                إجمالي الطلاب النشطين: {data.today_attendance.total_active} · المسجّل اليوم:{" "}
                {data.today_attendance.present + data.today_attendance.absent + data.today_attendance.late + data.today_attendance.excused}
              </p>
            </section>
          )}
        </>
      )}

      {/* teacher */}
      {data.my_classes && (
        <section>
          <h2 className="mb-2 font-bold text-slate-700">فصولي وموادي</h2>
          {data.my_classes.length === 0 ? (
            <EmptyState message="لم يتم إسناد فصول لك بعد" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {data.my_classes.map((c) => (
                <Card key={c.id} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{c.class_name}</p>
                    <p className="text-sm text-slate-500">{c.subject_name}</p>
                  </div>
                  {c.timetable_url ? (
                    <ExternalLink url={c.timetable_url} label="عرض الجدول" small />
                  ) : (
                    <span className="text-xs text-slate-400">لا يوجد جدول</span>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
      {data.pending_attendance && data.pending_attendance.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="font-semibold text-amber-800">تحضير اليوم لم يُسجّل بعد:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.pending_attendance.map((p) => (
              <Link
                key={p.class_id}
                to={`/attendance?class_id=${p.class_id}`}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-amber-800 border border-amber-300 hover:bg-amber-100"
              >
                {p.class_name}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* student */}
      {data.attendance_summary && (
        <section>
          <h2 className="mb-2 font-bold text-slate-700">ملخص حضوري</h2>
          <AttendanceStats s={data.attendance_summary} />
        </section>
      )}
      {data.my_class !== undefined && (
        <Card className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm text-slate-500">فصلي</p>
            <p className="font-semibold text-slate-800">{data.my_class ? data.my_class.name : "غير مسجل في فصل"}</p>
          </div>
          {data.my_class?.timetable_url ? (
            <ExternalLink url={data.my_class.timetable_url} label="عرض جدول الحصص" small />
          ) : (
            <span className="text-xs text-slate-400">لم يتم إضافة جدول بعد</span>
          )}
        </Card>
      )}
      {data.recent_marks && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold text-slate-700">آخر الدرجات</h2>
            <Link to="/grades" className="text-sm font-medium text-teal-700 hover:underline">
              عرض الكل
            </Link>
          </div>
          {data.recent_marks.length === 0 ? (
            <EmptyState message="لا توجد درجات بعد" />
          ) : (
            <div className="space-y-2">
              {data.recent_marks.map((m) => {
                const g = gradeStatus(m.score, m.max_score ?? 100);
                return (
                  <Card key={m.id} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{m.exam_title}</p>
                      <p className="text-xs text-slate-400">{m.subject_name}</p>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-800">
                        {m.score} / {m.max_score}
                      </p>
                      <Badge className={g.pass ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>{g.label}</Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}
      {data.assignments && data.assignments.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold text-slate-700">الواجبات</h2>
            <Link to="/assignments" className="text-sm font-medium text-teal-700 hover:underline">
              عرض الكل
            </Link>
          </div>
          <div className="space-y-2">
            {data.assignments.map((a) => (
              <Card key={a.id} className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{a.title}</p>
                  <p className="text-xs text-slate-400">
                    {a.subject_name ?? ""} {a.due_date ? `· التسليم: ${formatDate(a.due_date)}` : ""}
                  </p>
                </div>
                {(a as { my_submission_status?: string }).my_submission_status ? (
                  <Badge className="bg-emerald-100 text-emerald-800">تم التسليم</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800">لم يُسلّم</Badge>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* parent */}
      {data.children && (
        <section>
          <h2 className="mb-2 font-bold text-slate-700">أبنائي</h2>
          {data.children.length === 0 ? (
            <EmptyState message="لا يوجد أبناء مرتبطون بحسابك" />
          ) : (
            <div className="space-y-3">
              {data.children.map((child) => (
                <Card key={child.student_id}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">{child.full_name}</p>
                      <p className="text-xs text-slate-400">{child.class_name ?? "غير مسجل في فصل"}</p>
                    </div>
                  </div>
                  <div className="mb-2 grid grid-cols-4 gap-1 text-center">
                    {(["present", "absent", "late", "excused"] as const).map((k) => (
                      <div key={k} className={`rounded-lg px-1 py-1.5 text-xs font-semibold ${ATTENDANCE_COLORS[k]}`}>
                        {ATTENDANCE_LABELS[k]}: {child.attendance[k]}
                      </div>
                    ))}
                  </div>
                  {child.recent_marks.length > 0 && (
                    <div className="space-y-1">
                      {child.recent_marks.map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">
                            {m.exam_title} <span className="text-xs text-slate-400">({m.subject_name})</span>
                          </span>
                          <span className="font-semibold text-slate-800">
                            {m.score} / {m.max_score}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {data.announcements && <AnnouncementsList items={data.announcements} />}
    </div>
  );
}
