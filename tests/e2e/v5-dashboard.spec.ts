import { expect, test, type Page } from "@playwright/test";

const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const TEST_PASSWORD = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 }
];

test.describe("V5 final dashboard", () => {
  test("renders the simplified finance composition without responsive or runtime regressions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "V5 viewport matrisi tek Chromium projesinde çalışır.");
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("favicon")) runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await authenticate(page);

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("page-ready-dashboard")).toBeVisible();
      await expect(page.locator('[data-dashboard-version="v5"]')).toBeVisible();
      await expect(page.getByTestId("v5-net-worth-chart")).toBeVisible();
      await expect(page.getByTestId("v5-today-summary")).toBeVisible();
      await expect(page.getByTestId("v5-monthly-metric-cards").locator("article")).toHaveCount(5);
      await expect(page.getByText("KDV Kontrol")).toBeVisible();
      await expect(page.getByText("Yansıtılabilir Masraf")).toBeVisible();
      await expect(page.getByText("Yatırıma Ayrılabilir")).toBeVisible();

      const quality = await page.evaluate(() => {
        const visibleTargets = Array.from(document.querySelectorAll<HTMLElement>("button,a")).filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        return {
          overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
          charts: document.querySelectorAll(".recharts-responsive-container").length,
          smallTargets: visibleTargets
            .filter((node) => node.getBoundingClientRect().height < 44)
            .map((node) => (node.textContent || node.getAttribute("aria-label") || node.tagName).trim().slice(0, 80))
        };
      });

      expect(quality.overflow, `${viewport.name} yatay taşma`).toBeLessThanOrEqual(1);
      expect(quality.charts, `${viewport.name} grafik sayısı`).toBeGreaterThanOrEqual(6);
      expect(quality.smallTargets, `${viewport.name} küçük dokunmatik hedefler`).toEqual([]);
    }

    expect(runtimeErrors).toEqual([]);
  });
});

async function authenticate(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("page-ready-login")).toBeVisible();
  await page.getByLabel("E-posta", { exact: true }).fill(TEST_EMAIL);
  await page.getByLabel("Şifre", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL((url) => new URL(url).pathname === "/dashboard");
  await expect(page.getByTestId("page-ready-dashboard")).toBeVisible();
}
