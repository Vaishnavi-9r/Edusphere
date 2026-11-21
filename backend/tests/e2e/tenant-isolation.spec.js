const { test, expect } = require("@playwright/test");

const schoolA = {
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};
const schoolB = {
  email: process.env.E2E_SCHOOL_B_EMAIL,
  password: process.env.E2E_SCHOOL_B_PASSWORD,
};

async function login(request, credentials) {
  const response = await request.post("/api/auth/login", {
    data: { email: credentials.email, password: credentials.password },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(typeof body.token === "string" && body.token.length > 0).toBeTruthy();
  return body.token;
}

async function getTenantId(request, token) {
  const response = await request.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(typeof body.user?.tenantId === "string" && body.user.tenantId.length > 0).toBeTruthy();
  return body.user.tenantId;
}

async function findExistingStudentId(request, token, schoolName) {
  const response = await request.get("/api/students", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  const id = body.students?.[0]?.id;
  test.skip(!id, `No existing student record is available for ${schoolName}.`);
  return id;
}

test("School A can read its own existing student", async ({ request }) => {
  test.skip(
    !schoolA.email || !schoolA.password,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for the School A test account."
  );

  const token = await login(request, schoolA);
  const studentId = await findExistingStudentId(request, token, "School A");
  const response = await request.get(`/api/students/${studentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.success === true && body.student?.id === studentId).toBeTruthy();
});

test("School B can read its own existing student", async ({ request }) => {
  test.skip(
    !schoolB.email || !schoolB.password,
    "Set E2E_SCHOOL_B_EMAIL and E2E_SCHOOL_B_PASSWORD for an existing School B test account."
  );

  const token = await login(request, schoolB);
  const studentId = await findExistingStudentId(request, token, "School B");
  const response = await request.get(`/api/students/${studentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.success === true && body.student?.id === studentId).toBeTruthy();
});

test("School A cannot read School B's existing student", async ({ request }) => {
  test.skip(
    !schoolA.email || !schoolA.password,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for the School A test account."
  );
  test.skip(
    !schoolB.email || !schoolB.password,
    "Set E2E_SCHOOL_B_EMAIL and E2E_SCHOOL_B_PASSWORD for an existing School B test account."
  );

  const schoolAToken = await login(request, schoolA);
  const schoolBToken = await login(request, schoolB);
  const schoolATenantId = await getTenantId(request, schoolAToken);
  const schoolBTenantId = await getTenantId(request, schoolBToken);
  test.skip(
    schoolATenantId === schoolBTenantId,
    "The configured School A and School B accounts belong to the same tenant."
  );
  const schoolAStudentId = await findExistingStudentId(request, schoolAToken, "School A");
  const schoolBStudentId = await findExistingStudentId(request, schoolBToken, "School B");

  const response = await request.get(`/api/students/${schoolBStudentId}`, {
    headers: { Authorization: `Bearer ${schoolAToken}` },
  });

  expect(response.status()).toBe(404);
});
