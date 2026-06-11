import { useMemo, useState, type FormEvent } from "react";
import type { ClassRoom, DashboardData, Exam, Mark, Paginated, Subject } from "../../shared/types";
import { gradeStatus } from "../../shared/types";
import { api, ApiClientError, qs } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { formatDate } from "../lib/labels";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, ExternalLink, Field, Input, Modal, PageHeader, Pagination, Select, Spinner } from "../components/ui";

export default function Grades() {
  const { user } = useAuth();
  const canManage = user?.role === "super_admin" || user?.role === "school_admin" || user?.role === "teacher";
  return (
    <div>
      <PageHeader title="الدرجات والاختبارات" />
      {canManage ? <ExamsManager /> : <MyMarks />}
    </div>
  );
}

// ---- student/parent view ----

function MarksList({ studentId }: { studentId: string | null }) {
  const [page, setPage] = useState(1);
  const path = `/api/marks${qs({ page, student_id: studentId ?? undefined })}`;
  const { data, loading, error, reload } = useApiData<Paginated<Mark>>(path);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || data.items.length === 0) return <EmptyState message="لا توجد درجات بعد" />;

  return (
    <>
      <div className="space-y-2">
        {data.items.map((m) => {
          const g = gradeStatus(m.score, m.max_score ?? 100);
          return (
            <Card key={m.id} className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-800">{m.exam_title}</p>
                <p className="text-xs text-slate-400">
                  {m.subject_name} · {formatDate(m.exam_date)}
                </p>
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-800">
                  {m.score} / {m.max_score} <span className="text-xs font-normal text-slate-400">({g.percentage}%)</span>
                </p>
                <Badge className={g.pass ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>{g.label}</Badge>
              </div>
            </Card>
          );
        })}
      </div>
      <Pagination page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
    </>
  );
}

function MyMarks() {
  const { user } = useAuth();
  const isParent = user?.role === "parent";
  const { data: dash } = useApiData<DashboardData>(isParent ? "/api/dashboard" : null);
  const [childId, setChildId] = useState("");

  if (!isParent) return <MarksList studentId={null} />;
  const children = dash?.children ?? [];
  const selected = childId || children[0]?.student_id || "";
  return (
    <div>
      {children.length > 1 && (
        <Select value={selected} onChange={(e) => setChildId(e.target.value)} className="mb-4 !w-auto">
          {children.map((c) => (
            <option key={c.student_id} value={c.student_id}>{c.full_name}</option>
          ))}
        </Select>
      )}
      {children.length === 0 ? <EmptyState message="لا يوجد أبناء مرتبطون بحسابك" /> : selected && <MarksList key={selected} studentId={selected} />}
    </div>
  );
}

// ---- teacher/admin view ----

const EMPTY_EXAM = { title: "", class_id: "", subject_id: "", exam_date: "", max_score: "100", resource_url: "" };

