# School Platform — rules for Claude Code

Arabic RTL school management MVP on Cloudflare Workers (Hono) + D1 + React/Vite/Tailwind SPA.
Read `HANDOVER.md` for links, infrastructure and credentials; `README.md` for setup and deployment.

## Hard rules (never break)

- **Public repo — never commit secrets, tokens or real credentials.** Local secrets only in `.dev.vars` (gitignored); production secrets via `wrangler secret put`.
- **Pushing to `main` deploys to production** (Cloudflare Workers Builds). Verify `npm run check && npm run build` before any push; prefer feature branches.
- **Never run `npm run db:seed:remote`** unless explicitly told to — `seeds/seed.sql` deletes ALL rows in every table first.
- **Never edit an applied migration.** Add a new numbered file in `migrations/` and run `npm run db:migrate:remote` manually — CI does not run migrations.
- **No file uploads, no R2, no binary/blob storage.** Files are external URLs only (`*_url` columns). Validate with `vUrl` (http/https only); render with `target="_blank" rel="noopener noreferrer"`.
- **Server-side RBAC on every endpoint** using `worker/lib/app.ts` helpers (`teacherScope`, `studentScope`, `parentStudents`, `visibleClassIds`, `assertCanViewStudent`): parents see only linked children, students only themselves, teachers only assigned classes/subjects. Frontend route guards are UX, not security.
- **Never expose `password_hash`** or session tokens in any response.

## Conventions

- UI text: Arabic, RTL, mobile-first. Code, DB schema, API routes: English. API error messages: Arabic (thrown as `ApiError` from `worker/lib/http.ts`).
- Raw SQL with prepared statements (no ORM). Bulk writes via `DB.batch`. Use `vStr/vUrl/vDate/vEnum/vNum` for every input field.
- Every list endpoint is paginated (`pagination(c)`, max 50/page) and uses the existing `Paginated<T>` shape `{items, total, page, per_page}`.
- Shared API types live in `shared/types.ts` — update them when changing endpoint shapes.
- Frontend: `useApiData` for fetching, `useToast` for feedback, components from `src/components/ui.tsx` (Modal, Field, EmptyState, ExternalLink…). Match existing page patterns.
- Free-plan budget: few queries per request, indexed lookups, small bundle, Workers-compatible deps only (no Node-only libraries). Don't add dependencies without a strong reason.
- This is a deliberate MVP — extend existing patterns; don't introduce new architectural layers, ORMs or state libraries.

## Commands

```bash
npm run dev                # vite dev server + worker + local D1
npm run check              # typecheck (app + worker)
npm run build              # production build
npm run db:migrate         # local migrations   | db:migrate:remote = production (manual!)
npm run db:seed            # local demo data    | db:seed:remote = DESTRUCTIVE on production
npm run db:reset           # wipe local DB + migrate + seed
```

Local login: seed users in `HANDOVER.md`, password `Demo@1234`.
