You are Claude Code acting as a senior full-stack engineer, product architect, database architect, Cloudflare deployment expert, and UI/UX engineer.

I want you to build a complete MVP web platform for managing a school.

Project name:
School Platform

Execution context:
You are working inside an existing/local codebase or a new empty folder. First inspect the project folder, then create the app step by step.

Main requirements:

* The app must work on desktop web and mobile web.
* The UI must be mobile-first.
* The platform must be optimized to run on Cloudflare Free plan as much as possible.
* The app should be lightweight, fast, simple, and easy to deploy.
* The primary UI language is Arabic.
* The UI must fully support RTL.
* Code, database tables, API routes, and internal naming should use English.
* Do not over-engineer.
* Build a clean MVP first.
* Make reasonable decisions when details are missing.
* Do not stop to ask for confirmation after every small step.
* Work step by step and keep the project production-ready but simple.

Recommended technical stack:

* Frontend: React + Vite + TypeScript
* Styling: Tailwind CSS
* UI approach: mobile-first responsive design
* Backend: Cloudflare Workers or Cloudflare Pages Functions
* API framework: Hono if useful
* Database: Cloudflare D1 SQLite
* ORM/query layer: Drizzle ORM or clean raw SQL migrations
* Auth: custom session-based authentication using secure HTTP-only cookies
* Password hashing: use Web Crypto-compatible hashing suitable for Cloudflare Workers runtime
* Deployment: Cloudflare Pages / Workers using Wrangler
* Avoid Node.js-only libraries unless they are confirmed compatible with Cloudflare Workers runtime.

Important Cloudflare constraints:

* Design the app to be efficient on the Cloudflare Free plan.
* Minimize Worker invocations and database queries.
* Use pagination everywhere for large lists.
* Avoid heavy SSR.
* Prefer SPA + API endpoints.
* Avoid storing uploaded files.
* Do not use a traditional Node.js server.
* Do not require Docker for production deployment.
* Keep the generated frontend bundle small.
* Use environment variables through Wrangler / Cloudflare dashboard.
* Avoid Prisma if it creates compatibility, bundle size, or runtime issues with Cloudflare Workers.
* Prefer simple, Cloudflare-compatible dependencies.

File and external link policy:
The MVP must not include file upload or internal file storage.

Any feature that normally requires uploading or storing files should instead use external links only.

Examples:

* Student documents should be saved as external URLs, not uploaded files.
* Assignment attachments should be external links, not uploaded files.
* Timetable files should be external links, such as Google Sheets, Google Drive, PDF link, Notion link, or any public/private URL.
* Exam resources should be external links.
* Announcement attachments should be external links.
* Teacher resources should be external links.
* Parent/student downloadable materials should be external links.

Database fields for links:

* Use URL fields such as external_url, resource_url, document_url, timetable_url, attachment_url where needed.
* Validate that URL fields are valid URLs.
* Do not store binary files in the database.
* Do not implement file upload in the MVP.
* Do not use Cloudflare R2 in the MVP unless explicitly requested later.

UI behavior for external links:

* Show external links as clear Arabic buttons, for example:

  * فتح الملف
  * عرض الجدول
  * فتح الرابط
  * تحميل من الرابط الخارجي
* If no link exists, show a clean empty state.
* Validate URLs before saving.
* Open external links safely in a new tab using proper rel attributes.

User roles:

1. Super Admin
2. School Admin
3. Teacher
4. Student
5. Parent

MVP modules:

1. Authentication and authorization

* Login
* Logout
* Session-based auth with secure HTTP-only cookies
* Role-based access control
* Protected frontend routes
* Protected API routes
* Basic user profile
* Seed users for testing

2. School setup

* School profile
* Academic years
* Terms / semesters
* Grades / stages
* Classes
* Subjects
* General school timetable URL
* Optional school resource URLs

3. Students management

* Add student
* Edit student
* Delete/deactivate student
* Student profile
* Assign student to class
* Link student to parent
* Student status: active, inactive, graduated
* Student documents should be external URLs only
* Do not upload student files

4. Teachers management

* Add teacher
* Edit teacher
* Delete/deactivate teacher
* Teacher profile
* Assign teacher to subjects and classes
* Teacher resources should be external URLs only

5. Attendance

* Teacher can mark attendance by class and date
* Attendance statuses:

  * present
  * absent
  * late
  * excused
