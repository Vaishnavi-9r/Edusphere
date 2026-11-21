-- Needed for GiST equality operator classes used by the exclusion constraints below.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Composite unique indexes provide tenant-aware targets for all timetable foreign keys.
CREATE UNIQUE INDEX "Teacher_tenantId_id_key" ON "Teacher"("tenantId", "id");
CREATE UNIQUE INDEX "Subject_tenantId_id_key" ON "Subject"("tenantId", "id");
CREATE UNIQUE INDEX "Course_tenantId_id_academicYear_key" ON "Course"("tenantId", "id", "academicYear");

CREATE TABLE "Timetable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Timetable_tenantId_courseId_academicYear_term_key"
      UNIQUE ("tenantId", "courseId", "academicYear", "term"),
    CONSTRAINT "Timetable_tenantId_id_courseId_academicYear_term_key"
      UNIQUE ("tenantId", "id", "courseId", "academicYear", "term")
);

CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "timetableId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TIME(0) NOT NULL,
    "endTime" TIME(0) NOT NULL,
    "classroom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TimetableEntry_dayOfWeek_check" CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6),
    CONSTRAINT "TimetableEntry_timeOrder_check" CHECK ("startTime" < "endTime")
);

CREATE INDEX "Timetable_tenantId_courseId_academicYear_idx"
ON "Timetable"("tenantId", "courseId", "academicYear");

CREATE INDEX "TimetableEntry_tenantId_timetableId_dayOfWeek_startTime_idx"
ON "TimetableEntry"("tenantId", "timetableId", "dayOfWeek", "startTime");

CREATE INDEX "TimetableEntry_tenantId_subjectId_idx"
ON "TimetableEntry"("tenantId", "subjectId");

ALTER TABLE "Timetable"
ADD CONSTRAINT "Timetable_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Timetable"
ADD CONSTRAINT "Timetable_tenantId_courseId_academicYear_fkey"
FOREIGN KEY ("tenantId", "courseId", "academicYear")
REFERENCES "Course"("tenantId", "id", "academicYear") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TimetableEntry"
ADD CONSTRAINT "TimetableEntry_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TimetableEntry"
ADD CONSTRAINT "TimetableEntry_timetable_fkey"
FOREIGN KEY ("tenantId", "timetableId", "courseId", "academicYear", "term")
REFERENCES "Timetable"("tenantId", "id", "courseId", "academicYear", "term") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TimetableEntry"
ADD CONSTRAINT "TimetableEntry_course_fkey"
FOREIGN KEY ("tenantId", "courseId", "academicYear")
REFERENCES "Course"("tenantId", "id", "academicYear") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TimetableEntry"
ADD CONSTRAINT "TimetableEntry_subject_fkey"
FOREIGN KEY ("tenantId", "subjectId")
REFERENCES "Subject"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TimetableEntry"
ADD CONSTRAINT "TimetableEntry_teacher_fkey"
FOREIGN KEY ("tenantId", "teacherId")
REFERENCES "Teacher"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Require the pre-existing course-subject and teacher-subject assignments.
ALTER TABLE "TimetableEntry"
ADD CONSTRAINT "TimetableEntry_courseSubject_fkey"
FOREIGN KEY ("tenantId", "courseId", "subjectId")
REFERENCES "CourseSubject"("tenantId", "courseId", "subjectId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TimetableEntry"
ADD CONSTRAINT "TimetableEntry_teacherSubject_fkey"
FOREIGN KEY ("tenantId", "teacherId", "subjectId")
REFERENCES "TeacherSubject"("tenantId", "teacherId", "subjectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Half-open time ranges allow back-to-back periods and reject concurrent overlaps.
ALTER TABLE "TimetableEntry"
ADD CONSTRAINT "TimetableEntry_no_teacher_overlap"
EXCLUDE USING GIST (
    "tenantId" WITH =,
    "academicYear" WITH =,
    "term" WITH =,
    "teacherId" WITH =,
    "dayOfWeek" WITH =,
    (tsrange('2000-01-01'::date + "startTime", '2000-01-01'::date + "endTime", '[)')) WITH &&
);

ALTER TABLE "TimetableEntry"
ADD CONSTRAINT "TimetableEntry_no_course_overlap"
EXCLUDE USING GIST (
    "tenantId" WITH =,
    "academicYear" WITH =,
    "term" WITH =,
    "courseId" WITH =,
    "dayOfWeek" WITH =,
    (tsrange('2000-01-01'::date + "startTime", '2000-01-01'::date + "endTime", '[)')) WITH &&
);

ALTER TABLE "TimetableEntry"
ADD CONSTRAINT "TimetableEntry_no_classroom_overlap"
EXCLUDE USING GIST (
    "tenantId" WITH =,
    "academicYear" WITH =,
    "term" WITH =,
    "classroom" WITH =,
    "dayOfWeek" WITH =,
    (tsrange('2000-01-01'::date + "startTime", '2000-01-01'::date + "endTime", '[)')) WITH &&
);
