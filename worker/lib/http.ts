import type { Context } from "hono";

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new ApiError(400, msg);
export const unauthorized = () => new ApiError(401, "يجب تسجيل الدخول");
export const forbidden = () => new ApiError(403, "غير مصرح لك بهذا الإجراء");
export const notFound = () => new ApiError(404, "العنصر غير موجود");

export function uid(): string {
  return crypto.randomUUID();
}

export function pagination(c: Context): { page: number; perPage: number; offset: number } {
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(c.req.query("per_page") ?? "20", 10) || 20));
  return { page, perPage, offset: (page - 1) * perPage };
}

export function paginated<T>(items: T[], total: number, page: number, perPage: number) {
  return { items, total, page, per_page: perPage };
}

// ---- input validation (returns sanitized values, throws ApiError with Arabic messages) ----

type Body = Record<string, unknown>;

export async function readBody(c: Context): Promise<Body> {
  try {
    const body = await c.req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error();
    return body as Body;
  } catch {
    throw badRequest("صيغة الطلب غير صحيحة");
  }
}

export function vStr(body: Body, field: string, opts: { required?: boolean; max?: number; min?: number } = {}): string | null {
  const { required = false, max = 300, min = 1 } = opts;
  const raw = body[field];
  if (raw === undefined || raw === null || raw === "") {
    if (required) throw badRequest(`الحقل مطلوب: ${field}`);
    return null;
  }
  if (typeof raw !== "string") throw badRequest(`قيمة غير صالحة للحقل: ${field}`);
  const val = raw.trim();
  if (val.length < min) {
    if (required) throw badRequest(`الحقل مطلوب: ${field}`);
    return null;
  }
  if (val.length > max) throw badRequest(`الحقل طويل جداً: ${field} (الحد الأقصى ${max} حرفاً)`);
  return val;
}

export function vUrl(body: Body, field: string, opts: { required?: boolean } = {}): string | null {
  const val = vStr(body, field, { ...opts, max: 500 });
  if (val === null) return null;
  if (!isHttpUrl(val)) throw badRequest(`رابط غير صالح في الحقل: ${field} (يجب أن يبدأ بـ http أو https)`);
  return val;
}

export function isHttpUrl(val: string): boolean {
  try {
    const u = new URL(val);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function vDate(body: Body, field: string, opts: { required?: boolean } = {}): string | null {
  const val = vStr(body, field, { ...opts, max: 10 });
  if (val === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val) || isNaN(Date.parse(val))) {
    throw badRequest(`تاريخ غير صالح في الحقل: ${field} (الصيغة: YYYY-MM-DD)`);
  }
  return val;
}

export function vEnum<T extends string>(body: Body, field: string, options: readonly T[], opts: { required?: boolean } = {}): T | null {
  const val = vStr(body, field, { ...opts, max: 50 });
  if (val === null) return null;
  if (!options.includes(val as T)) throw badRequest(`قيمة غير صالحة للحقل: ${field}`);
  return val as T;
}

export function vNum(body: Body, field: string, opts: { required?: boolean; min?: number; max?: number } = {}): number | null {
  const raw = body[field];
  if (raw === undefined || raw === null || raw === "") {
    if (opts.required) throw badRequest(`الحقل مطلوب: ${field}`);
    return null;
  }
  const num = typeof raw === "number" ? raw : Number(raw);
  if (!isFinite(num)) throw badRequest(`قيمة رقمية غير صالحة للحقل: ${field}`);
  if (opts.min !== undefined && num < opts.min) throw badRequest(`القيمة أقل من المسموح للحقل: ${field}`);
  if (opts.max !== undefined && num > opts.max) throw badRequest(`القيمة أكبر من المسموح للحقل: ${field}`);
  return num;
}
