import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AttendanceRecord, AttendanceStatus, AttendanceSummary, ClassRoom, Paginated, School, Subject } from "../../shared/types";
import { api, ApiClientError, qs } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { ATTENDANCE_COLORS, ATTENDANCE_LABELS, formatDate, todayISO } from "../lib/labels";
import { Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, Pagination, Select, Spinner } from "../components/ui";

const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

interface RosterRow {
  student_id: string;
  student_name: string;
  student_number: string | null;
  record_id: string | null;
  status: AttendanceStatus | null;
  note: string | null;
  subject_id: string | null;
}

export default function Attendance() {
  const { user } = useAuth();
  const canMark = user?.role === "super_admin" || user?.role === "school_admin" || user?.role === "teacher";
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<"mark" | "reports">(canMark ? "mark" : "reports");

  return (
    <div>
      <PageHeader title="الحضور والغياب" />
      {canMark && (
        <div className="mb-4 flex gap-2">
          <Button variant={tab === "mark" ? "primary" : "secondary"} onClick={() => setTab("mark")}>
            تسجيل الحضور
          </Button>
          <Button variant={tab === "reports" ? "primary" : "secondary"} onClick={() => setTab("reports")}>
            التقارير
          </Button>
        </div>
      )}
      {canMark && tab === "mark" ? <MarkAttendance initialClassId={searchParams.get("class_id") ?? ""} /> : <Reports canFilter={canMark} />}
    </div>
  );
}

