# School Platform — منصة المدرسة

A lightweight, mobile-first, Arabic (RTL) school management MVP built to run efficiently on the **Cloudflare Free plan**.

A single Cloudflare Worker serves both the static SPA (via Workers Static Assets) and a REST API under `/api`, backed by Cloudflare D1 (SQLite). No Node.js server, no Docker, no file storage.

## Features (MVP)

- **Authentication** — session-based auth with secure HTTP-only cookies (PBKDF2 password hashing via Web Crypto), role-based access control with server-side checks on every endpoint.
- **Roles** — Super Admin, School Admin, Teacher, Student, Parent.
- **School setup** — school profile, academic years, terms, grade levels, classes, subjects.
- **Students** — CRUD (delete = deactivate, history kept), class assignment, parent linking, external document URLs.
- **Teachers** — CRUD (delete = deactivate), class/subject assignments, external resource URLs.
- **Attendance** — configurable school-wide between **daily** (one record per student per day) and **per-session** (per lecture: the teacher picks the period `1..N` and an optional subject). Teachers mark attendance per class/date/session (bulk upsert); reports with filters, pagination and summaries; parents/students see only their own data.
- **Grades & exams** — exams per class/subject, bulk marks entry, automatic percentage + Arabic grade label (ممتاز/جيد جداً/جيد/مقبول/راسب).
- **Assignments** — teacher creates per class; students submit **text or external link only** (no uploads); teacher reviews with feedback.
- **Announcements** — general (admin) or class-specific (teacher, own classes only), with external attachment links.
- **Timetable** — external timetable links at school / grade / class level, with a `timetable_entries` table reserved for future structured scheduling.
- **Dashboards** — role-specific (admin totals + today's attendance; teacher classes + pending attendance; student summary; parent per-child summaries).

## External links instead of file uploads

The MVP stores **no files at all**. Anything that would normally be an upload is an external URL (Google Drive/Sheets/Docs, PDF links, Notion, …):

| Where | Field |
|---|---|
| School general timetable | `schools.general_timetable_url` |
| Grade / class timetable | `grades.timetable_url`, `classes.timetable_url` |
| Student documents | `students.document_url` |
| Teacher resources | `teachers.resource_url` |
| Exam resources | `exams.resource_url` |
| Assignment resources | `assignments.resource_url` |
| Student submissions | `assignment_submissions.submission_url` |
| Announcement attachments | `announcements.attachment_url` |

All URL fields are validated server-side (`http(s)` only — `javascript:` etc. rejected) and rendered with `target="_blank" rel="noopener noreferrer"`.

## Tech stack

- **Frontend:** React 19 + Vite 6 + TypeScript + Tailwind CSS 4 (RTL, mobile-first; ~92 KB gzipped JS)
- **Backend:** Cloudflare Workers + Hono
- **Database:** Cloudflare D1 (SQLite) with raw SQL migrations (no ORM)
- **Dev/deploy:** `@cloudflare/vite-plugin` + Wrangler

## Project structure

```
src/            React SPA (pages, components, lib)
worker/         Hono API (routes, middleware, lib)
shared/         Types shared between SPA and worker
migrations/     D1 SQL migrations
seeds/          Demo seed data
wrangler.jsonc  Cloudflare configuration
```

## Local setup

Requirements: Node.js 20+.

```bash
npm install
npm run db:migrate     # apply migrations to the local D1 (in .wrangler/state)
npm run db:seed        # load demo data
npm run dev            # Vite dev server + Worker + local D1 on http://localhost:5173
```

Production-like preview:

```bash
npm run preview        # builds, then serves the built worker + assets
```

Other scripts: `npm run check` (typecheck), `npm run build`, `npm run db:reset` (wipe local DB + migrate + seed).

## Seed users

All seed users share the password **`Demo@1234`**:

| Role | Username |
|---|---|
| Super Admin | `superadmin` |
| School Admin | `admin` |
| Teacher | `teacher1`, `teacher2` |
| Student | `student1` … `student6` |
| Parent | `parent1` (2 children), `parent2` |

> Change or remove these accounts before using the platform with real data.

## Cloudflare deployment

1. Log in: `npx wrangler login`
2. Create the database:
   ```bash
   npx wrangler d1 create school-platform-db
   ```
   Copy the printed `database_id` into `wrangler.jsonc`.
3. Apply migrations and (optionally) seed:
   ```bash
   npm run db:migrate:remote
   npm run db:seed:remote
   ```
4. Deploy:
   ```bash
   npm run deploy
   ```

The app is served at `https://school-platform.<your-subdomain>.workers.dev` (or attach a custom domain from the Cloudflare dashboard).

### Environment variables

None are required for the MVP — sessions are random tokens stored (hashed) in D1, so there is no signing secret. If you add secrets later, use `npx wrangler secret put NAME` and a local `.dev.vars` file (see `.env.example`).

### Free plan notes

- One Worker invocation serves both the SPA assets and the API (static asset requests don't count as Worker invocations except `/api/*` thanks to `run_worker_first`).
- All list endpoints are paginated (max 50/page); dashboards use small aggregate queries.
- PBKDF2 (100k iterations, native Web Crypto) only runs on login/password change.

## Security model

- HTTP-only, `SameSite=Lax`, `Secure` session cookies; tokens stored hashed (SHA-256) in D1 with 7-day expiry.
- CSRF: SameSite cookies + Origin header check on all mutating requests.
- Server-side authorization on every endpoint:
  - Parents can only access their linked children.
  - Students can only access their own data.
  - Teachers can only manage their assigned classes/subjects.
- Password hashes never leave the server; inputs validated and length-limited; URL fields restricted to `http(s)`.

## Design decisions

- **No separate `parents` table** — parents are `users` with role `parent`, linked via `student_parent_links`. Less duplication, same capability.
- **Delete = deactivate** for students/teachers to preserve attendance/marks history.
- **No `announcement_targets` table** — `announcements.class_id` (NULL = whole school) covers the MVP; the targets table can be added when multi-target announcements are needed.
- **No `audit_logs`** — left out to keep the MVP simple (listed as future work).
- **Raw SQL over ORM** — D1's prepared statements are simple enough; avoids bundle-size/compat risk (e.g. Prisma) on Workers.

## Known limitations

- Single school per deployment (schema is multi-school-ready via `school_id`).
- No password reset flow (admins recreate accounts; users change passwords from the profile page).
- No notifications (in-app announcements only).
- Structured timetable (`timetable_entries`) is seeded but has no UI yet — external links are the MVP path.
- No automated test suite; flows verified end-to-end manually (see below).

## Verified flows

Login/logout, role redirects, protected APIs (401/403), student/teacher/class/subject CRUD, attendance marking + reports, exams + marks entry with max-score validation, assignment submission (text/link only, bad URLs rejected) + teacher review, announcements (teacher restricted to own classes), timetable links, parent restricted to linked children, student restricted to own data, CSRF origin rejection.

## Future improvements

WhatsApp/SMS notifications, file uploads via Cloudflare R2, payments, structured timetable builder UI, advanced reports, multi-school SaaS, audit logs, native mobile app.
