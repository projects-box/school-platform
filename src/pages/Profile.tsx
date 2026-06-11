import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { api, ApiClientError } from "../lib/api";
import { useToast } from "../lib/toast";
import { ROLE_LABELS } from "../lib/labels";
import { Badge, Button, Card, Field, Input, PageHeader } from "../components/ui";

export default function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [contact, setContact] = useState({ email: user?.email ?? "", phone: user?.phone ?? "" });
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [busyContact, setBusyContact] = useState(false);
  const [busyPw, setBusyPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  if (!user) return null;

  const saveContact = async (e: FormEvent) => {
    e.preventDefault();
    setBusyContact(true);
    try {
      await api.patch("/api/auth/me", { email: contact.email || null, phone: contact.phone || null });
      toast("تم حفظ بيانات التواصل");
      refresh();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "حدث خطأ", "error");
    } finally {
      setBusyContact(false);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (pw.new_password.length < 8) {
      setPwError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (pw.new_password !== pw.confirm) {
      setPwError("تأكيد كلمة المرور غير مطابق");
      return;
    }
    setBusyPw(true);
    try {
      await api.patch("/api/auth/me", { current_password: pw.current_password, new_password: pw.new_password });
      toast("تم تغيير كلمة المرور");
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      setPwError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setBusyPw(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="الملف الشخصي" />

      <Card>
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-teal-100 text-lg font-bold text-teal-800">
            {user.full_name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-slate-800">{user.full_name}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <Badge className="bg-teal-100 text-teal-800">{ROLE_LABELS[user.role]}</Badge>
              <span className="text-xs text-slate-400" dir="ltr">@{user.username}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-bold text-slate-700">بيانات التواصل</h2>
        <form onSubmit={saveContact}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="البريد الإلكتروني">
              <Input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} dir="ltr" />
            </Field>
            <Field label="رقم الجوال">
              <Input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} dir="ltr" />
            </Field>
          </div>
          <Button type="submit" disabled={busyContact}>{busyContact ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-bold text-slate-700">تغيير كلمة المرور</h2>
        <form onSubmit={savePassword}>
          <Field label="كلمة المرور الحالية" required>
            <Input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} dir="ltr" autoComplete="current-password" required />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="كلمة المرور الجديدة" required hint="8 أحرف على الأقل">
              <Input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} dir="ltr" autoComplete="new-password" required />
            </Field>
            <Field label="تأكيد كلمة المرور" required>
              <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} dir="ltr" autoComplete="new-password" required />
            </Field>
          </div>
          {pwError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{pwError}</p>}
          <Button type="submit" disabled={busyPw}>{busyPw ? "جارٍ الحفظ..." : "تغيير كلمة المرور"}</Button>
        </form>
      </Card>
    </div>
  );
}
