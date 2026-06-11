-- Demo seed data. All seed users share the password: Demo@1234
-- Safe to re-run: clears existing data first (reverse dependency order).

DELETE FROM timetable_entries;
DELETE FROM announcements;
DELETE FROM assignment_submissions;
DELETE FROM assignments;
DELETE FROM marks;
DELETE FROM exams;
DELETE FROM attendance_records;
DELETE FROM teacher_class_subjects;
DELETE FROM student_parent_links;
DELETE FROM teachers;
DELETE FROM students;
DELETE FROM subjects;
DELETE FROM classes;
DELETE FROM grades;
DELETE FROM terms;
DELETE FROM academic_years;
DELETE FROM sessions;
DELETE FROM users;
DELETE FROM schools;

INSERT INTO schools (id, name, address, phone, email, website_url, general_timetable_url) VALUES
  ('sch_001', 'مدرسة النور الأهلية', 'حي الروضة، شارع الأمير سلطان', '+966112345678', 'info@alnoor-school.example', 'https://alnoor-school.example', 'https://docs.google.com/spreadsheets/d/demo-general-timetable');

INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_current) VALUES
  ('yr_2526', 'sch_001', '2025-2026', '2025-09-01', '2026-06-30', 1);

INSERT INTO terms (id, academic_year_id, name, start_date, end_date, is_current) VALUES
  ('trm_1', 'yr_2526', 'الفصل الدراسي الأول', '2025-09-01', '2026-01-15', 0),
  ('trm_2', 'yr_2526', 'الفصل الدراسي الثاني', '2026-01-20', '2026-06-30', 1);

INSERT INTO grades (id, school_id, name, level, timetable_url) VALUES
  ('grd_1', 'sch_001', 'الصف الأول', 1, 'https://docs.google.com/spreadsheets/d/demo-grade1-timetable'),
  ('grd_2', 'sch_001', 'الصف الثاني', 2, NULL),
  ('grd_3', 'sch_001', 'الصف الثالث', 3, NULL);

INSERT INTO classes (id, school_id, grade_id, name, timetable_url) VALUES
  ('cls_1a', 'sch_001', 'grd_1', 'الأول - أ', 'https://docs.google.com/spreadsheets/d/demo-class-1a-timetable'),
  ('cls_1b', 'sch_001', 'grd_1', 'الأول - ب', NULL),
  ('cls_2a', 'sch_001', 'grd_2', 'الثاني - أ', NULL),
  ('cls_3a', 'sch_001', 'grd_3', 'الثالث - أ', NULL);

INSERT INTO subjects (id, school_id, name, code) VALUES
  ('sub_ar',   'sch_001', 'اللغة العربية', 'AR'),
  ('sub_en',   'sch_001', 'اللغة الإنجليزية', 'EN'),
  ('sub_math', 'sch_001', 'الرياضيات', 'MATH'),
  ('sub_sci',  'sch_001', 'العلوم', 'SCI'),
  ('sub_isl',  'sch_001', 'التربية الإسلامية', 'ISL');

