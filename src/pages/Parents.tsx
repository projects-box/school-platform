import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Paginated, SafeUser } from "../../shared/types";
import { api, ApiClientError, qs } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useToast } from "../lib/toast";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, Spinner } from "../components/ui";

type ParentRow = SafeUser & { children_count: number };

const EMPTY_FORM = { full_name: "", username: "", password: "", phone: "", email: "" };

export default function Parents() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const path = useMemo(() => `/api/parents${qs({ page, q: search })}`, [page, search]);
  const { data, loading, error, reload } = useApiData<Paginated<ParentRow>>(path);

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.post("/api/parents", {
        ...form,
        phone: form.phone || null,
        email: form.email || null,
      });
      toast("تمت إضافة ولي الأمر بنجاح");
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
      <PageHeader title="أولياء الأمور" action={<Button onClick={() => { setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); }}>+ إضافة ولي أمر</Button>} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q);
        }}
        className="mb-4 flex gap-2"
      >
        <Input placeholder="بحث بالاسم أو اسم المستخدم..." value={q} onChange={(e) => setQ(e.target.value)} className="!w-auto flex-1" />
        <Button type="submit" variant="secondary">بحث</Button>
      </form>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState message="لا يوجد أولياء أمور" />
      ) : (
        <>
          <div className="space-y-2">
            {data.items.map((p) => (
              <Link key={p.id} to={`/parents/${p.id}`} className="block">
                <Card className="flex items-center justify-between gap-2 hover:border-teal-300 transition-colors">
                  <div>
                    <p className="font-semibold text-slate-800">{p.full_name}</p>
                    <p className="text-xs text-slate-400">
                      <span dir="ltr">@{p.username}</span> · عدد الأبناء: {p.children_count}
                    </p>
                  </div>
                  {p.is_active ? (
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

      <Modal title="إضافة ولي أمر" open={modalOpen} onClose={() => setModalOpen(false)}>
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="رقم الجوال">
              <Input value={form.phone} onChange={set("phone")} dir="ltr" />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input type="email" value={form.email} onChange={set("email")} dir="ltr" />
            </Field>
          </div>
          <p className="mb-3 text-xs text-slate-400">يمكنك ربط ولي الأمر بالأبناء من صفحة الطالب أو من صفحة ولي الأمر بعد إنشائه.</p>
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
