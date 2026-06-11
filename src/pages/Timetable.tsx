import { useState, type FormEvent } from "react";
import type { TimetableLink } from "../../shared/types";
import { api, ApiClientError } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { Button, Card, EmptyState, ErrorState, ExternalLink, Field, Input, Modal, PageHeader, Spinner } from "../components/ui";

const PATCH_PATHS: Record<TimetableLink["scope"], (id: string) => { path: string; field: string }> = {
  school: () => ({ path: "/api/school", field: "general_timetable_url" }),
  grade: (id) => ({ path: `/api/grades/${id}`, field: "timetable_url" }),
  class: (id) => ({ path: `/api/classes/${id}`, field: "timetable_url" }),
};

export default function Timetable() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "school_admin";
  const { data, loading, error, reload } = useApiData<{ items: TimetableLink[] }>("/api/timetable");

  const [editTarget, setEditTarget] = useState<TimetableLink | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openEdit = (link: TimetableLink) => {
    setUrl(link.url ?? "");
    setFormError(null);
    setEditTarget(link);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setBusy(true);
    setFormError(null);
    try {
      const { path, field } = PATCH_PATHS[editTarget.scope](editTarget.scope_id);
      await api.patch(path, { [field]: url || null });
      toast("تم حفظ رابط الجدول");
      setEditTarget(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader title="جدول الحصص" />
      <p className="mb-4 text-sm text-slate-500">
        روابط الجداول الخارجية (Google Sheets أو PDF أو غيرها). {isAdmin ? "يمكنك تعديل الروابط من هنا." : ""}
      </p>
      {items.length === 0 ? (
        <EmptyState message="لم يتم إضافة جدول بعد" />
      ) : (
        <div className="space-y-2">
          {items.map((link) => (
            <Card key={`${link.scope}-${link.scope_id}`} className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-800">{link.label}</p>
              <div className="flex items-center gap-2">
                {link.url ? (
                  <ExternalLink url={link.url} label="عرض جدول الحصص" small />
                ) : (
                  <span className="text-xs text-slate-400">لم يتم إضافة جدول بعد</span>
                )}
                {isAdmin && (
                  <Button variant="ghost" onClick={() => openEdit(link)}>
                    {link.url ? "تعديل الرابط" : "إضافة رابط"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal title={`رابط: ${editTarget?.label ?? ""}`} open={!!editTarget} onClose={() => setEditTarget(null)}>
        <form onSubmit={submit}>
          <Field label="رابط الجدول (خارجي)" hint="اتركه فارغاً لإزالة الرابط — Google Sheets أو Drive أو PDF أو Notion">
            <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" placeholder="https://" />
          </Field>
          {formError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditTarget(null)}>إلغاء</Button>
            <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
