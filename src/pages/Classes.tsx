import { useState, type FormEvent } from "react";
import type { ClassRoom, GradeLevel } from "../../shared/types";
import { api, ApiClientError } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useToast } from "../lib/toast";
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, ExternalLink, Field, Input, Modal, PageHeader, Select, Spinner } from "../components/ui";

export default function Classes() {
  const toast = useToast();
  const gradesApi = useApiData<{ items: GradeLevel[] }>("/api/grades");
  const classesApi = useApiData<{ items: ClassRoom[] }>("/api/classes");

  const [gradeModal, setGradeModal] = useState<{ open: boolean; editing: GradeLevel | null }>({ open: false, editing: null });
  const [classModal, setClassModal] = useState<{ open: boolean; editing: ClassRoom | null }>({ open: false, editing: null });
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "grade" | "class"; id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const reloadAll = () => {
    gradesApi.reload();
    classesApi.reload();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/${deleteTarget.kind === "grade" ? "grades" : "classes"}/${deleteTarget.id}`);
      toast("تم الحذف بنجاح");
      reloadAll();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  if (gradesApi.loading || classesApi.loading) return <Spinner />;
  if (gradesApi.error) return <ErrorState message={gradesApi.error} onRetry={reloadAll} />;
  if (classesApi.error) return <ErrorState message={classesApi.error} onRetry={reloadAll} />;

  const grades = gradesApi.data?.items ?? [];
  const classes = classesApi.data?.items ?? [];

  return (
    <div className="space-y-6">
      <section>
        <PageHeader
          title="المراحل الدراسية"
          action={<Button onClick={() => setGradeModal({ open: true, editing: null })}>+ إضافة مرحلة</Button>}
        />
        {grades.length === 0 ? (
          <EmptyState message="لا توجد مراحل دراسية بعد" />
        ) : (
          <div className="space-y-2">
            {grades.map((g) => (
              <Card key={g.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{g.name}</p>
                  <p className="text-xs text-slate-400">عدد الفصول: {g.classes_count ?? 0}</p>
                </div>
                <div className="flex items-center gap-2">
                  {g.timetable_url && <ExternalLink url={g.timetable_url} label="عرض الجدول" small />}
                  <Button variant="ghost" onClick={() => setGradeModal({ open: true, editing: g })}>تعديل</Button>
                  <Button variant="ghost" onClick={() => setDeleteTarget({ kind: "grade", id: g.id, name: g.name })}>حذف</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <PageHeader
          title="الفصول"
          action={<Button onClick={() => setClassModal({ open: true, editing: null })}>+ إضافة فصل</Button>}
        />
        {classes.length === 0 ? (
          <EmptyState message="لا توجد فصول بعد" />
        ) : (
          <div className="space-y-2">
            {classes.map((c) => (
              <Card key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400">
                    {c.grade_name} · عدد الطلاب: {c.students_count ?? 0}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.timetable_url ? (
                    <ExternalLink url={c.timetable_url} label="عرض جدول الحصص" small />
                  ) : (
                    <span className="text-xs text-slate-400">لم يتم إضافة جدول بعد</span>
                  )}
                  <Button variant="ghost" onClick={() => setClassModal({ open: true, editing: c })}>تعديل</Button>
                  <Button variant="ghost" onClick={() => setDeleteTarget({ kind: "class", id: c.id, name: c.name })}>حذف</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {gradeModal.open && (
        <GradeModal
          editing={gradeModal.editing}
          onClose={() => setGradeModal({ open: false, editing: null })}
          onSaved={() => {
            setGradeModal({ open: false, editing: null });
            reloadAll();
          }}
        />
      )}
      {classModal.open && (
        <ClassModal
          editing={classModal.editing}
          grades={grades}
          onClose={() => setClassModal({ open: false, editing: null })}
          onSaved={() => {
            setClassModal({ open: false, editing: null });
            reloadAll();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`حذف ${deleteTarget?.kind === "grade" ? "المرحلة" : "الفصل"}`}
        message={`هل أنت متأكد من حذف "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
}

function GradeModal({ editing, onClose, onSaved }: { editing: GradeLevel | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    level: editing ? String(editing.level) : "0",
    timetable_url: editing?.timetable_url ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { name: form.name, level: Number(form.level) || 0, timetable_url: form.timetable_url || null };
    try {
      if (editing) {
        await api.patch(`/api/grades/${editing.id}`, body);
      } else {
        await api.post("/api/grades", body);
      }
      toast("تم الحفظ بنجاح");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? "تعديل المرحلة" : "إضافة مرحلة"} open onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="اسم المرحلة" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="المستوى (للترتيب)">
          <Input type="number" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} min={0} max={20} />
        </Field>
        <Field label="رابط جدول المرحلة (خارجي)" hint="Google Sheets أو PDF أو أي رابط عام">
          <Input type="url" value={form.timetable_url} onChange={(e) => setForm({ ...form, timetable_url: e.target.value })} dir="ltr" placeholder="https://" />
        </Field>
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ClassModal({ editing, grades, onClose, onSaved }: { editing: ClassRoom | null; grades: GradeLevel[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    grade_id: editing?.grade_id ?? "",
    timetable_url: editing?.timetable_url ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.grade_id) {
      setError("اختر المرحلة");
      return;
    }
    setBusy(true);
    setError(null);
    const body = { name: form.name, grade_id: form.grade_id, timetable_url: form.timetable_url || null };
    try {
      if (editing) {
        await api.patch(`/api/classes/${editing.id}`, body);
      } else {
        await api.post("/api/classes", body);
      }
      toast("تم الحفظ بنجاح");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? "تعديل الفصل" : "إضافة فصل"} open onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="اسم الفصل" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="مثال: الأول - أ" />
        </Field>
        <Field label="المرحلة" required>
          <Select value={form.grade_id} onChange={(e) => setForm({ ...form, grade_id: e.target.value })}>
            <option value="">اختر...</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="رابط جدول الحصص (خارجي)" hint="Google Sheets أو PDF أو أي رابط عام">
          <Input type="url" value={form.timetable_url} onChange={(e) => setForm({ ...form, timetable_url: e.target.value })} dir="ltr" placeholder="https://" />
        </Field>
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </div>
      </form>
    </Modal>
  );
}
