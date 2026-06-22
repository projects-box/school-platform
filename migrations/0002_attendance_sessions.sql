-- Attendance per class session (configurable: whole-day vs per-lecture).

-- School-wide attendance configuration.
ALTER TABLE schools ADD COLUMN attendance_mode TEXT NOT NULL DEFAULT 'daily' CHECK (attendance_mode IN ('daily','per_session'));
ALTER TABLE schools ADD COLUMN sessions_per_day INTEGER NOT NULL DEFAULT 6;

-- Rebuild attendance_records to add a session dimension. SQLite can't alter a
-- UNIQUE constraint in place, so recreate the table. Existing daily rows become
-- session_no = 0. No other table references attendance_records, so this is safe.
ALTER TABLE attendance_records RENAME TO attendance_records_old;

CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES classes(id),
  date TEXT NOT NULL,
  session_no INTEGER NOT NULL DEFAULT 0,
  subject_id TEXT REFERENCES subjects(id),
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  note TEXT,
  recorded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, date, session_no)
);

INSERT INTO attendance_records (id, student_id, class_id, date, session_no, subject_id, status, note, recorded_by, created_at, updated_at)
SELECT id, student_id, class_id, date, 0, NULL, status, note, recorded_by, created_at, updated_at FROM attendance_records_old;

DROP TABLE attendance_records_old;

CREATE INDEX idx_attendance_class_date ON attendance_records(class_id, date);
CREATE INDEX idx_attendance_student_date ON attendance_records(student_id, date);