* Admin can view attendance reports
* Parent can view attendance for linked children
* Student can view own attendance
* Use pagination and filtering by class/date/student

6. Grades and exams

* Admin/teacher can create exams or assessments
* Teacher can enter marks
* Calculate total, percentage, and simple grade status
* Student can view own grades
* Parent can view grades for linked children
* Exam resources should be external URLs only
* Do not upload exam files

7. Announcements

* Admin can create general announcements
* Teacher can create class-specific announcements
* Students and parents can view relevant announcements
* Announcement attachments should be external URLs only
* Do not upload announcement files

8. Timetable
   For the MVP, prioritize external timetable links instead of uploaded files or complex internal scheduling.

Timetable requirements:

* Admin can add timetable links for the school, grade, or class.
* The link may point to Google Sheets, Google Drive, PDF, Notion, or any external URL.
* Students can view their class timetable link.
* Parents can view timetable links for linked children.
* Teachers can view timetable links for assigned classes.
* Do not implement timetable file upload.
* Optional: keep a simple structured timetable_entries table ready for future expansion, but prioritize external timetable links in the MVP.

The platform should support two timetable modes:

1. External timetable link saved per school, grade, or class.
2. Optional structured timetable inside the system using timetable_entries.

For the MVP:

* Prioritize the external timetable link.
* Add fields where appropriate:

  * schools.general_timetable_url
  * grades.timetable_url
  * classes.timetable_url
* If a class has a timetable_url, show a clear button: "عرض جدول الحصص".
* If no timetable link exists, show an empty state: "لم يتم إضافة جدول بعد".
* Admin can add or update timetable links.
* Teacher, student, and parent can only view relevant timetable links.

9. Assignments

* Teacher can create assignments for classes.
* Students can view assignments.
* Assignment resources should be external links only.
* Students should not upload submissions in the MVP.
* If submission is needed, allow students to submit:

  * text answer
  * external link only
* Teacher can review text/link submissions.
* Do not implement file uploads.

10. Dashboards

* Admin dashboard:

  * total students
  * total teachers
  * total classes
  * today attendance summary
  * recent announcements
* Teacher dashboard:

  * assigned classes
  * today timetable links
  * pending attendance
  * recent announcements
* Student dashboard:

  * attendance summary
  * recent grades
  * announcements
  * timetable link
  * assignments
* Parent dashboard:

  * linked children
  * attendance summary
  * recent grades
  * announcements
  * timetable links
  * assignments

Database design:
Create a clean relational schema for Cloudflare D1 SQLite.

Suggested tables:

* users
* schools
* academic_years
* terms
* grades
* classes
* subjects
* students
* parents
* teachers
* student_parent_links
* teacher_class_subjects
* attendance_records
* exams
* marks
* assignments
* assignment_submissions
* announcements
* announcement_targets
* timetable_entries
* sessions
* audit_logs, only if simple enough

Suggested link-related fields:

* schools.general_timetable_url
* schools.website_url
* grades.timetable_url
* classes.timetable_url
* students.document_url
* teachers.resource_url
* exams.resource_url
* assignments.resource_url
* assignment_submissions.submission_url
* announcements.attachment_url

Database requirements:

* Use UUID or text IDs where appropriate.
* Add created_at and updated_at fields.
* Add indexes for common queries.
* Add foreign keys where D1 supports them properly.
* Keep schema simple and easy to maintain.
* Provide migrations.
* Provide seed data.
* Use URL fields instead of file fields.
* Do not store binary files.
* Do not store large text blobs unless needed.
* Use pagination-friendly queries.

Security requirements:

* Validate all API inputs.
* Validate URL fields.
* Sanitize and normalize user input.
* Protect every API endpoint by role.
* Never expose password hashes.
* Use secure HTTP-only cookies.
* Use CSRF-aware design if using cookies.
* Apply least privilege access.
* Parents must only access their linked children.
* Students must only access their own data.
* Teachers must only manage assigned classes/subjects.
* Add server-side authorization checks, not frontend-only checks.
* External links should be safely rendered.
* Use target="_blank" with rel="noopener noreferrer" for external links.

UI/UX requirements:

* Arabic RTL interface.
* Mobile-first layout.
* Works very well on small screens.
* Desktop layout should use sidebar navigation.
* Mobile layout should use bottom navigation or collapsible menu.
* Clean dashboard cards.
* Tables should become cards/lists on mobile.
* Forms should be simple and validated.
* Use loading states.
* Use empty states.
* Use error states.
* Use toast notifications.
* Make the design modern, calm, and suitable for a school.
* Keep the UI accessible.
* Use Arabic labels and messages.
* Keep the app fast and lightweight.

