import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Paginated, Teacher } from "../../shared/types";
import { api, ApiClientError, qs } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useToast } from "../lib/toast";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, Spinner } from "../components/ui";

const EMPTY_FORM = { full_name: "", username: "", password: "", specialization: "", phone: "", email: "", resource_url: "" };

export default function Teachers() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const path = useMemo(() => `/api/teachers${qs({ page, q: search })}`, [page, search]);
  const { data, loading, error, reload } = useApiData<Paginated<Teacher>>(path);

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.post("/api/teachers", {
        ...form,
        specialization: form.specialization || null,
        phone: form.phone || null,
        email: form.email || null,
        resource_url: form.resource_url || null,
      });
      toast("تمت إضافة المعلم بنجاح");
      setModalOpen(false);
      setForm(EMPTY_FORM);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="المعلمون" action={<Button onClick={() => setModalOpen(true)}>+ إضافة معلم</Button>} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q);
        }}
        className="mb-4 flex gap-2"
      >
        <Input placeholder="بحث بالاسم أو التخصص..." value={q} onChange={(e) => setQ(e.target.value)} className="!w-auto flex-1" />
        <Button type="submit" variant="secondary">بحث</Button>
      </form>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState message="لا يوجد معلمون" />
      ) : (
        <>
          <div className="space-y-2">
            {data.items.map((t) => (
              <Link key={t.id} to={`/teachers/${t.id}`} className="block">
                <Card className="flex items-center justify-between gap-2 hover:border-teal-300 transition-colors">
                  <div>
                    <p className="font-semibold text-slate-800">{t.full_name}</p>
                    <p className="text-xs text-slate-400">{t.specialization ?? "بدون تخصص"}</p>
                  </div>
                  {t.is_active ? (
                    <Badge className="bg-emerald-100 text-emerald-800">نشط</Badge>
                  ) : (
                    <Badge className="bg-slate-200 text-slate-600">موقوف</Badge>
                  )}
                </Card>
              </Link>
            ))}
          </div>
          <Pagination page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
        </>
      )}

      <Modal title="إضافة معلم" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={submitForm}>
          <Field label="الاسم الكامل" required>
            <Input value={form.full_name} onChange={set("full_name")} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم المستخدم" required>
              <Input value={form.username} onChange={set("username")} dir="ltr" required autoComplete="off" />
            </Field>
            <Field label="كلمة المرور" required hint="8 أحرف على الأقل">
              <Input value={form.password} onChange={set("password")} dir="ltr" required autoComplete="new-password" />
            </Field>
          </div>
          <Field label="التخصص">
            <Input value={form.specialization} onChange={set("specialization")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="رقم الجوال">
              <Input value={form.phone} onChange={set("phone")} dir="ltr" />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input type="email" value={form.email} onChange={set("email")} dir="ltr" />
            </Field>
          </div>
          <Field label="رابط الموارد (خارجي)" hint="مثال: مجلد Google Drive لمواد المعلم">
            <Input type="url" value={form.resource_url} onChange={set("resource_url")} dir="ltr" placeholder="https://" />
          </Field>
          {formError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
