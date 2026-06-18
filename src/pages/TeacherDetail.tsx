import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ClassRoom, Subject, Teacher, TeacherAssignment } from "../../shared/types";
import { api, ApiClientError } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useToast } from "../lib/toast";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, ExternalLink, Field, Input, Modal, PageHeader, Select, Spinner } from "../components/ui";

export default function TeacherDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, loading, error, reload } = useApiData<{ teacher: Teacher; assignments: TeacherAssignment[] }>(`/api/teachers/${id}`);
  const { data: classesData } = useApiData<{ items: ClassRoom[] }>("/api/classes");
  const { data: subjectsData } = useApiData<{ items: Subject[] }>("/api/subjects");

  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [edit, setEdit] = useState({ full_name: "", specialization: "", phone: "", email: "", resource_url: "", username: "", new_password: "" });
  const [assign, setAssign] = useState({ class_id: "", subject_id: "" });

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const t = data.teacher;

  const openEdit = () => {
    setEdit({
      full_name: t.full_name,
      specialization: t.specialization ?? "",
      phone: t.phone ?? "",
      email: t.email ?? "",
      resource_url: t.resource_url ?? "",
      username: t.username ?? "",
      new_password: "",
    });
    setFormError(null);
    setEditOpen(true);
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.patch(`/api/teachers/${t.id}`, {
        full_name: edit.full_name,
        specialization: edit.specialization || null,
        phone: edit.phone || null,
        email: edit.email || null,
        resource_url: edit.resource_url || null,
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

  const submitAssign = async (e: FormEvent) => {
    e.preventDefault();
    if (!assign.class_id || !assign.subject_id) {
      setFormError("اختر الفصل والمادة");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await api.post(`/api/teachers/${t.id}/assignments`, assign);
      toast("تم الإسناد بنجاح");
      setAssignOpen(false);
      setAssign({ class_id: "", subject_id: "" });
      reload();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/teachers/${t.id}`);
      toast("تم إيقاف حساب المعلم");
      navigate("/teachers");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    } finally {
      setBusy(false);
      setDeactivateOpen(false);
    }
  };

  const reactivate = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/teachers/${t.id}`, { is_active: true });
      toast("تمت إعادة تفعيل حساب المعلم");
      reload();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    } finally {
      setBusy(false);
      setReactivateOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.full_name}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={openEdit}>تعديل</Button>
            {t.is_active ? (
              <Button variant="danger" onClick={() => setDeactivateOpen(true)}>إيقاف الحساب</Button>
            ) : (
              <Button onClick={() => setReactivateOpen(true)}>إعادة التفعيل</Button>
            )}
          </div>
        }
      />

      <Card>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-400">التخصص</dt>
            <dd className="font-medium text-slate-800">{t.specialization ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">اسم المستخدم</dt>
            <dd className="font-medium text-slate-800" dir="ltr">{t.username ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">الحالة</dt>
            <dd>
              {t.is_active ? (
                <Badge className="bg-emerald-100 text-emerald-800">نشط</Badge>
              ) : (
                <Badge className="bg-slate-200 text-slate-600">موقوف</Badge>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">رقم الجوال</dt>
            <dd className="font-medium text-slate-800" dir="ltr">{t.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">البريد الإلكتروني</dt>
            <dd className="font-medium text-slate-800" dir="ltr">{t.email ?? "—"}</dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-sm text-slate-400">موارد المعلم (رابط خارجي)</p>
          {t.resource_url ? <ExternalLink url={t.resource_url} label="فتح الرابط" /> : <p className="text-sm text-slate-400">لا توجد موارد مرتبطة</p>}
        </div>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold text-slate-700">الفصول والمواد المسندة</h2>
          <Button variant="ghost" onClick={() => { setFormError(null); setAssignOpen(true); }}>+ إسناد جديد</Button>
        </div>
        {data.assignments.length === 0 ? (
          <EmptyState message="لا توجد إسنادات بعد" />
        ) : (
          <div className="space-y-2">
            {data.assignments.map((a) => (
              <Card key={a.id} className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{a.class_name}</p>
                  <p className="text-xs text-slate-400">{a.subject_name}</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await api.delete(`/api/teachers/${t.id}/assignments/${a.id}`);
                      toast("تم حذف الإسناد");
                      reload();
                    } catch (err) {
                      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
                    }
                  }}
                >
                  حذف
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal title="تعديل بيانات المعلم" open={editOpen} onClose={() => setEditOpen(false)}>
        <form onSubmit={submitEdit}>
          <Field label="الاسم الكامل" required>
            <Input value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} required />
          </Field>
          <Field label="التخصص">
            <Input value={edit.specialization} onChange={(e) => setEdit({ ...edit, specialization: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="رقم الجوال">
              <Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} dir="ltr" />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} dir="ltr" />
            </Field>
          </div>
          <Field label="رابط الموارد (خارجي)">
            <Input type="url" value={edit.resource_url} onChange={(e) => setEdit({ ...edit, resource_url: e.target.value })} dir="ltr" placeholder="https://" />
          </Field>
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

      <Modal title="إسناد فصل ومادة" open={assignOpen} onClose={() => setAssignOpen(false)}>
        <form onSubmit={submitAssign}>
          <Field label="الفصل" required>
            <Select value={assign.class_id} onChange={(e) => setAssign({ ...assign, class_id: e.target.value })}>
              <option value="">اختر...</option>
              {classesData?.items.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="المادة" required>
            <Select value={assign.subject_id} onChange={(e) => setAssign({ ...assign, subject_id: e.target.value })}>
              <option value="">اختر...</option>
              {subjectsData?.items.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          {formError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "إسناد"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deactivateOpen}
        title="إيقاف حساب المعلم"
        message="سيتم منع المعلم من الدخول للمنصة مع الاحتفاظ ببياناته وإسناداته. هل أنت متأكد؟"
        confirmLabel="إيقاف الحساب"
        onConfirm={deactivate}
        onClose={() => setDeactivateOpen(false)}
        busy={busy}
      />

      <ConfirmDialog
        open={reactivateOpen}
        title="إعادة تفعيل حساب المعلم"
        message="سيتمكن المعلم من الدخول للمنصة مرة أخرى. هل أنت متأكد؟"
        confirmLabel="إعادة التفعيل"
        confirmVariant="primary"
        onConfirm={reactivate}
        onClose={() => setReactivateOpen(false)}
        busy={busy}
      />
    </div>
  );
}
