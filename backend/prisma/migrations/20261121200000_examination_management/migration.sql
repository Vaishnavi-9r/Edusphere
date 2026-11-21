CREATE TYPE "ExamType" AS ENUM ('UNIT_TEST', 'MID_TERM', 'FINAL_EXAM', 'PRACTICAL', 'ASSIGNMENT');

CREATE TABLE "Examination" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "courseId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "examDate" DATE NOT NULL,
    "startTime" TIME(0) NOT NULL,
    "endTime" TIME(0) NOT NULL,
    "maximumMarks" DECIMAL(8,2) NOT NULL,
    "passingMarks" DECIMAL(8,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Examination_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Examination_timeOrder_check" CHECK ("startTime" < "endTime"),
    CONSTRAINT "Examination_marks_check" CHECK ("maximumMarks" > 0 AND "passingMarks" >= 0 AND "passingMarks" <= "maximumMarks")
);

CREATE INDEX "Examination_tenantId_examDate_idx" ON "Examination"("tenantId", "examDate");
CREATE INDEX "Examination_tenantId_courseId_examDate_idx" ON "Examination"("tenantId", "courseId", "examDate");
CREATE INDEX "Examination_tenantId_subjectId_examDate_idx" ON "Examination"("tenantId", "subjectId", "examDate");
CREATE INDEX "Examination_tenantId_academicYear_examType_idx" ON "Examination"("tenantId", "academicYear", "examType");

ALTER TABLE "Examination"
ADD CONSTRAINT "Examination_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Examination"
ADD CONSTRAINT "Examination_tenantId_courseId_academicYear_fkey"
FOREIGN KEY ("tenantId", "courseId", "academicYear")
REFERENCES "Course"("tenantId", "id", "academicYear") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Examination"
ADD CONSTRAINT "Examination_tenantId_subjectId_fkey"
FOREIGN KEY ("tenantId", "subjectId")
REFERENCES "Subject"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Examination"
ADD CONSTRAINT "Examination_tenantId_courseId_subjectId_fkey"
FOREIGN KEY ("tenantId", "courseId", "subjectId")
REFERENCES "CourseSubject"("tenantId", "courseId", "subjectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prevent overlapping exams for the same course or subject, including concurrent inserts.
ALTER TABLE "Examination"
ADD CONSTRAINT "Examination_no_course_overlap"
EXCLUDE USING GIST (
    "tenantId" WITH =,
    "courseId" WITH =,
    "examDate" WITH =,
    (tsrange("examDate" + "startTime", "examDate" + "endTime", '[)')) WITH &&
);

ALTER TABLE "Examination"
ADD CONSTRAINT "Examination_no_subject_overlap"
EXCLUDE USING GIST (
    "tenantId" WITH =,
    "subjectId" WITH =,
    "examDate" WITH =,
    (tsrange("examDate" + "startTime", "examDate" + "endTime", '[)')) WITH &&
);
