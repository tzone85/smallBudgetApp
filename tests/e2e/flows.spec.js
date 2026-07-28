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
  await expect(page.locator("#balance")).toHaveClass(/is-positive/);
});

test("over-spending turns balance red", async ({ page }) => {
  await page.fill("#budget-input", "100");
  await page.click("#budget-submit");

  await page.fill("#expense-input", "Vacation");
  await page.fill("#amount-input", "250");
  await page.click("#expense-submit");

  await expect(page.locator("#balance-amount")).toHaveText("-150");
  await expect(page.locator("#balance")).toHaveClass(/is-negative/);
});

test("delete updates total + balance (regression)", async ({ page }) => {
  await page.fill("#budget-input", "500");
  await page.click("#budget-submit");

  await page.fill("#expense-input", "Tools");
  await page.fill("#amount-input", "200");
  await page.click("#expense-submit");
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

test("multiple named budgets keep separate expenses", async ({ page }) => {
  await page.fill("#budget-input", "1000");
  await page.click("#budget-submit");
  await page.fill("#expense-input", "Rent");
  await page.fill("#amount-input", "400");
  await page.click("#expense-submit");

  await page.fill("#new-budget-input", "Side hustle");
  await page.click("#new-budget-submit");
  await expect(page.locator("#budget-select")).toHaveValue(/\d+/);
  await expect(page.locator("#budget-amount")).toHaveText("0");
  await expect(page.locator(".expense-item")).toHaveCount(0);

  await page.selectOption("#budget-select", { label: "Personal" });
  await expect(page.locator("#budget-amount")).toHaveText("1000");
  await expect(page.locator(".expense-item")).toHaveCount(1);
});

test("category limits flag overruns", async ({ page }) => {
  await page.fill("#category-name-input", "Food");
  await page.fill("#category-limit-input", "100");
  await page.click("#category-submit");
  await expect(page.locator("#category-list li")).toHaveCount(1);

  await page.fill("#expense-input", "Groceries");
  await page.fill("#amount-input", "150");
  await page.selectOption("#expense-category", { label: "Food" });
  await page.click("#expense-submit");

  await expect(page.locator(".category-spend")).toHaveClass(/tag--over/);
  await expect(page.locator(".category-spend")).toContainText("over");
});

test("recurring expense reappears in the next month", async ({ page }) => {
  await page.fill("#expense-input", "Gym");
  await page.fill("#amount-input", "30");
  await page.check("#expense-recurring");
  await page.click("#expense-submit");

  await expect(page.locator("#recurring-list li")).toHaveCount(1);
  await expect(page.locator(".expense-item")).toHaveCount(1);

  const month = await page.inputValue("#month-input");
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  await page.fill("#month-input", next);
  await expect(page.locator(".expense-item")).toHaveCount(1);
  await expect(page.locator("#expense-amount")).toHaveText("30");
});

test("summary renders an SVG bar per category", async ({ page }) => {
  await page.fill("#category-name-input", "Food");
  await page.click("#category-submit");
  await page.fill("#expense-input", "Groceries");
  await page.fill("#amount-input", "80");
  await page.selectOption("#expense-category", { label: "Food" });
  await page.click("#expense-submit");

  await expect(page.locator("#summary svg")).toBeVisible();
  await expect(page.locator("#summary .summary-bar")).toHaveCount(1);
  await expect(page.locator("#summary")).toContainText("Food");
});

test("CSV export downloads the expenses", async ({ page }) => {
  await page.fill("#expense-input", "Rent");
  await page.fill("#amount-input", "400");
  await page.click("#expense-submit");

  const downloadPromise = page.waitForEvent("download");
  await page.click("#export-csv");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("personal-expenses.csv");
  const content = await download
    .createReadStream()
    .then((s) => new Promise((resolve) => {
      let data = "";
      s.on("data", (c) => (data += c));
      s.on("end", () => resolve(data));
    }));
  expect(content).toContain("month,title,category,amount,recurring");
  expect(content).toContain("Rent");
});

test("dark mode toggles and persists", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.click("#theme-toggle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#theme-toggle")).toHaveText("Light mode");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
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
  await page.fill("#expense-input", "<img src=x onerror=window.__pwned=1>");
  await page.fill("#amount-input", "1");
  await page.click("#expense-submit");
  const pwned = await page.evaluate(() => window.__pwned);
  expect(pwned).toBeUndefined();
  await expect(page.locator(".expense-title").first()).toContainText("<img");
});

test("XSS-attempt category name is escaped in the summary SVG", async ({ page }) => {
  await page.fill("#category-name-input", "<img src=x onerror=window.__pwned=1>");
  await page.click("#category-submit");
  await page.fill("#expense-input", "x");
  await page.fill("#amount-input", "5");
  await page.selectOption("#expense-category", { index: 1 });
  await page.click("#expense-submit");
  const pwned = await page.evaluate(() => window.__pwned);
  expect(pwned).toBeUndefined();
  await expect(page.locator("#summary .summary-bar")).toHaveCount(1);
});
