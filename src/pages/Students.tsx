import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { ClassRoom, Paginated, Student } from "../../shared/types";
import { api, ApiClientError, qs } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { STUDENT_STATUS_LABELS } from "../lib/labels";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, Select, Spinner } from "../components/ui";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-slate-200 text-slate-600",
  graduated: "bg-sky-100 text-sky-800",
};

interface StudentForm {
  full_name: string;
  username: string;
  password: string;
  class_id: string;
  student_number: string;
  date_of_birth: string;
  gender: string;
  document_url: string;
}

const EMPTY_FORM: StudentForm = {
  full_name: "",
  username: "",
  password: "",
  class_id: "",
  student_number: "",
  date_of_birth: "",
  gender: "",
  document_url: "",
};

export default function Students() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "school_admin";

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const path = useMemo(
    () => `/api/students${qs({ page, q: search, class_id: classId, status })}`,
    [page, search, classId, status],
  );
  const { data, loading, error, reload } = useApiData<Paginated<Student>>(path);
  const { data: classesData } = useApiData<{ items: ClassRoom[] }>("/api/classes");

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(q);
  };

  const set = (k: keyof StudentForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.post("/api/students", {
        ...form,
        class_id: form.class_id || null,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        document_url: form.document_url || null,
      });
      toast("تمت إضافة الطالب بنجاح");
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
      <PageHeader
        title="الطلاب"
        action={isAdmin ? <Button onClick={() => setModalOpen(true)}>+ إضافة طالب</Button> : undefined}
      />

      <form onSubmit={submitSearch} className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="بحث بالاسم أو الرقم..." value={q} onChange={(e) => setQ(e.target.value)} className="!w-auto flex-1 min-w-40" />
        <Select value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }} className="!w-auto">
          <option value="">كل الفصول</option>
          {classesData?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="!w-auto">
          <option value="">كل الحالات</option>
          {Object.entries(STUDENT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">بحث</Button>
      </form>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState message="لا يوجد طلاب مطابقون" />
      ) : (
        <>
          <div className="space-y-2">
            {data.items.map((s) => (
              <Link key={s.id} to={`/students/${s.id}`} className="block">
                <Card className="flex items-center justify-between gap-2 hover:border-teal-300 transition-colors">
                  <div>
                    <p className="font-semibold text-slate-800">{s.full_name}</p>
                    <p className="text-xs text-slate-400">
                      {s.class_name ?? "بدون فصل"} {s.student_number ? `· ${s.student_number}` : ""}
                    </p>
                  </div>
                  <Badge className={STATUS_COLORS[s.status]}>{STUDENT_STATUS_LABELS[s.status]}</Badge>
                </Card>
              </Link>
            ))}
          </div>
          <Pagination page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
        </>
      )}

      <Modal title="إضافة طالب" open={modalOpen} onClose={() => setModalOpen(false)}>
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
            <Field label="الفصل">
              <Select value={form.class_id} onChange={set("class_id")}>
                <option value="">بدون فصل</option>
                {classesData?.items.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="رقم الطالب">
              <Input value={form.student_number} onChange={set("student_number")} dir="ltr" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="تاريخ الميلاد">
              <Input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} />
            </Field>
            <Field label="الجنس">
              <Select value={form.gender} onChange={set("gender")}>
                <option value="">—</option>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </Select>
            </Field>
          </div>
          <Field label="رابط المستندات (خارجي)" hint="مثال: رابط Google Drive — لا يتم رفع ملفات">
            <Input type="url" value={form.document_url} onChange={set("document_url")} dir="ltr" placeholder="https://" />
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
