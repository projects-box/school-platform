import { Hono } from "hono";
import type { AppEnv } from "./lib/app";
import { ApiError } from "./lib/http";
import { csrfCheck, requireAuth } from "./middleware";
import auth from "./routes/auth";
import { school, years, terms, grades } from "./routes/school";
import { classes, subjects } from "./routes/classes";
import students from "./routes/students";
import teachers, { parents } from "./routes/teachers";
import attendance from "./routes/attendance";
import exams, { marks } from "./routes/exams";
import assignments, { submissions } from "./routes/assignments";
import announcements from "./routes/announcements";
import timetable from "./routes/timetable";
import dashboard from "./routes/dashboard";

const app = new Hono<AppEnv>();

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("Unhandled error:", err);
  return c.json({ error: "حدث خطأ غير متوقع، حاول مرة أخرى" }, 500);
});

const api = new Hono<AppEnv>();
api.use("*", csrfCheck);

// Public: login only. Everything else requires a session.
api.route("/auth", auth);

api.use("*", requireAuth);
api.route("/dashboard", dashboard);
api.route("/school", school);
api.route("/academic-years", years);
api.route("/terms", terms);
api.route("/grades", grades);
api.route("/classes", classes);
api.route("/subjects", subjects);
api.route("/students", students);
api.route("/teachers", teachers);
api.route("/parents", parents);
api.route("/attendance", attendance);
api.route("/exams", exams);
api.route("/marks", marks);
api.route("/assignments", assignments);
api.route("/assignment-submissions", submissions);
api.route("/announcements", announcements);
api.route("/timetable", timetable);

app.route("/api", api);

app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith("/api/")) {
    return c.json({ error: "المسار غير موجود" }, 404);
  }
  // Non-API routes are served by Cloudflare static assets (SPA fallback).
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
