import { useEffect, useState, type FormEvent } from "react";
import type { AcademicYear, School, Term } from "../../shared/types";
import { api, ApiClientError } from "../lib/api";
import { useApiData } from "../lib/useApi";
import { useToast } from "../lib/toast";
import { formatDate } from "../lib/labels";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Spinner } from "../components/ui";

export default function SchoolSettings() {
  const toast = useToast();
  const schoolApi = useApiData<{ school: School; current_year: AcademicYear | null; current_term: Term | null }>("/api/school");
  const yearsApi = useApiData<{ items: AcademicYear[] }>("/api/academic-years");
  const termsApi = useApiData<{ items: Term[] }>("/api/terms");

  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "", website_url: "", general_timetable_url: "" });
  const [busy, setBusy] = useState(false);
  const [yearModal, setYearModal] = useState(false);
  const [termModal, setTermModal] = useState(false);

  useEffect(() => {
    const s = schoolApi.data?.school;
    if (s) {
      setForm({
        name: s.name,
        address: s.address ?? "",
        phone: s.phone ?? "",
        email: s.email ?? "",
        website_url: s.website_url ?? "",
        general_timetable_url: s.general_timetable_url ?? "",
      });
    }
  }, [schoolApi.data]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveSchool = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch("/api/school", {
        name: form.name,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        website_url: form.website_url || null,
        general_timetable_url: form.general_timetable_url || null,
      });
      toast("تم حفظ بيانات المدرسة");
      schoolApi.reload();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    } finally {
      setBusy(false);
    }
  };

  const setCurrentYear = async (year: AcademicYear) => {
    try {
      await api.patch(`/api/academic-years/${year.id}`, { is_current: true });
      toast("تم تحديد السنة الحالية");
      yearsApi.reload();
      schoolApi.reload();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    }
  };

  const setCurrentTerm = async (term: Term) => {
    try {
      await api.patch(`/api/terms/${term.id}`, { is_current: true });
      toast("تم تحديد الفصل الدراسي الحالي");
      termsApi.reload();
      schoolApi.reload();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    }
  };

  if (schoolApi.loading) return <Spinner />;
  if (schoolApi.error) return <ErrorState message={schoolApi.error} onRetry={schoolApi.reload} />;

  return (
    <div className="space-y-6">
      <PageHeader title="إعدادات المدرسة" />

      <Card>
        <h2 className="mb-3 font-bold text-slate-700">بيانات المدرسة</h2>
        <form onSubmit={saveSchool}>
          <Field label="اسم المدرسة" required>
            <Input value={form.name} onChange={set("name")} required />
          </Field>
          <Field label="العنوان">
            <Input value={form.address} onChange={set("address")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الهاتف">
              <Input value={form.phone} onChange={set("phone")} dir="ltr" />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input type="email" value={form.email} onChange={set("email")} dir="ltr" />
            </Field>
          </div>
          <Field label="الموقع الإلكتروني">
            <Input type="url" value={form.website_url} onChange={set("website_url")} dir="ltr" placeholder="https://" />
          </Field>
          <Field label="رابط الجدول العام (خارجي)" hint="Google Sheets أو PDF أو أي رابط عام">
            <Input type="url" value={form.general_timetable_url} onChange={set("general_timetable_url")} dir="ltr" placeholder="https://" />
          </Field>
          <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </form>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold text-slate-700">السنوات الدراسية</h2>
          <Button variant="ghost" onClick={() => setYearModal(true)}>+ سنة جديدة</Button>
        </div>
        {!yearsApi.data || yearsApi.data.items.length === 0 ? (
          <EmptyState message="لا توجد سنوات دراسية" />
        ) : (
          <div className="space-y-2">
            {yearsApi.data.items.map((y) => (
              <Card key={y.id} className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{y.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(y.start_date)} — {formatDate(y.end_date)}
                  </p>
                </div>
                {y.is_current ? (
                  <Badge className="bg-teal-100 text-teal-800">السنة الحالية</Badge>
                ) : (
                  <Button variant="ghost" onClick={() => setCurrentYear(y)}>تحديد كحالية</Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold text-slate-700">الفصول الدراسية</h2>
          <Button variant="ghost" onClick={() => setTermModal(true)}>+ فصل دراسي جديد</Button>
        </div>
        {!termsApi.data || termsApi.data.items.length === 0 ? (
          <EmptyState message="لا توجد فصول دراسية" />
        ) : (
          <div className="space-y-2">
            {termsApi.data.items.map((t) => (
              <Card key={t.id} className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(t.start_date)} — {formatDate(t.end_date)}
                  </p>
                </div>
                {t.is_current ? (
                  <Badge className="bg-teal-100 text-teal-800">الفصل الحالي</Badge>
                ) : (
                  <Button variant="ghost" onClick={() => setCurrentTerm(t)}>تحديد كحالي</Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {yearModal && (
        <YearModal
          onClose={() => setYearModal(false)}
          onSaved={() => {
            setYearModal(false);
            yearsApi.reload();
          }}
        />
      )}
      {termModal && (
        <TermModal
          years={yearsApi.data?.items ?? []}
          onClose={() => setTermModal(false)}
          onSaved={() => {
            setTermModal(false);
            termsApi.reload();
          }}
        />
      )}
    </div>
  );
}

function YearModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", is_current: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/academic-years", {
        name: form.name,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        is_current: form.is_current,
      });
      toast("تمت إضافة السنة الدراسية");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="سنة دراسية جديدة" open onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="الاسم" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="2026-2027" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تاريخ البداية">
            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </Field>
          <Field label="تاريخ النهاية">
            <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </Field>
        </div>
        <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.is_current} onChange={(e) => setForm({ ...form, is_current: e.target.checked })} />
          تحديد كسنة حالية
        </label>
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "إضافة"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function TermModal({ years, onClose, onSaved }: { years: AcademicYear[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    academic_year_id: years.find((y) => y.is_current)?.id ?? "",
    start_date: "",
    end_date: "",
    is_current: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.academic_year_id) {
      setError("اختر السنة الدراسية");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/terms", {
        name: form.name,
        academic_year_id: form.academic_year_id,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        is_current: form.is_current,
      });
      toast("تمت إضافة الفصل الدراسي");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="فصل دراسي جديد" open onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="الاسم" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="الفصل الدراسي الأول" required />
        </Field>
        <Field label="السنة الدراسية" required>
          <Select value={form.academic_year_id} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}>
            <option value="">اختر...</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تاريخ البداية">
            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </Field>
          <Field label="تاريخ النهاية">
            <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </Field>
        </div>
        <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.is_current} onChange={(e) => setForm({ ...form, is_current: e.target.checked })} />
          تحديد كفصل حالي
        </label>
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "إضافة"}</Button>
        </div>
      </form>
    </Modal>
  );
}
