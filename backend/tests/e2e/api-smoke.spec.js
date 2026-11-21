const { test, expect } = require("@playwright/test");

test("Swagger API documentation is available", async ({ request }) => {
  const response = await request.get("/api-docs/");

  expect(response.ok()).toBeTruthy();
});
