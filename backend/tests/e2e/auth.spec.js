const { test, expect } = require("@playwright/test");
const { randomBytes } = require("node:crypto");

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test("valid login returns a JWT accepted by the protected identity endpoint", async ({ request }) => {
  test.skip(
    !adminEmail || !adminPassword,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run credential-based authentication checks."
  );

  const loginResponse = await request.post("/api/auth/login", {
    data: { email: adminEmail, password: adminPassword },
  });
  expect(loginResponse.status()).toBe(200);

  const loginBody = await loginResponse.json();
  const token = loginBody.token;
  const jwtParts = typeof token === "string" ? token.split(".") : [];
  expect(jwtParts.length === 3 && jwtParts.every(part => /^[A-Za-z0-9_-]+$/.test(part))).toBeTruthy();

  const identityResponse = await request.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(identityResponse.status()).toBe(200);

  const identityBody = await identityResponse.json();
  expect(identityBody.success === true && Boolean(
    identityBody.user?.id && identityBody.user?.tenantId && identityBody.user?.role
  )).toBeTruthy();
});

test("invalid password is rejected", async ({ request }) => {
  test.skip(
    !adminEmail || !adminPassword,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run credential-based authentication checks."
  );

  const response = await request.post("/api/auth/login", {
    data: { email: adminEmail, password: randomBytes(32).toString("base64url") },
  });

  expect(response.status()).toBe(401);
});

test("missing token is rejected by the protected identity endpoint", async ({ request }) => {
  const response = await request.get("/api/auth/me");

  expect(response.status()).toBe(401);
});

test("invalid Bearer token is rejected by the protected identity endpoint", async ({ request }) => {
  const response = await request.get("/api/auth/me", {
    headers: { Authorization: "Bearer invalid-e2e-token" },
  });

  expect(response.status()).toBe(401);
});
