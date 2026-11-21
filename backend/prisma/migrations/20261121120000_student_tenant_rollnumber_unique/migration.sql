-- Enforce roll-number uniqueness within each tenant.
CREATE UNIQUE INDEX "Student_tenantId_rollNumber_key"
ON "Student"("tenantId", "rollNumber");
