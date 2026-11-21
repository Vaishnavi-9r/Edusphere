-- Add an optional authenticated User link for existing Student profiles.
-- Existing students remain unchanged and can be linked by an administrator later.
ALTER TABLE "Student" ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");
CREATE UNIQUE INDEX "Student_tenantId_userId_key" ON "Student"("tenantId", "userId");

ALTER TABLE "Student"
ADD CONSTRAINT "Student_tenantId_userId_fkey"
FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;
