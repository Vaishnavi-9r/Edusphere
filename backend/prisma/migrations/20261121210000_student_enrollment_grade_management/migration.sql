-- The added composite unique indexes are valid because each referenced row already has a primary key.
CREATE UNIQUE INDEX "User_tenantId_id_key" ON "User"("tenantId", "id");
CREATE UNIQUE INDEX "Student_tenantId_id_key" ON "Student"("tenantId", "id");
CREATE UNIQUE INDEX "Examination_tenantId_id_courseId_academicYear_maximumMarks_key"
ON "Examination"("tenantId", "id", "courseId", "academicYear", "maximumMarks");

CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'WITHDRAWN');

CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "enrollmentDate" DATE NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudentEnrollment_tenantId_studentId_courseId_academicYear_key"
      UNIQUE ("tenantId", "studentId", "courseId", "academicYear"),
    CONSTRAINT "StudentEnrollment_tenantId_id_studentId_courseId_academicYear_key"
      UNIQUE ("tenantId", "id", "studentId", "courseId", "academicYear")
);

CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "marksObtained" DECIMAL(8,2) NOT NULL,
    "maximumMarks" DECIMAL(8,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "grade" TEXT NOT NULL,
    "remarks" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Grade_tenantId_studentId_examinationId_key"
      UNIQUE ("tenantId", "studentId", "examinationId"),
    CONSTRAINT "Grade_marks_check"
      CHECK ("maximumMarks" > 0 AND "marksObtained" >= 0 AND "marksObtained" <= "maximumMarks"),
    CONSTRAINT "Grade_percentage_check"
      CHECK ("percentage" >= 0 AND "percentage" <= 100 AND "percentage" = ROUND(("marksObtained" / "maximumMarks") * 100, 2))
);

CREATE INDEX "StudentEnrollment_tenantId_courseId_academicYear_status_idx"
ON "StudentEnrollment"("tenantId", "courseId", "academicYear", "status");
CREATE INDEX "StudentEnrollment_tenantId_studentId_academicYear_idx"
ON "StudentEnrollment"("tenantId", "studentId", "academicYear");
CREATE INDEX "Grade_tenantId_examinationId_idx" ON "Grade"("tenantId", "examinationId");
CREATE INDEX "Grade_tenantId_enrollmentId_idx" ON "Grade"("tenantId", "enrollmentId");
CREATE INDEX "Grade_tenantId_courseId_academicYear_idx" ON "Grade"("tenantId", "courseId", "academicYear");

ALTER TABLE "StudentEnrollment"
ADD CONSTRAINT "StudentEnrollment_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollment"
ADD CONSTRAINT "StudentEnrollment_tenantId_studentId_fkey"
FOREIGN KEY ("tenantId", "studentId") REFERENCES "Student"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollment"
ADD CONSTRAINT "StudentEnrollment_tenantId_courseId_academicYear_fkey"
FOREIGN KEY ("tenantId", "courseId", "academicYear") REFERENCES "Course"("tenantId", "id", "academicYear") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Grade"
ADD CONSTRAINT "Grade_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Grade"
ADD CONSTRAINT "Grade_tenantId_studentId_fkey"
FOREIGN KEY ("tenantId", "studentId") REFERENCES "Student"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Grade"
ADD CONSTRAINT "Grade_tenantId_examinationId_courseId_academicYear_maximumMarks_fkey"
FOREIGN KEY ("tenantId", "examinationId", "courseId", "academicYear", "maximumMarks")
REFERENCES "Examination"("tenantId", "id", "courseId", "academicYear", "maximumMarks") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Grade"
ADD CONSTRAINT "Grade_tenantId_enrollmentId_studentId_courseId_academicYear_fkey"
FOREIGN KEY ("tenantId", "enrollmentId", "studentId", "courseId", "academicYear")
REFERENCES "StudentEnrollment"("tenantId", "id", "studentId", "courseId", "academicYear") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Grade"
ADD CONSTRAINT "Grade_tenantId_courseId_academicYear_fkey"
FOREIGN KEY ("tenantId", "courseId", "academicYear") REFERENCES "Course"("tenantId", "id", "academicYear") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Grade"
ADD CONSTRAINT "Grade_tenantId_enteredById_fkey"
FOREIGN KEY ("tenantId", "enteredById") REFERENCES "User"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
