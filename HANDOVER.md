# Handover — School Platform (منصة المدرسة)

Handover notes for the next developer. Read this together with `README.md` (setup/deployment details) and `CLAUDE.md` (binding rules for Claude Code — your Claude Code instance loads it automatically).

## Links

| What | Where |
|---|---|
| Production app | https://school-platform.ruqa-tech.workers.dev |
| GitHub repo | https://github.com/projects-box/school-platform (org: `projects-box`, branch: `main`) |
| Cloudflare dashboard | https://dash.cloudflare.com → Workers & Pages → `school-platform` |
| Original product spec | `prompt.md` in the repo root |

## Infrastructure

- **Cloudflare account:** `helaltech.com@gmail.com` — account ID `15e03cb9f95c05501228caaf73c1c6b9`
- **Worker:** `school-platform` (serves SPA assets + `/api` from one Worker, Free plan)
- **D1 database:** `school-platform-db`, id `742cf8a0-d5e0-437a-8632-66c6cc12f5cd` (region EEUR) — already referenced in `wrangler.jsonc`
- **CI/CD:** Cloudflare **Workers Builds** is connected to the GitHub repo. Every push to `main` builds (`npm run build`) and deploys (`npx wrangler deploy`) to production automatically. Non-production branches get preview builds.
- **Environment variables / secrets:** none exist and none are needed for the MVP. Sessions are random tokens stored hashed in D1 — there is no signing secret to share.

## Access you need (no shared passwords — authenticate yourself)

1. **GitHub:** get added to the `projects-box` org with write access, then `gh auth login`.
2. **Cloudflare:** get added as a member of the Cloudflare account (or use its owner login), then `npx wrangler login` on your machine. You only need wrangler auth for D1 migrations/seeding — deploys happen via Git push.

There are intentionally **no API tokens or secrets in this repo or in this file** — the repo is public. Never add any.

## Application credentials (demo seed data — currently live in production)

All seed users share the password `Demo@1234`:

| Role | Username |
|---|---|
| Super Admin | `superadmin` |
| School Admin | `admin` |
| Teacher | `teacher1`, `teacher2` |
| Student | `student1` … `student6` |
| Parent | `parent1` (linked to student1 & student4), `parent2` (student2) |

⚠️ Production currently contains only this demo data. **Before any real school uses it, change these passwords (Profile page) or recreate the accounts.**

## Day-1 commands

```bash
git clone git@github.com:projects-box/school-platform.git && cd school-platform
npm install
npm run db:migrate && npm run db:seed   # local D1 in .wrangler/state
npm run dev                             # http://localhost:5173
npm run check                           # typecheck (run before every push)
```

## Things that are manual (CI does NOT do them)

- **D1 migrations:** Workers Builds only builds + deploys. When you add a migration file, you must run `npm run db:migrate:remote` yourself (before or right after pushing).
- **`npm run db:seed:remote` is destructive** — it wipes every table before inserting demo data. Never run it once real data exists.

## Code map (60 seconds)

```
worker/index.ts        API entry — route mounting, auth ordering, error handler
worker/middleware.ts   session auth, requireRole, CSRF origin check
worker/lib/app.ts      RBAC helpers: teacherScope/studentScope/parentStudents/visibleClassIds
worker/lib/http.ts     validators (vStr/vUrl/vDate/vEnum/vNum), pagination, ApiError (Arabic messages)
worker/lib/auth.ts     PBKDF2 hashing + session create/verify (tokens stored SHA-256 hashed)
worker/routes/*.ts     one file per module
shared/types.ts        types shared by worker + SPA, grade-label logic
src/                   React SPA — lib/ (api client, auth ctx, toast), components/, pages/
migrations/            numbered D1 SQL migrations (append-only)
seeds/seed.sql         demo data (idempotent, wipes tables first)
```

## Rules for development (your Claude Code instance must follow these — see CLAUDE.md)

1. **No secrets in the repo, ever.** Public repo. Local secrets go in `.dev.vars` (gitignored); production via `wrangler secret put`.
2. **Never run `db:seed:remote` against production data**, and never edit an already-applied migration — add a new numbered file instead.
3. **Pushing to `main` deploys to production.** Work on branches, verify `npm run check && npm run build` locally first.
4. **External links only — no file uploads, no R2, no binary storage.** Validate every URL field with `vUrl` (http/https only) and render with `target="_blank" rel="noopener noreferrer"`.
5. **RBAC is server-side and mandatory on every endpoint:** parents → linked children only; students → own data only; teachers → assigned classes/subjects only (use the helpers in `worker/lib/app.ts`). Frontend checks are UX, never security.
6. **Never return `password_hash`** or other sensitive columns from any endpoint.
7. **UI is Arabic + RTL, mobile-first; code, DB and API naming stay English.** API error messages are Arabic.
8. **Stay Free-plan friendly:** paginate every list endpoint (≤50/page), keep queries few and indexed, keep the bundle small, only Workers-compatible dependencies (no Node-only libs, no ORM, no heavy UI kits).
9. **Don't over-engineer.** This is a deliberate MVP — match the existing patterns (raw SQL, small helpers, one file per module) instead of introducing new layers.

## Current state & known gaps

- All MVP modules work and were verified end-to-end (see README "Verified flows").
- Known limitations: single school per deployment, no password reset flow, no notifications, `timetable_entries` table exists but has no UI (external links are the MVP path), no automated tests yet.
- Sensible next steps: automated tests for the RBAC matrix, password reset, audit logs, structured timetable UI, R2 uploads (only when explicitly requested).