Suggested frontend pages:

* /login
* /dashboard
* /students
* /students/:id
* /teachers
* /teachers/:id
* /classes
* /subjects
* /attendance
* /grades
* /assignments
* /announcements
* /timetable
* /settings/school
* /profile

API requirements:
Use REST-style endpoints under /api.

Suggested endpoints:

* POST /api/auth/login

* POST /api/auth/logout

* GET /api/auth/me

* GET /api/dashboard

* GET/POST /api/students

* GET/PATCH/DELETE /api/students/:id

* GET/POST /api/teachers

* GET/PATCH/DELETE /api/teachers/:id

* GET/POST /api/classes

* GET/PATCH/DELETE /api/classes/:id

* GET/POST /api/subjects

* GET/PATCH/DELETE /api/subjects/:id

* GET/POST /api/attendance

* GET /api/attendance/reports

* GET/POST /api/exams

* GET/PATCH/DELETE /api/exams/:id

* GET/POST /api/marks

* GET/PATCH/DELETE /api/marks/:id

* GET/POST /api/assignments

* GET/PATCH/DELETE /api/assignments/:id

* GET/POST /api/assignment-submissions

* PATCH /api/assignment-submissions/:id

* GET/POST /api/announcements

* GET/PATCH/DELETE /api/announcements/:id

* GET/POST /api/timetable

* GET/PATCH /api/school

Implementation process:

1. Inspect the project folder.
2. Propose the architecture briefly.
3. Create the project structure.
4. Configure TypeScript, Vite, Tailwind CSS, RTL support, and routing.
5. Configure Cloudflare Workers/Pages Functions and Wrangler.
6. Create D1 database schema migrations.
7. Add seed data.
8. Implement authentication and role-based authorization.
9. Implement frontend layout and navigation.
10. Implement modules one by one:

* school setup
* students
* teachers
* classes
* subjects
* attendance
* grades
* assignments
* announcements
* timetable links
* dashboards

11. Test the full user flows.
12. Add README with setup and deployment steps.

Project structure suggestion:

* src/

  * app/
  * components/
  * pages/
  * routes/
  * hooks/
  * lib/
  * api-client/
  * types/
  * styles/
* functions/ or worker/

  * api/
  * middleware/
  * db/
  * auth/
  * validators/
* migrations/
* seeds/
* wrangler.toml
* README.md
* .env.example

Quality requirements:

* Keep code clean and modular.
* Use TypeScript types everywhere.
* Avoid duplicated logic.
* Add reusable components.
* Add clear error handling.
* Add comments only where useful.
* Make reasonable decisions when details are missing.
* Do not stop to ask for confirmation after every step.
* After each major step, run checks/build if possible and fix errors.
* Keep the MVP simple and extendable.

Testing requirements:
Add basic tests if the setup remains simple.

At minimum, manually verify:

* login/logout
* role redirects
* protected APIs
* student CRUD
* teacher CRUD
* class CRUD
* subject CRUD
* attendance flow
* grades flow
* assignment flow with external links only
* announcement flow with external links only
* timetable link flow
* parent can only see linked children
* student can only see own data
* teacher can only manage assigned classes/subjects

README requirements:
Include:

* Project overview
* Tech stack
* Local setup
* Cloudflare setup
* D1 setup
* Wrangler commands
* Environment variables
* Seed users
* Deployment steps
* How external links are handled instead of uploads
* Known limitations
* Future improvements

Seed users:
Create demo users for:

* super admin
* school admin
* teacher
* student
* parent

MVP limitations:
Do not implement advanced features yet:

* online payments
* chat
* video classes
* internal file uploads
* complex notifications
* multi-school SaaS billing
* advanced analytics
* Cloudflare R2 storage
* native mobile app

Future-ready design:
Keep the architecture ready to later add:

* WhatsApp notifications
* SMS notifications
* file uploads using Cloudflare R2
* payment integration
* mobile app
* multi-school subscriptions
* advanced timetable builder
* advanced reporting

Final instruction:
Start now by inspecting the folder, then create a brief implementation plan, then begin implementation immediately. Build the MVP end-to-end. Do not ask me for confirmation after every step. Make reasonable technical decisions and document them in the README.

