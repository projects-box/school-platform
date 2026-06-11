import { Hono } from "hono";
import type { AppEnv } from "../lib/app";
import { inPlaceholders, visibleClassIds } from "../lib/app";
import type { TimetableLink } from "../../shared/types";

const timetable = new Hono<AppEnv>();

// Aggregated timetable links relevant to the current user:
// school general link + grade/class links for visible classes.
// Admin edits the links via PATCH /api/school, /api/grades/:id, /api/classes/:id.
timetable.get("/", async (c) => {
  const links: TimetableLink[] = [];

  const school = await c.env.DB.prepare("SELECT id, name, general_timetable_url FROM schools LIMIT 1").first<{
    id: string;
    name: string;
    general_timetable_url: string | null;
  }>();
  if (school) {
    links.push({ scope: "school", scope_id: school.id, label: "الجدول العام للمدرسة", url: school.general_timetable_url });
  }

  const allowed = await visibleClassIds(c);
  let rows: { id: string; name: string; timetable_url: string | null; grade_id: string; grade_name: string; grade_timetable_url: string | null }[];
  if (allowed === null) {
    const { results } = await c.env.DB.prepare(
      `SELECT cl.id, cl.name, cl.timetable_url, g.id AS grade_id, g.name AS grade_name, g.timetable_url AS grade_timetable_url
       FROM classes cl JOIN grades g ON g.id = cl.grade_id WHERE cl.is_active = 1 ORDER BY g.level, cl.name`,
    ).all<(typeof rows)[number]>();
    rows = results;
  } else if (allowed.length) {
    const { results } = await c.env.DB.prepare(
      `SELECT cl.id, cl.name, cl.timetable_url, g.id AS grade_id, g.name AS grade_name, g.timetable_url AS grade_timetable_url
       FROM classes cl JOIN grades g ON g.id = cl.grade_id WHERE cl.id IN ${inPlaceholders(allowed.length)} ORDER BY g.level, cl.name`,
    )
      .bind(...allowed)
      .all<(typeof rows)[number]>();
    rows = results;
  } else {
    rows = [];
  }

  const seenGrades = new Set<string>();
  for (const row of rows) {
    if (!seenGrades.has(row.grade_id)) {
      seenGrades.add(row.grade_id);
      links.push({ scope: "grade", scope_id: row.grade_id, label: `جدول ${row.grade_name}`, url: row.grade_timetable_url });
    }
    links.push({ scope: "class", scope_id: row.id, label: `جدول فصل ${row.name}`, url: row.timetable_url });
  }

  return c.json({ items: links });
});

export default timetable;