-- password for all: Demo@1234
INSERT INTO users (id, school_id, role, username, password_hash, full_name, email, phone) VALUES
  ('usr_super', NULL,      'super_admin',  'superadmin', 'pbkdf2:100000:c2VlZC1zYWx0LTAwMQ==:EFa85l4jc15daPPu3nlXP3QgwZuOPSSz6d15SrHVFog=', 'مدير المنصة', 'super@school.example', NULL),
  ('usr_admin', 'sch_001', 'school_admin', 'admin',      'pbkdf2:100000:c2VlZC1zYWx0LTAwMQ==:EFa85l4jc15daPPu3nlXP3QgwZuOPSSz6d15SrHVFog=', 'أ. خالد الإداري', 'admin@school.example', '+966500000001'),
  ('usr_t1',    'sch_001', 'teacher',      'teacher1',   'pbkdf2:100000:c2VlZC1zYWx0LTAwMQ==:EFa85l4jc15daPPu3nlXP3QgwZuOPSSz6d15SrHVFog=', 'أ. محمد العمري', 'm.alomari@school.example', '+966500000002'),
  ('usr_t2',    'sch_001', 'teacher',      'teacher2',   'pbkdf2:100000:c2VlZC1zYWx0LTAwMQ==:EFa85l4jc15daPPu3nlXP3QgwZuOPSSz6d15SrHVFog=', 'أ. سارة الأحمد', 's.alahmad@school.example', '+966500000003'),
  ('usr_s1',    'sch_001', 'student',      'student1',   'pbkdf2:100000:c2VlZC1zYWx0LTAwMQ==:EFa85l4jc15daPPu3nlXP3QgwZuOPSSz6d15SrHVFog=', 'عمر أحمد عبدالله', NULL, NULL),
  ('usr_s2',    'sch_001', 'student',      'student2',   'pbkdf2:100000:c2VlZC1zYWx0LTAwMQ==:EFa85l4jc15daPPu3nlXP3QgwZuOPSSz6d15SrHVFog=', 'ليان خالد السالم', NULL, NULL),
  ('usr_s3',    'sch_001', 'student',      'student3',   'pbkdf2:100000:c2VlZC1zYWx0LTAwMQ==:EFa85l4jc15daPPu3nlXP3QgwZuOPSSz6d15SrHVFog=', 'يوسف محمد الحربي', NULL, NULL),
  ('usr_s4',    'sch_001', 'student',      'student4',   'pbkdf2:100000:c2VlZC1zYWx0LTAwMQ==:EFa85l4jc15daPPu3nlXP3QgwZuOPSSz6d15SrHVFog=', 'جنى أحمد عبدالله', NULL, NULL),
  ('usr_s5',    'sch_001', 'student',      'student5',   'pbkdf2:100000:c2VlZC1zYWx0LTAwMQ==:EFa85l4jc15daPPu3nlXP3QgwZuOPSSz6d15SrHVFog=', 'فهد سالم القحطاني', NULL, NULL),
  ('usr_s6',    'sch_001', 'student',      'student6',   'pbkdf2:100000:c2VlZC1zYWx0LTAwMQ==:EFa85l4jc15daPPu3nlXP3QgwZuOPSSz6d15SrHVFog=', 'نورة علي الزهراني', NULL, NULL),
  ('usr_p1',    'sch_001', 'parent',       'parent1',    'pbkdf2:100000:c2VlZC1zYWx0LTAwMQ==:EFa85l4jc15daPPu3nlXP3QgwZuOPSSz6d15SrHVFog=', 'أحمد عبدالله (ولي أمر)', 'parent1@example.com', '+966500000010'),
  ('usr_p2',    'sch_001', 'parent',       'parent2',    'pbkdf2:100000:c2VlZC1zYWx0LTAwMQ==:EFa85l4jc15daPPu3nlXP3QgwZuOPSSz6d15SrHVFog=', 'خالد السالم (ولي أمر)', 'parent2@example.com', '+966500000011');

INSERT INTO teachers (id, user_id, school_id, specialization, resource_url) VALUES
  ('tch_1', 'usr_t1', 'sch_001', 'رياضيات وعلوم', 'https://drive.google.com/drive/folders/demo-teacher1-resources'),
  ('tch_2', 'usr_t2', 'sch_001', 'لغات', NULL);

INSERT INTO students (id, user_id, school_id, class_id, student_number, date_of_birth, gender, document_url, status) VALUES
  ('st_1', 'usr_s1', 'sch_001', 'cls_1a', 'S-1001', '2018-03-12', 'male',   'https://drive.google.com/file/d/demo-student1-docs', 'active'),
  ('st_2', 'usr_s2', 'sch_001', 'cls_1a', 'S-1002', '2018-07-25', 'female', NULL, 'active'),
  ('st_3', 'usr_s3', 'sch_001', 'cls_1a', 'S-1003', '2018-01-30', 'male',   NULL, 'active'),
  ('st_4', 'usr_s4', 'sch_001', 'cls_1b', 'S-1004', '2018-11-02', 'female', NULL, 'active'),
  ('st_5', 'usr_s5', 'sch_001', 'cls_2a', 'S-1005', '2017-05-18', 'male',   NULL, 'active'),
  ('st_6', 'usr_s6', 'sch_001', 'cls_3a', 'S-1006', '2016-09-09', 'female', NULL, 'active');

-- parent1 has two children (st_1, st_4); parent2 has one (st_2)
INSERT INTO student_parent_links (id, student_id, parent_user_id, relationship) VALUES
  ('spl_1', 'st_1', 'usr_p1', 'أب'),
  ('spl_2', 'st_4', 'usr_p1', 'أب'),
  ('spl_3', 'st_2', 'usr_p2', 'أب');

INSERT INTO teacher_class_subjects (id, teacher_id, class_id, subject_id) VALUES
  ('tcs_1', 'tch_1', 'cls_1a', 'sub_math'),
  ('tcs_2', 'tch_1', 'cls_1a', 'sub_sci'),
  ('tcs_3', 'tch_1', 'cls_1b', 'sub_math'),
  ('tcs_4', 'tch_1', 'cls_2a', 'sub_math'),
  ('tcs_5', 'tch_2', 'cls_1a', 'sub_ar'),
  ('tcs_6', 'tch_2', 'cls_1a', 'sub_en'),
  ('tcs_7', 'tch_2', 'cls_3a', 'sub_ar');

