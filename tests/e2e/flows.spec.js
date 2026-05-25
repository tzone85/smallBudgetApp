import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Default Playwright context is per-test, so localStorage starts empty.
  await page.goto("/");
});

test("set budget, add expenses, balance updates", async ({ page }) => {
  await page.fill("#budget-input", "1000");
  await page.click("#budget-submit");
  await expect(page.locator("#budget-amount")).toHaveText("1000");

  await page.fill("#expense-input", "Rent");
  await page.fill("#amount-input", "400");
  await page.click("#expense-submit");

  await page.fill("#expense-input", "Food");
  await page.fill("#amount-input", "150");
  await page.click("#expense-submit");

  await expect(page.locator("#expense-amount")).toHaveText("550");
  await expect(page.locator("#balance-amount")).toHaveText("450");
  await expect(page.locator("#balance")).toHaveClass(/showGreen/);
});

test("over-spending turns balance red", async ({ page }) => {
  await page.fill("#budget-input", "100");
  await page.click("#budget-submit");

  await page.fill("#expense-input", "Vacation");
  await page.fill("#amount-input", "250");
  await page.click("#expense-submit");

  await expect(page.locator("#balance-amount")).toHaveText("-150");
  await expect(page.locator("#balance")).toHaveClass(/showRed/);
});

test("delete updates total + balance (regression)", async ({ page }) => {
  await page.fill("#budget-input", "500");
  await page.click("#budget-submit");

  await page.fill("#expense-input", "Tools");
  await page.fill("#amount-input", "200");
  await page.click("#expense-submit");

  await expect(page.locator("#expense-amount")).toHaveText("200");
  await expect(page.locator("#balance-amount")).toHaveText("300");

  await page.click(".delete-icon");
  await expect(page.locator("#expense-amount")).toHaveText("0");
  await expect(page.locator("#balance-amount")).toHaveText("500");
});

test("state persists across reload", async ({ page }) => {
  await page.fill("#budget-input", "750");
  await page.click("#budget-submit");
  await page.fill("#expense-input", "Books");
  await page.fill("#amount-input", "120");
  await page.click("#expense-submit");

  await page.reload();
  await expect(page.locator("#budget-amount")).toHaveText("750");
  await expect(page.locator("#expense-amount")).toHaveText("120");
  await expect(page.locator("#balance-amount")).toHaveText("630");
});

test("validation: empty budget shows feedback", async ({ page }) => {
  // bypass the HTML5 required attribute to test JS validation
  await page.evaluate(() =>
    document.querySelector("#budget-input").removeAttribute("required"),
  );
  await page.click("#budget-submit");
  await expect(page.locator(".budget-feedback")).toHaveClass(/showItem/);
});

test("XSS-attempt expense title is rendered as text, not HTML", async ({
  page,
}) => {
  await page.fill("#budget-input", "100");
  await page.click("#budget-submit");
  await page.fill("#expense-input", "<img src=x onerror=window.__pwned=1>");
  await page.fill("#amount-input", "1");
  await page.click("#expense-submit");
  const pwned = await page.evaluate(() => window.__pwned);
  expect(pwned).toBeUndefined();
  await expect(page.locator(".expense-title").first()).toContainText("<img");
});
