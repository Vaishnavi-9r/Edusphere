const { test, expect } = require("@playwright/test");

const roleCases = [
  {
    role: "SCHOOL_ADMIN",
    emailVariable: "E2E_ADMIN_EMAIL",
    passwordVariable: "E2E_ADMIN_PASSWORD",
    expectedStatus: 200,
  },
  {
    role: "ADMIN",
    emailVariable: "E2E_SYSTEM_ADMIN_EMAIL",
    passwordVariable: "E2E_SYSTEM_ADMIN_PASSWORD",
    expectedStatus: 200,
  },
  {
    role: "TEACHER",
    emailVariable: "E2E_TEACHER_EMAIL",
    passwordVariable: "E2E_TEACHER_PASSWORD",
    expectedStatus: 403,
  },
  {
    role: "PARENT",
    emailVariable: "E2E_PARENT_EMAIL",
    passwordVariable: "E2E_PARENT_PASSWORD",
    expectedStatus: 403,
  },
  {
    role: "STUDENT",
    emailVariable: "E2E_STUDENT_EMAIL",
    passwordVariable: "E2E_STUDENT_PASSWORD",
    expectedStatus: 403,
  },
];

for (const roleCase of roleCases) {
  test(`${roleCase.role} ${roleCase.expectedStatus === 200 ? "can access" : "is denied access to"} admin dashboard`, async ({ request }) => {
    const email = process.env[roleCase.emailVariable];
    const password = process.env[roleCase.passwordVariable];
    test.skip(
      !email || !password,
      `Set ${roleCase.emailVariable} and ${roleCase.passwordVariable} to run the ${roleCase.role} RBAC check.`
    );

    const loginResponse = await request.post("/api/auth/login", {
      data: { email, password },
    });
    expect(loginResponse.status()).toBe(200);

    const loginBody = await loginResponse.json();
    const token = loginBody.token;
    expect(loginBody.user?.role === roleCase.role && typeof token === "string" && token.length > 0).toBeTruthy();

    const response = await request.get("/api/dashboard/overview", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(roleCase.expectedStatus);
  });
}