INSERT INTO attendance_records (id, student_id, class_id, date, status, note, recorded_by) VALUES
  ('att_1', 'st_1', 'cls_1a', '2026-06-09', 'present', NULL, 'usr_t1'),
  ('att_2', 'st_2', 'cls_1a', '2026-06-09', 'late', 'تأخر 15 دقيقة', 'usr_t1'),
  ('att_3', 'st_3', 'cls_1a', '2026-06-09', 'absent', NULL, 'usr_t1'),
  ('att_4', 'st_1', 'cls_1a', '2026-06-10', 'present', NULL, 'usr_t1'),
  ('att_5', 'st_2', 'cls_1a', '2026-06-10', 'present', NULL, 'usr_t1'),
  ('att_6', 'st_3', 'cls_1a', '2026-06-10', 'excused', 'عذر طبي', 'usr_t1');

INSERT INTO exams (id, school_id, class_id, subject_id, term_id, title, exam_date, max_score, resource_url, created_by) VALUES
  ('exm_1', 'sch_001', 'cls_1a', 'sub_math', 'trm_2', 'اختبار الرياضيات - الوحدة الخامسة', '2026-05-20', 20, 'https://drive.google.com/file/d/demo-math-exam-review', 'usr_t1'),
  ('exm_2', 'sch_001', 'cls_1a', 'sub_ar', 'trm_2', 'اختبار اللغة العربية النهائي', '2026-06-01', 100, NULL, 'usr_t2');

INSERT INTO marks (id, exam_id, student_id, score, graded_by) VALUES
  ('mrk_1', 'exm_1', 'st_1', 18, 'usr_t1'),
  ('mrk_2', 'exm_1', 'st_2', 15, 'usr_t1'),
  ('mrk_3', 'exm_1', 'st_3', 9,  'usr_t1'),
  ('mrk_4', 'exm_2', 'st_1', 88, 'usr_t2'),
  ('mrk_5', 'exm_2', 'st_2', 73, 'usr_t2');

INSERT INTO assignments (id, class_id, subject_id, teacher_id, title, description, resource_url, due_date) VALUES
  ('asg_1', 'cls_1a', 'sub_math', 'tch_1', 'واجب جدول الضرب', 'حل تمارين جدول الضرب من 1 إلى 5 في ورقة العمل المرفقة.', 'https://drive.google.com/file/d/demo-math-worksheet', '2026-06-15'),
  ('asg_2', 'cls_1a', 'sub_ar', 'tch_2', 'قراءة قصة وتلخيصها', 'اقرأ القصة المرفقة ثم لخصها في خمسة أسطر.', 'https://drive.google.com/file/d/demo-story', '2026-06-18');

INSERT INTO assignment_submissions (id, assignment_id, student_id, submission_text, submission_url, status, feedback) VALUES
  ('sbm_1', 'asg_1', 'st_1', 'تم حل جميع التمارين، الحل في الرابط المرفق.', 'https://docs.google.com/document/d/demo-omar-solution', 'reviewed', 'ممتاز، استمر!'),
  ('sbm_2', 'asg_1', 'st_2', 'الإجابات: مكتوبة نصياً هنا.', NULL, 'submitted', NULL);

INSERT INTO announcements (id, school_id, class_id, title, body, attachment_url, created_by) VALUES
  ('ann_1', 'sch_001', NULL, 'بداية الاختبارات النهائية', 'تبدأ الاختبارات النهائية يوم الأحد القادم. نتمنى التوفيق لجميع الطلاب. جدول الاختبارات في الرابط المرفق.', 'https://docs.google.com/spreadsheets/d/demo-exam-schedule', 'usr_admin'),
  ('ann_2', 'sch_001', NULL, 'إجازة نهاية العام', 'تبدأ إجازة نهاية العام الدراسي بتاريخ 30 يونيو. عودة حميدة للجميع.', NULL, 'usr_admin'),
  ('ann_3', 'sch_001', 'cls_1a', 'رحلة مدرسية لفصل الأول - أ', 'رحلة إلى المتحف الوطني يوم الخميس. يرجى تعبئة نموذج الموافقة من الرابط.', 'https://forms.google.com/demo-trip-consent', 'usr_t1');

INSERT INTO timetable_entries (id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time) VALUES
  ('tte_1', 'cls_1a', 'sub_math', 'tch_1', 0, '08:00', '08:45'),
  ('tte_2', 'cls_1a', 'sub_ar', 'tch_2', 0, '08:45', '09:30'),
  ('tte_3', 'cls_1a', 'sub_en', 'tch_2', 1, '08:00', '08:45'),
  ('tte_4', 'cls_1a', 'sub_sci', 'tch_1', 1, '08:45', '09:30');
