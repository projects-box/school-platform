import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { SafeUser } from "../../shared/types";
import { api, ApiClientError } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useToast } from "../lib/toast";
import { STUDENT_STATUS_LABELS } from "../lib/labels";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Spinner } from "../components/ui";

interface ParentChild {
  link_id: string;
  relationship: string | null;
  student_id: string;
  student_name: string;
  status: keyof typeof STUDENT_STATUS_LABELS;
  class_name: string | null;
}

export default function ParentDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data, loading, error, reload } = useApiData<{ parent: SafeUser; children: ParentChild[] }>(`/api/parents/${id}`);

  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<ParentChild | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [edit, setEdit] = useState({ full_name: "", email: "", phone: "", username: "", new_password: "" });

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const p = data.parent;

  const openEdit = () => {
    setEdit({ full_name: p.full_name, email: p.email ?? "", phone: p.phone ?? "", username: p.username ?? "", new_password: "" });
    setFormError(null);
    setEditOpen(true);
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.patch(`/api/parents/${p.id}`, {
        full_name: edit.full_name,
        email: edit.email || null,
        phone: edit.phone || null,
        username: edit.username,
        new_password: edit.new_password || null,
      });
      toast("تم حفظ التعديلات");
      setEditOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/parents/${p.id}`, { is_active: !p.is_active });
      toast(p.is_active ? "تم إيقاف حساب ولي الأمر" : "تمت إعادة تفعيل حساب ولي الأمر");
      reload();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    } finally {
      setBusy(false);
      setStatusOpen(false);
    }
  };

  const unlink = async () => {
    if (!unlinkTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/students/${unlinkTarget.student_id}/parents/${unlinkTarget.link_id}`);
      toast("تم فك الارتباط");
      reload();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    } finally {
      setBusy(false);
      setUnlinkTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={p.full_name}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={openEdit}>تعديل</Button>
            {p.is_active ? (
              <Button variant="danger" onClick={() => setStatusOpen(true)}>إيقاف الحساب</Button>
            ) : (
              <Button onClick={() => setStatusOpen(true)}>إعادة التفعيل</Button>
            )}
          </div>
        }
      />

      <Card>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-400">اسم المستخدم</dt>
            <dd className="font-medium text-slate-800" dir="ltr">{p.username}</dd>
          </div>
          <div>
            <dt className="text-slate-400">الحالة</dt>
            <dd>
              {p.is_active ? (
                <Badge className="bg-emerald-100 text-emerald-800">نشط</Badge>
              ) : (
                <Badge className="bg-slate-200 text-slate-600">موقوف</Badge>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">رقم الجوال</dt>
            <dd className="font-medium text-slate-800" dir="ltr">{p.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">البريد الإلكتروني</dt>
            <dd className="font-medium text-slate-800" dir="ltr">{p.email ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <section>
        <h2 className="mb-2 font-bold text-slate-700">الأبناء المرتبطون</h2>
        {data.children.length === 0 ? (
          <EmptyState message="لا يوجد أبناء مرتبطون — يمكنك الربط من صفحة الطالب" />
        ) : (
          <div className="space-y-2">
            {data.children.map((child) => (
              <Card key={child.link_id} className="flex items-center justify-between gap-2">
                <Link to={`/students/${child.student_id}`} className="min-w-0">
                  <p className="font-semibold text-slate-800 hover:text-teal-700">{child.student_name}</p>
                  <p className="text-xs text-slate-400">
                    {child.class_name ?? "بدون فصل"} · {child.relationship ?? "ولي أمر"} · {STUDENT_STATUS_LABELS[child.status]}
                  </p>
                </Link>
                <Button variant="ghost" onClick={() => setUnlinkTarget(child)}>فك الارتباط</Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal title="تعديل بيانات ولي الأمر" open={editOpen} onClose={() => setEditOpen(false)}>
        <form onSubmit={submitEdit}>
          <Field label="الاسم الكامل" required>
            <Input value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="رقم الجوال">
              <Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} dir="ltr" />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} dir="ltr" />
            </Field>
          </div>
          <div className="my-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-sm font-semibold text-slate-600">بيانات الدخول</p>
            <Field label="اسم المستخدم" required>
              <Input value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} dir="ltr" required autoComplete="off" />
            </Field>
            <Field label="كلمة مرور جديدة" hint="اتركها فارغة لإبقاء كلمة المرور الحالية — 8 أحرف على الأقل">
              <Input type="text" value={edit.new_password} onChange={(e) => setEdit({ ...edit, new_password: e.target.value })} dir="ltr" autoComplete="new-password" placeholder="••••••••" />
            </Field>
          </div>
          {formError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={statusOpen}
        title={p.is_active ? "إيقاف حساب ولي الأمر" : "إعادة تفعيل الحساب"}
        message={
          p.is_active
            ? "سيتم منع ولي الأمر من الدخول للمنصة مع الاحتفاظ بارتباطه بالأبناء. هل أنت متأكد؟"
            : "سيتمكن ولي الأمر من الدخول للمنصة مرة أخرى. هل أنت متأكد؟"
        }
        confirmLabel={p.is_active ? "إيقاف الحساب" : "إعادة التفعيل"}
        confirmVariant={p.is_active ? "danger" : "primary"}
        onConfirm={toggleStatus}
        onClose={() => setStatusOpen(false)}
        busy={busy}
      />

      <ConfirmDialog
        open={!!unlinkTarget}
        title="فك الارتباط"
        message={`سيتم فك ارتباط ولي الأمر بالطالب "${unlinkTarget?.student_name}". هل أنت متأكد؟`}
        confirmLabel="فك الارتباط"
        onConfirm={unlink}
        onClose={() => setUnlinkTarget(null)}
        busy={busy}
      />
    </div>
  );
}
