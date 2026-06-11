import { useMemo, useState, type FormEvent } from "react";
import type { Assignment, AssignmentSubmission, ClassRoom, Paginated, Subject } from "../../shared/types";
import { api, ApiClientError, qs } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { formatDate, SUBMISSION_LABELS } from "../lib/labels";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, ExternalLink, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, Textarea } from "../components/ui";

type AssignmentRow = Assignment & { my_submission_id?: string | null; my_submission_status?: string | null };

export default function Assignments() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = user?.role === "super_admin" || user?.role === "school_admin" || user?.role === "teacher";
  const isStudent = user?.role === "student";

  const [page, setPage] = useState(1);
  const [classId, setClassId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [submitTarget, setSubmitTarget] = useState<AssignmentRow | null>(null);
  const [subsTarget, setSubsTarget] = useState<AssignmentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentRow | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: classesData } = useApiData<{ items: ClassRoom[] }>(canManage ? "/api/classes" : null);
  const path = useMemo(() => `/api/assignments${qs({ page, class_id: classId })}`, [page, classId]);
  const { data, loading, error, reload } = useApiData<Paginated<AssignmentRow>>(path);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/assignments/${deleteTarget.id}`);
      toast("تم حذف الواجب");
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
      <PageHeader
        title="الواجبات"
        action={canManage ? <Button onClick={() => setCreateOpen(true)}>+ واجب جديد</Button> : undefined}
      />

      {canManage && (
        <div className="mb-4">
          <Select value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }} className="!w-auto">
            <option value="">كل الفصول</option>
            {classesData?.items.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState message="لا توجد واجبات بعد" />
      ) : (
        <>
          <div className="space-y-2">
            {data.items.map((a) => (
              <Card key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{a.title}</p>
                    <p className="text-xs text-slate-400">
                      {a.class_name} {a.subject_name ? `· ${a.subject_name}` : ""} {a.teacher_name ? `· ${a.teacher_name}` : ""}
                      {a.due_date ? ` · التسليم: ${formatDate(a.due_date)}` : ""}
                    </p>
                    {a.description && <p className="mt-1 text-sm text-slate-600">{a.description}</p>}
                  </div>
                  {isStudent &&
                    (a.my_submission_status ? (
                      <Badge className={a.my_submission_status === "reviewed" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}>
                        {SUBMISSION_LABELS[a.my_submission_status as keyof typeof SUBMISSION_LABELS] ?? a.my_submission_status}
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800">لم يُسلّم</Badge>
                    ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {a.resource_url ? <ExternalLink url={a.resource_url} label="فتح الملف" small /> : <span className="text-xs text-slate-400">لا توجد مرفقات</span>}
                  <div className="flex-1" />
                  {isStudent && (
                    <Button variant="secondary" onClick={() => setSubmitTarget(a)}>
                      {a.my_submission_status ? "عرض / تعديل التسليم" : "تسليم الواجب"}
                    </Button>
                  )}
                  {canManage && (
                    <>
                      <Button variant="ghost" onClick={() => setSubsTarget(a)}>التسليمات ({a.submissions_count ?? 0})</Button>
                      <Button variant="ghost" onClick={() => setDeleteTarget(a)}>حذف</Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
        </>
      )}

      {createOpen && (
        <CreateAssignmentModal
          classes={classesData?.items ?? []}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      )}
      {submitTarget && (
        <SubmitModal
          assignment={submitTarget}
          onClose={() => setSubmitTarget(null)}
          onSaved={() => {
            setSubmitTarget(null);
            reload();
          }}
        />
      )}
      {subsTarget && <SubmissionsModal assignment={subsTarget} onClose={() => setSubsTarget(null)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف الواجب"
        message={`سيتم حذف "${deleteTarget?.title}" وجميع تسليماته. هل أنت متأكد؟`}
        confirmLabel="حذف"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
}

const EMPTY_FORM = { title: "", description: "", class_id: "", subject_id: "", due_date: "", resource_url: "" };

function CreateAssignmentModal({ classes, onClose, onSaved }: { classes: ClassRoom[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: subjectsData } = useApiData<{ items: Subject[] }>("/api/subjects");

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.class_id) {
      setError("اختر الفصل");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/assignments", {
        title: form.title,
        description: form.description || null,
        class_id: form.class_id,
        subject_id: form.subject_id || null,
        due_date: form.due_date || null,
        resource_url: form.resource_url || null,
      });
      toast("تم إنشاء الواجب");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="واجب جديد" open onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="عنوان الواجب" required>
          <Input value={form.title} onChange={set("title")} required />
        </Field>
        <Field label="الوصف">
          <Textarea value={form.description} onChange={set("description")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الفصل" required>
            <Select value={form.class_id} onChange={set("class_id")}>
              <option value="">اختر...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="المادة">
            <Select value={form.subject_id} onChange={set("subject_id")}>
              <option value="">—</option>
              {subjectsData?.items.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="تاريخ التسليم">
          <Input type="date" value={form.due_date} onChange={set("due_date")} />
        </Field>
        <Field label="رابط مرفقات الواجب (خارجي)" hint="ورقة عمل أو ملف خارجي — لا يتم رفع ملفات">
          <Input type="url" value={form.resource_url} onChange={set("resource_url")} dir="ltr" placeholder="https://" />
        </Field>
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "إنشاء"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SubmitModal({ assignment, onClose, onSaved }: { assignment: AssignmentRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data, loading } = useApiData<{ assignment: Assignment; my_submission: AssignmentSubmission | null }>(`/api/assignments/${assignment.id}`);
  const [text, setText] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sub = data?.my_submission ?? null;
  const reviewed = sub?.status === "reviewed";
  const textValue = text ?? sub?.submission_text ?? "";
  const urlValue = url ?? sub?.submission_url ?? "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/assignment-submissions", {
        assignment_id: assignment.id,
        submission_text: textValue || null,
        submission_url: urlValue || null,
      });
      toast("تم تسليم الواجب");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`تسليم: ${assignment.title}`} open onClose={onClose}>
      {loading ? (
        <Spinner />
      ) : (
        <form onSubmit={submit}>
          {reviewed && (
            <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">تمت مراجعة تسليمك ولا يمكن تعديله.</p>
          )}
          {sub?.feedback && (
            <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">ملاحظة المعلم: {sub.feedback}</p>
          )}
          <Field label="الإجابة النصية">
            <Textarea value={textValue} onChange={(e) => setText(e.target.value)} disabled={reviewed} rows={4} />
          </Field>
          <Field label="رابط خارجي للإجابة" hint="مثال: رابط Google Docs — لا يتم رفع ملفات في المنصة">
            <Input type="url" value={urlValue} onChange={(e) => setUrl(e.target.value)} dir="ltr" placeholder="https://" disabled={reviewed} />
          </Field>
          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>إغلاق</Button>
            {!reviewed && (
              <Button type="submit" disabled={busy}>{busy ? "جارٍ التسليم..." : "تسليم"}</Button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}

function SubmissionsModal({ assignment, onClose }: { assignment: AssignmentRow; onClose: () => void }) {
  const toast = useToast();
  const { data, loading, error, reload } = useApiData<{ items: AssignmentSubmission[] }>(`/api/assignments/${assignment.id}/submissions`);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const review = async (sub: AssignmentSubmission) => {
    setBusyId(sub.id);
    try {
      await api.patch(`/api/assignment-submissions/${sub.id}`, {
        feedback: feedbacks[sub.id] ?? sub.feedback ?? null,
        status: "reviewed",
      });
      toast("تم حفظ المراجعة");
      reload();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal title={`تسليمات: ${assignment.title}`} open onClose={onClose}>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState message="لا توجد تسليمات بعد" />
      ) : (
        <div className="space-y-3">
          {data.items.map((sub) => (
            <div key={sub.id} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-slate-800">{sub.student_name}</p>
                <Badge className={sub.status === "reviewed" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}>
                  {SUBMISSION_LABELS[sub.status]}
                </Badge>
              </div>
              {sub.submission_text && <p className="mb-2 whitespace-pre-wrap text-sm text-slate-600">{sub.submission_text}</p>}
              {sub.submission_url && (
                <div className="mb-2">
                  <ExternalLink url={sub.submission_url} label="فتح رابط الإجابة" small />
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="ملاحظات المعلم..."
                  value={feedbacks[sub.id] ?? sub.feedback ?? ""}
                  onChange={(e) => setFeedbacks((f) => ({ ...f, [sub.id]: e.target.value }))}
                  className="flex-1"
                />
                <Button variant="secondary" onClick={() => review(sub)} disabled={busyId === sub.id}>
                  {busyId === sub.id ? "..." : "مراجعة"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
