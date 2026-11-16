import { test, expect } from "@playwright/test";

test.describe("Unauthenticated access", () => {
  test("login page loads successfully", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: /selamat datang|login|masuk/i }),
    ).toBeVisible();
  });

  test("protected route redirects to login", async ({ page }) => {
    await page.goto("/dashboard/supervisor/monitoring");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
    expect(page.url()).toContain("redirect=");
  });

  test("workshop login page is accessible without auth", async ({ page }) => {
    const res = await page.goto("/workshop/login");
    expect(res?.status()).toBe(200);
  });
});

test.describe("Login page content", () => {
  test("keeps the dashboard submit button reachable on a short mobile screen", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/login");

    const submitButton = page.getByRole("button", { name: "Masuk ke Dashboard" });
    await expect(submitButton).toBeVisible();

    const bounds = await submitButton.boundingBox();
    expect(bounds).not.toBeNull();
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(640);
  });

  test("keeps the dashboard submit button reachable in mobile landscape", async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 320 });
    await page.goto("/login");

    const loginShell = page.locator("[data-dashboard-login]");
    await loginShell.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));

    const bounds = await page.getByRole("button", { name: "Masuk ke Dashboard" }).boundingBox();
    expect(bounds).not.toBeNull();
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(320);
  });

  test("has email and password fields", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("shows error on empty submit", async ({ page }) => {
    await page.goto("/login");

    const submitBtn = page.getByRole("button", { name: /masuk/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await expect(
        page.locator('[class*="error"], [class*="Error"], [role="alert"]'),
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
