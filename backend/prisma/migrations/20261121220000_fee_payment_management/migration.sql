-- Redundant candidate key needed for the optional enrollment composite foreign key.
CREATE UNIQUE INDEX "StudentEnrollment_tenantId_id_studentId_academicYear_key"
ON "StudentEnrollment"("tenantId", "id", "studentId", "academicYear");

CREATE TYPE "FeeCategory" AS ENUM ('TUITION', 'EXAMINATION', 'TRANSPORT', 'LIBRARY', 'OTHER');
CREATE TYPE "StudentFeeStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER');

CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "FeeCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "courseId" TEXT,
    "dueDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeeStructure_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE "StudentFee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "academicYear" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "dueDate" DATE NOT NULL,
    "status" "StudentFeeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFee_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudentFee_tenantId_studentId_feeStructureId_key" UNIQUE ("tenantId", "studentId", "feeStructureId"),
    CONSTRAINT "StudentFee_amounts_check" CHECK ("totalAmount" > 0 AND "amountPaid" >= 0 AND "amountPaid" <= "totalAmount")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentFeeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "transactionReference" TEXT,
    "paymentDate" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payment_tenantId_transactionReference_key" UNIQUE ("tenantId", "transactionReference"),
    CONSTRAINT "Payment_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "FeeStructure_tenantId_id_key" ON "FeeStructure"("tenantId", "id");
CREATE UNIQUE INDEX "FeeStructure_tenantId_id_academicYear_key" ON "FeeStructure"("tenantId", "id", "academicYear");
CREATE INDEX "FeeStructure_tenantId_academicYear_category_isActive_idx" ON "FeeStructure"("tenantId", "academicYear", "category", "isActive");
CREATE INDEX "FeeStructure_tenantId_courseId_idx" ON "FeeStructure"("tenantId", "courseId");
CREATE UNIQUE INDEX "StudentFee_tenantId_id_key" ON "StudentFee"("tenantId", "id");
CREATE INDEX "StudentFee_tenantId_studentId_status_idx" ON "StudentFee"("tenantId", "studentId", "status");
CREATE INDEX "StudentFee_tenantId_feeStructureId_idx" ON "StudentFee"("tenantId", "feeStructureId");
CREATE INDEX "StudentFee_tenantId_enrollmentId_idx" ON "StudentFee"("tenantId", "enrollmentId");
CREATE INDEX "Payment_tenantId_studentFeeId_paymentDate_idx" ON "Payment"("tenantId", "studentFeeId", "paymentDate");
CREATE INDEX "Payment_tenantId_paymentDate_idx" ON "Payment"("tenantId", "paymentDate");

ALTER TABLE "FeeStructure"
ADD CONSTRAINT "FeeStructure_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeStructure"
ADD CONSTRAINT "FeeStructure_tenantId_courseId_academicYear_fkey"
FOREIGN KEY ("tenantId", "courseId", "academicYear") REFERENCES "Course"("tenantId", "id", "academicYear") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentFee"
ADD CONSTRAINT "StudentFee_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentFee"
ADD CONSTRAINT "StudentFee_tenantId_studentId_fkey"
FOREIGN KEY ("tenantId", "studentId") REFERENCES "Student"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentFee"
ADD CONSTRAINT "StudentFee_tenantId_feeStructureId_academicYear_fkey"
FOREIGN KEY ("tenantId", "feeStructureId", "academicYear") REFERENCES "FeeStructure"("tenantId", "id", "academicYear") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentFee"
ADD CONSTRAINT "StudentFee_tenantId_enrollmentId_studentId_academicYear_fkey"
FOREIGN KEY ("tenantId", "enrollmentId", "studentId", "academicYear")
REFERENCES "StudentEnrollment"("tenantId", "id", "studentId", "academicYear") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_tenantId_studentFeeId_fkey"
FOREIGN KEY ("tenantId", "studentFeeId") REFERENCES "StudentFee"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_tenantId_receivedById_fkey"
FOREIGN KEY ("tenantId", "receivedById") REFERENCES "User"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
