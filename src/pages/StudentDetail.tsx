import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ClassRoom, Paginated, ParentLink, SafeUser, Student } from "../../shared/types";
import { api, ApiClientError } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { formatDate, STUDENT_STATUS_LABELS } from "../lib/labels";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, ExternalLink, Field, Input, Modal, PageHeader, Select, Spinner } from "../components/ui";

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "school_admin";

  const { data, loading, error, reload } = useApiData<{ student: Student; parents: ParentLink[] }>(`/api/students/${id}`);
  const { data: classesData } = useApiData<{ items: ClassRoom[] }>(isAdmin ? "/api/classes" : null);

  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [edit, setEdit] = useState({ full_name: "", class_id: "", status: "", student_number: "", document_url: "" });

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const s = data.student;

  const openEdit = () => {
    setEdit({
      full_name: s.full_name,
      class_id: s.class_id ?? "",
      status: s.status,
      student_number: s.student_number ?? "",
      document_url: s.document_url ?? "",
    });
    setFormError(null);
    setEditOpen(true);
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.patch(`/api/students/${s.id}`, {
        full_name: edit.full_name,
        class_id: edit.class_id || null,
        status: edit.status,
        student_number: edit.student_number || null,
        document_url: edit.document_url || null,
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

  const deactivate = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/students/${s.id}`);
      toast("تم إلغاء تفعيل الطالب");
      navigate("/students");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    } finally {
      setBusy(false);
      setDeactivateOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={s.full_name}
        action={
          isAdmin ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={openEdit}>تعديل</Button>
              {s.status === "active" && (
                <Button variant="danger" onClick={() => setDeactivateOpen(true)}>إلغاء التفعيل</Button>
              )}
            </div>
          ) : undefined
        }
      />

      <Card>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-400">الفصل</dt>
            <dd className="font-medium text-slate-800">{s.class_name ?? "بدون فصل"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">رقم الطالب</dt>
            <dd className="font-medium text-slate-800">{s.student_number ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">الحالة</dt>
            <dd><Badge className="bg-slate-100 text-slate-700">{STUDENT_STATUS_LABELS[s.status]}</Badge></dd>
          </div>
          <div>
            <dt className="text-slate-400">تاريخ الميلاد</dt>
            <dd className="font-medium text-slate-800">{formatDate(s.date_of_birth)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">الجنس</dt>
            <dd className="font-medium text-slate-800">{s.gender === "male" ? "ذكر" : s.gender === "female" ? "أنثى" : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">اسم المستخدم</dt>
            <dd className="font-medium text-slate-800" dir="ltr">{s.username ?? "—"}</dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-sm text-slate-400">مستندات الطالب (رابط خارجي)</p>
          {s.document_url ? (
            <ExternalLink url={s.document_url} label="فتح الملف" />
          ) : (
            <p className="text-sm text-slate-400">لا توجد مستندات مرتبطة</p>
          )}
        </div>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold text-slate-700">أولياء الأمور</h2>
          {isAdmin && (
            <Button variant="ghost" onClick={() => { setFormError(null); setLinkOpen(true); }}>+ ربط ولي أمر</Button>
          )}
        </div>
        {data.parents.length === 0 ? (
          <EmptyState message="لا يوجد أولياء أمور مرتبطون" />
        ) : (
          <div className="space-y-2">
            {data.parents.map((p) => (
              <Card key={p.id} className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{p.parent_name}</p>
                  <p className="text-xs text-slate-400">
                    {p.relationship ?? "ولي أمر"} {p.parent_phone ? `· ${p.parent_phone}` : ""}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await api.delete(`/api/students/${s.id}/parents/${p.id}`);
                        toast("تم فك الارتباط");
                        reload();
                      } catch (err) {
                        toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
                      }
                    }}
                  >
                    فك الارتباط
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* edit modal */}
      <Modal title="تعديل بيانات الطالب" open={editOpen} onClose={() => setEditOpen(false)}>
        <form onSubmit={submitEdit}>
          <Field label="الاسم الكامل" required>
            <Input value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الفصل">
              <Select value={edit.class_id} onChange={(e) => setEdit({ ...edit, class_id: e.target.value })}>
                <option value="">بدون فصل</option>
                {classesData?.items.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="الحالة">
              <Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                {Object.entries(STUDENT_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="رقم الطالب">
            <Input value={edit.student_number} onChange={(e) => setEdit({ ...edit, student_number: e.target.value })} dir="ltr" />
          </Field>
          <Field label="رابط المستندات (خارجي)" hint="لا يتم رفع ملفات — روابط خارجية فقط">
            <Input type="url" value={edit.document_url} onChange={(e) => setEdit({ ...edit, document_url: e.target.value })} dir="ltr" placeholder="https://" />
          </Field>
          {formError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </div>
        </form>
      </Modal>

      {/* link parent modal */}
      <LinkParentModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        studentId={s.id}
        onLinked={() => {
          setLinkOpen(false);
          reload();
        }}
      />

      <ConfirmDialog
        open={deactivateOpen}
        title="إلغاء تفعيل الطالب"
        message="سيتم تحويل حالة الطالب إلى غير نشط ومنع دخوله للمنصة، مع الاحتفاظ بسجلاته. هل أنت متأكد؟"
        confirmLabel="إلغاء التفعيل"
        onConfirm={deactivate}
        onClose={() => setDeactivateOpen(false)}
        busy={busy}
      />
    </div>
  );
}

function LinkParentModal({ open, onClose, studentId, onLinked }: { open: boolean; onClose: () => void; studentId: string; onLinked: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [parentId, setParentId] = useState("");
  const [relationship, setRelationship] = useState("");
  const [newParent, setNewParent] = useState({ full_name: "", username: "", password: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, reload } = useApiData<Paginated<SafeUser & { children_count: number }>>(open ? "/api/parents?per_page=50" : null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let linkParentId = parentId;
      if (mode === "new") {
        const created = await api.post<{ id: string }>("/api/parents", {
          ...newParent,
          phone: newParent.phone || null,
        });
        linkParentId = created.id;
      }
      if (!linkParentId) {
        setError("اختر ولي الأمر");
        setBusy(false);
        return;
      }
      await api.post(`/api/students/${studentId}/parents`, { parent_user_id: linkParentId, relationship: relationship || null });
      toast("تم ربط ولي الأمر");
      setParentId("");
      setRelationship("");
      setNewParent({ full_name: "", username: "", password: "", phone: "" });
      reload();
      onLinked();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="ربط ولي أمر" open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="mb-3 flex gap-2">
          <Button variant={mode === "existing" ? "primary" : "secondary"} onClick={() => setMode("existing")}>
            ولي أمر موجود
          </Button>
          <Button variant={mode === "new" ? "primary" : "secondary"} onClick={() => setMode("new")}>
            حساب جديد
          </Button>
        </div>
        {mode === "existing" ? (
          <Field label="ولي الأمر" required>
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">اختر...</option>
              {data?.items.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </Select>
          </Field>
        ) : (
          <>
            <Field label="اسم ولي الأمر" required>
              <Input value={newParent.full_name} onChange={(e) => setNewParent({ ...newParent, full_name: e.target.value })} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="اسم المستخدم" required>
                <Input value={newParent.username} onChange={(e) => setNewParent({ ...newParent, username: e.target.value })} dir="ltr" required autoComplete="off" />
              </Field>
              <Field label="كلمة المرور" required hint="8 أحرف على الأقل">
                <Input value={newParent.password} onChange={(e) => setNewParent({ ...newParent, password: e.target.value })} dir="ltr" required autoComplete="new-password" />
              </Field>
            </div>
            <Field label="رقم الجوال">
              <Input value={newParent.phone} onChange={(e) => setNewParent({ ...newParent, phone: e.target.value })} dir="ltr" />
            </Field>
          </>
        )}
        <Field label="صلة القرابة">
          <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="أب، أم، ..." />
        </Field>
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={busy}>{busy ? "جارٍ الربط..." : "ربط"}</Button>
        </div>
      </form>
    </Modal>
  );
}