function MarkAttendance({ initialClassId }: { initialClassId: string }) {
  const toast = useToast();
  const [classId, setClassId] = useState(initialClassId);
  const [date, setDate] = useState(todayISO());
  const [session, setSession] = useState(1);
  const [subjectId, setSubjectId] = useState("");
  const [edits, setEdits] = useState<Record<string, AttendanceStatus>>({});
  const [busy, setBusy] = useState(false);

  const { data: schoolData } = useApiData<{ school: School }>("/api/school");
  const mode = schoolData?.school.attendance_mode ?? "daily";
  const sessionsPerDay = schoolData?.school.sessions_per_day ?? 6;
  const perSession = mode === "per_session";

  const { data: classesData } = useApiData<{ items: ClassRoom[] }>("/api/classes");
  const { data: subjectsData } = useApiData<{ items: Subject[] }>(perSession ? "/api/subjects" : null);

  const rosterPath =
    classId && date ? `/api/attendance${qs({ class_id: classId, date, session: perSession ? session : undefined })}` : null;
  const { data: roster, loading, error, reload } = useApiData<{ items: RosterRow[] }>(rosterPath);

  // Reset chosen subject when the marking context changes; then prefill from any saved session.
  useEffect(() => {
    setSubjectId("");
  }, [classId, date, session]);
  useEffect(() => {
    const existing = roster?.items.find((r) => r.subject_id)?.subject_id;
    if (existing) setSubjectId(existing);
  }, [roster]);

  const setStatus = (studentId: string, status: AttendanceStatus) => setEdits((e) => ({ ...e, [studentId]: status }));

  const effectiveStatus = (row: RosterRow): AttendanceStatus | null => edits[row.student_id] ?? row.status;

  const markAll = (status: AttendanceStatus) => {
    if (!roster) return;
    const all: Record<string, AttendanceStatus> = {};
    for (const row of roster.items) all[row.student_id] = status;
    setEdits(all);
  };

  const save = async () => {
    if (!roster || !classId) return;
    const records = roster.items
      .map((row) => ({ student_id: row.student_id, status: effectiveStatus(row) }))
      .filter((r): r is { student_id: string; status: AttendanceStatus } => !!r.status);
    if (!records.length) {
      toast("حدد حالة حضور لطالب واحد على الأقل", "error");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/attendance", {
        class_id: classId,
        date,
        session_no: perSession ? session : 0,
        subject_id: perSession ? subjectId || null : null,
        records,
      });
      toast("تم حفظ الحضور بنجاح");
      setEdits({});
      reload();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={classId} onChange={(e) => { setClassId(e.target.value); setEdits({}); }} className="!w-auto flex-1 min-w-36">
          <option value="">اختر الفصل...</option>
          {classesData?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setEdits({}); }} className="!w-auto" />
        {perSession && (
          <>
            <Select
              value={session}
              onChange={(e) => { setSession(Number(e.target.value)); setEdits({}); }}
              className="!w-auto"
              aria-label="الحصة"
            >
              {Array.from({ length: sessionsPerDay }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>الحصة {n}</option>
              ))}
            </Select>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="!w-auto" aria-label="المادة">
              <option value="">بدون مادة</option>
              {subjectsData?.items.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </>
        )}
      </div>

      {!classId ? (
        <EmptyState message="اختر الفصل والتاريخ لعرض قائمة الطلاب" />
      ) : loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !roster || roster.items.length === 0 ? (
        <EmptyState message="لا يوجد طلاب نشطون في هذا الفصل" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">تحديد الكل:</span>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => markAll(s)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${ATTENDANCE_COLORS[s]}`}
              >
                {ATTENDANCE_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {roster.items.map((row) => {
              const current = effectiveStatus(row);
              return (
                <Card key={row.student_id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{row.student_name}</p>
                    {row.student_number && <p className="text-xs text-slate-400" dir="ltr">{row.student_number}</p>}
                  </div>
                  <div className="flex gap-1">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(row.student_id, s)}
                        aria-pressed={current === s}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          current === s ? ATTENDANCE_COLORS[s] + " ring-2 ring-offset-1 ring-slate-300" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {ATTENDANCE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
          <div className="sticky bottom-20 md:bottom-4 mt-4">
            <Button onClick={save} disabled={busy} className="w-full shadow-lg">
              {busy ? "جارٍ الحفظ..." : "حفظ الحضور"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Reports({ canFilter }: { canFilter: boolean }) {
  const [page, setPage] = useState(1);
  const [classId, setClassId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: classesData } = useApiData<{ items: ClassRoom[] }>(canFilter ? "/api/classes" : null);
  const path = useMemo(() => `/api/attendance/reports${qs({ page, class_id: classId, from, to })}`, [page, classId, from, to]);
  const { data, loading, error, reload } = useApiData<Paginated<AttendanceRecord> & { summary: AttendanceSummary }>(path);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {canFilter && (
          <Select value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }} className="!w-auto">
            <option value="">كل الفصول</option>
            {classesData?.items.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        )}
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="!w-auto" aria-label="من تاريخ" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="!w-auto" aria-label="إلى تاريخ" />
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? null : (
        <>
          <div className="mb-4 grid grid-cols-4 gap-2 text-center">
            {STATUSES.map((s) => (
              <Card key={s}>
                <p className="text-xl font-bold text-slate-800">{data.summary[s]}</p>
                <Badge className={ATTENDANCE_COLORS[s]}>{ATTENDANCE_LABELS[s]}</Badge>
              </Card>
            ))}
          </div>
          {data.items.length === 0 ? (
            <EmptyState message="لا توجد سجلات حضور مطابقة" />
          ) : (
            <>
              <div className="space-y-2">
                {data.items.map((r) => (
                  <Card key={r.id} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{r.student_name}</p>
                      <p className="text-xs text-slate-400">
                        {r.class_name} · {formatDate(r.date)}
                        {r.session_no > 0 ? ` · الحصة ${r.session_no}` : ""}
                        {r.subject_name ? ` · ${r.subject_name}` : ""}
                        {r.note ? ` · ${r.note}` : ""}
                      </p>
                    </div>
                    <Badge className={ATTENDANCE_COLORS[r.status]}>{ATTENDANCE_LABELS[r.status]}</Badge>
                  </Card>
                ))}
              </div>
              <Pagination page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
            </>
          )}
        </>
      )}
    </div>
  );
}
