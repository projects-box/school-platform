import { useMemo, useState, type FormEvent } from "react";
import type { Announcement, ClassRoom, Paginated } from "../../shared/types";
import { api, ApiClientError, qs } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { formatDateTime } from "../lib/labels";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, ExternalLink, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, Textarea } from "../components/ui";

export default function Announcements() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "school_admin";
  const canCreate = isAdmin || user?.role === "teacher";

  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ open: boolean; editing: Announcement | null }>({ open: false, editing: null });
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);

  const path = useMemo(() => `/api/announcements${qs({ page })}`, [page]);
  const { data, loading, error, reload } = useApiData<Paginated<Announcement>>(path);

  const canEdit = (a: Announcement) => isAdmin || a.created_by === user?.id;

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/announcements/${deleteTarget.id}`);
      toast("تم حذف الإعلان");
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
        title="الإعلانات"
        action={canCreate ? <Button onClick={() => setModal({ open: true, editing: null })}>+ إعلان جديد</Button> : undefined}
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState message="لا توجد إعلانات بعد" />
      ) : (
        <>
          <div className="space-y-2">
            {data.items.map((a) => (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-800">{a.title}</p>
                      <Badge className={a.class_id ? "bg-violet-100 text-violet-800" : "bg-teal-100 text-teal-800"}>
                        {a.class_name ? `فصل ${a.class_name}` : "عام"}
                      </Badge>
                    </div>
                    {a.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>}
                    <p className="mt-1 text-xs text-slate-400">
                      {a.author_name ?? ""} · {formatDateTime(a.created_at)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {a.attachment_url ? (
                    <ExternalLink url={a.attachment_url} label="فتح الرابط" small />
                  ) : (
                    <span className="text-xs text-slate-400">لا توجد مرفقات</span>
                  )}
                  <div className="flex-1" />
                  {canEdit(a) && (
                    <>
                      <Button variant="ghost" onClick={() => setModal({ open: true, editing: a })}>تعديل</Button>
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

      {modal.open && (
        <AnnouncementModal
          editing={modal.editing}
          isAdmin={isAdmin}
          onClose={() => setModal({ open: false, editing: null })}
          onSaved={() => {
            setModal({ open: false, editing: null });
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف الإعلان"
        message={`هل أنت متأكد من حذف "${deleteTarget?.title}"؟`}
        confirmLabel="حذف"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
}

function AnnouncementModal({ editing, isAdmin, onClose, onSaved }: { editing: Announcement | null; isAdmin: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data: classesData } = useApiData<{ items: ClassRoom[] }>("/api/classes");
  const [form, setForm] = useState({
    title: editing?.title ?? "",
    body: editing?.body ?? "",
    class_id: editing?.class_id ?? "",
    attachment_url: editing?.attachment_url ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !editing && !form.class_id) {
      setError("اختر الفصل — المعلم ينشر إعلانات لفصوله فقط");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await api.patch(`/api/announcements/${editing.id}`, {
          title: form.title,
          body: form.body || null,
          attachment_url: form.attachment_url || null,
        });
      } else {
        await api.post("/api/announcements", {
          title: form.title,
          body: form.body || null,
          class_id: form.class_id || null,
          attachment_url: form.attachment_url || null,
        });
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
    <Modal title={editing ? "تعديل الإعلان" : "إعلان جديد"} open onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="العنوان" required>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </Field>
        <Field label="نص الإعلان">
          <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} />
        </Field>
        {!editing && (
          <Field label="الجهة المستهدفة" required={!isAdmin}>
            <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
              {isAdmin && <option value="">عام — كل المدرسة</option>}
              {!isAdmin && <option value="">اختر الفصل...</option>}
              {classesData?.items.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="رابط مرفق (خارجي)" hint="لا يتم رفع ملفات — روابط خارجية فقط">
          <Input type="url" value={form.attachment_url} onChange={(e) => setForm({ ...form, attachment_url: e.target.value })} dir="ltr" placeholder="https://" />
        </Field>
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "نشر"}</Button>
        </div>
      </form>
    </Modal>
  );
}
