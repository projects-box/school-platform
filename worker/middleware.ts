import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Role } from "../shared/types";
import type { AppEnv } from "./lib/app";
import { getUserBySessionToken } from "./lib/auth";
import { ApiError, unauthorized, forbidden } from "./lib/http";

export const SESSION_COOKIE = "session";

/** CSRF protection: cookies are SameSite=Lax; additionally reject cross-origin mutating requests. */
export const csrfCheck = createMiddleware<AppEnv>(async (c, next) => {
  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const origin = c.req.header("Origin");
    if (origin) {
      const requestOrigin = new URL(c.req.url).origin;
      if (origin !== requestOrigin) throw new ApiError(403, "طلب مرفوض (CSRF)");
    }
  }
  await next();
});

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) throw unauthorized();
  const user = await getUserBySessionToken(c.env.DB, token);
  if (!user) throw unauthorized();
  c.set("user", user);
  await next();
});

export function requireRole(...roles: Role[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.get("user").role)) throw forbidden();
    await next();
  });
}
