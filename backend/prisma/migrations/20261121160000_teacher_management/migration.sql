ALTER TABLE "User"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "qualification" TEXT,
    "specialization" TEXT,
    "joiningDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");
CREATE UNIQUE INDEX "Teacher_tenantId_employeeId_key" ON "Teacher"("tenantId", "employeeId");
CREATE INDEX "Teacher_tenantId_idx" ON "Teacher"("tenantId");

ALTER TABLE "Teacher"
ADD CONSTRAINT "Teacher_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Teacher"
ADD CONSTRAINT "Teacher_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