function ExamsManager() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [classId, setClassId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_EXAM);
  const [marksExam, setMarksExam] = useState<Exam | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: classesData } = useApiData<{ items: ClassRoom[] }>("/api/classes");
  const { data: subjectsData } = useApiData<{ items: Subject[] }>("/api/subjects");
  const path = useMemo(() => `/api/exams${qs({ page, class_id: classId })}`, [page, classId]);
  const { data, loading, error, reload } = useApiData<Paginated<Exam>>(path);

  const set = (k: keyof typeof EMPTY_EXAM) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.class_id || !form.subject_id) {
      setFormError("اختر الفصل والمادة");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await api.post("/api/exams", {
        title: form.title,
        class_id: form.class_id,
        subject_id: form.subject_id,
        exam_date: form.exam_date || null,
        max_score: Number(form.max_score) || 100,
        resource_url: form.resource_url || null,
      });
      toast("تم إنشاء الاختبار");
      setModalOpen(false);
      setForm(EMPTY_EXAM);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/exams/${deleteTarget.id}`);
      toast("تم حذف الاختبار");
      reload();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }} className="!w-auto">
          <option value="">كل الفصول</option>
          {classesData?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <div className="flex-1" />
        <Button onClick={() => { setFormError(null); setModalOpen(true); }}>+ اختبار جديد</Button>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState message="لا توجد اختبارات بعد" />
      ) : (
        <>
          <div className="space-y-2">
            {data.items.map((exam) => (
              <Card key={exam.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{exam.title}</p>
                  <p className="text-xs text-slate-400">
                    {exam.class_name} · {exam.subject_name} · {formatDate(exam.exam_date)} · الدرجة العظمى: {exam.max_score}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {exam.resource_url && <ExternalLink url={exam.resource_url} label="فتح الملف" small />}
                  <Button variant="ghost" onClick={() => setMarksExam(exam)}>
                    الدرجات ({exam.marks_count ?? 0})
                  </Button>
                  <Button variant="ghost" onClick={() => setDeleteTarget(exam)}>حذف</Button>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
        </>
      )}

      <Modal title="اختبار جديد" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={submit}>
          <Field label="عنوان الاختبار" required>
            <Input value={form.title} onChange={set("title")} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الفصل" required>
              <Select value={form.class_id} onChange={set("class_id")}>
                <option value="">اختر...</option>
                {classesData?.items.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="المادة" required>
              <Select value={form.subject_id} onChange={set("subject_id")}>
                <option value="">اختر...</option>
                {subjectsData?.items.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="تاريخ الاختبار">
              <Input type="date" value={form.exam_date} onChange={set("exam_date")} />
            </Field>
            <Field label="الدرجة العظمى" required>
              <Input type="number" value={form.max_score} onChange={set("max_score")} min={1} max={1000} required />
            </Field>
          </div>
          <Field label="رابط مرفقات الاختبار (خارجي)" hint="نموذج مراجعة أو ملف خارجي — لا يتم رفع ملفات">
            <Input type="url" value={form.resource_url} onChange={set("resource_url")} dir="ltr" placeholder="https://" />
          </Field>
          {formError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "إنشاء"}</Button>
          </div>
        </form>
      </Modal>

      {marksExam && (
        <MarksEntryModal
          exam={marksExam}
          onClose={() => setMarksExam(null)}
          onSaved={() => {
            setMarksExam(null);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف الاختبار"
        message={`سيتم حذف "${deleteTarget?.title}" وجميع درجاته. هل أنت متأكد؟`}
        confirmLabel="حذف"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
}

interface MarkRow {
  student_id: string;
  student_name: string;
  student_number: string | null;
  mark_id: string | null;
  score: number | null;
}

function MarksEntryModal({ exam, onClose, onSaved }: { exam: Exam; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data, loading, error, reload } = useApiData<{ items: MarkRow[]; max_score: number }>(`/api/exams/${exam.id}/marks`);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const valueFor = (row: MarkRow): string => scores[row.student_id] ?? (row.score !== null ? String(row.score) : "");

  const save = async () => {
    if (!data) return;
    const marks = data.items.map((row) => ({
      student_id: row.student_id,
      score: valueFor(row) === "" ? null : Number(valueFor(row)),
    }));
    setBusy(true);
    try {
      await api.post("/api/marks", { exam_id: exam.id, marks });
      toast("تم حفظ الدرجات");
      onSaved();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`درجات: ${exam.title}`} open onClose={onClose}>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState message="لا يوجد طلاب في فصل هذا الاختبار" />
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-400">الدرجة العظمى: {data.max_score} — اترك الحقل فارغاً لعدم رصد درجة.</p>
          <div className="space-y-2">
            {data.items.map((row) => (
              <div key={row.student_id} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">{row.student_name}</span>
                <Input
                  type="number"
                  value={valueFor(row)}
                  onChange={(e) => setScores((s) => ({ ...s, [row.student_id]: e.target.value }))}
                  min={0}
                  max={data.max_score}
                  step="0.5"
                  className="!w-24"
                  aria-label={`درجة ${row.student_name}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>إلغاء</Button>
            <Button onClick={save} disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ الدرجات"}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
