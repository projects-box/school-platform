import { useState, type FormEvent } from "react";
import type { Subject } from "../../shared/types";
import { api, ApiClientError } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useToast } from "../lib/toast";
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Spinner } from "../components/ui";

export default function Subjects() {
  const toast = useToast();
  const { data, loading, error, reload } = useApiData<{ items: Subject[] }>("/api/subjects");
  const [modal, setModal] = useState<{ open: boolean; editing: Subject | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ name: "", code: "" });
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openModal = (editing: Subject | null) => {
    setForm({ name: editing?.name ?? "", code: editing?.code ?? "" });
    setFormError(null);
    setModal({ open: true, editing });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      if (modal.editing) {
        await api.patch(`/api/subjects/${modal.editing.id}`, { name: form.name, code: form.code || null });
      } else {
        await api.post("/api/subjects", { name: form.name, code: form.code || null });
      }
      toast("تم الحفظ بنجاح");
      setModal({ open: false, editing: null });
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
      await api.delete(`/api/subjects/${deleteTarget.id}`);
      toast("تم حذف المادة");
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
      <PageHeader title="المواد الدراسية" action={<Button onClick={() => openModal(null)}>+ إضافة مادة</Button>} />

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState message="لا توجد مواد بعد" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {data.items.map((s) => (
            <Card key={s.id} className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-800">{s.name}</p>
                {s.code && <p className="text-xs text-slate-400" dir="ltr">{s.code}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" onClick={() => openModal(s)}>تعديل</Button>
                <Button variant="ghost" onClick={() => setDeleteTarget(s)}>حذف</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal title={modal.editing ? "تعديل المادة" : "إضافة مادة"} open={modal.open} onClose={() => setModal({ open: false, editing: null })}>
        <form onSubmit={submit}>
          <Field label="اسم المادة" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="الرمز">
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} dir="ltr" placeholder="MATH" />
          </Field>
          {formError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal({ open: false, editing: null })}>إلغاء</Button>
            <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف المادة"
        message={`هل أنت متأكد من حذف "${deleteTarget?.name}"؟`}
        confirmLabel="حذف"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
}
