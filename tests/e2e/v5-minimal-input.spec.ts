import { expect, test, type Page } from "@playwright/test";

const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const TEST_PASSWORD = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";

test.describe("V5 minimum veri girişi", () => {
  test("global hızlı ekle aynı sayfada açılır ve gider önerisi kullanıcı onayı bekler", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    test.skip(testInfo.project.name !== "chromium-desktop", "Hedefli V5 UX akışı tek Chromium projesinde çalışır.");
    await authenticate(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("page-ready-dashboard")).toBeVisible();

    await page.getByRole("button", { name: "Yeni kayıt ekle" }).click();
    const dialog = page.getByRole("dialog", { name: "Yeni Kayıt" });
    const drawerPanel = page.getByTestId("drawer-panel");
    await expect(dialog).toBeVisible();
    await expect(drawerPanel.getByTestId("quick-add-menu").getByRole("button")).toHaveCount(7);
    await drawerPanel.getByRole("button", { name: "Gider", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const basicSection = drawerPanel.locator('[data-form-section="basic"]');
    await expect(basicSection).toBeVisible({ timeout: 90_000 });
    const basicLabels = await basicSection.locator("label").allTextContents();
    expect(basicLabels.map((label) => label.trim())).toEqual(["Tutar*", "Kategori*", "Tarih*", "Açıklama"]);
    await expect(drawerPanel.locator("details")).not.toHaveAttribute("open", "");

    await drawerPanel.getByLabel("Açıklama", { exact: true }).fill("Kadıköy noter masrafı");
    await expect(drawerPanel.getByText("Akıllı öneri: Noter", { exact: true })).toBeVisible();
    await drawerPanel.getByRole("button", { name: "Uygula", exact: true }).click();
    await drawerPanel.getByText("Gelişmiş Seçenekler", { exact: true }).click();
    await expect(basicSection.locator('select[name="category"]')).toHaveValue("NOTARY");
  });

  test("standart formlar yalnız temel alanlarla başlar", async ({ page }, testInfo) => {
    test.setTimeout(600_000);
    test.skip(testInfo.project.name !== "chromium-desktop", "Hedefli V5 UX akışı tek Chromium projesinde çalışır.");
    await authenticate(page);
    const flows = [
      { path: "/collections", button: "Tahsilat Ekle", labels: ["Müvekkil", "Tutar*", "Tarih*", "Açıklama"] },
      { path: "/expenses", button: "Gider Ekle", labels: ["Tutar*", "Kategori*", "Tarih*", "Açıklama"] },
      { path: "/clients", button: "Müvekkil Ekle", labels: ["Ad / Ünvan*", "Telefon", "Not"] },
      { path: "/cases", button: "Dosya Ekle", labels: ["Müvekkil", "Başlık*", "Dosya No", "Dosya Türü"] },
      { path: "/reminders", button: "Hatırlatma Ekle", labels: ["Başlık*", "Vade Tarihi*", "Hatırlatma türü*"] },
      { path: "/advances", button: "Avans Hareketi Ekle", labels: ["Müvekkil", "Tutar*", "Yön*", "Açıklama"] }
    ];

    for (const flow of flows) {
      await page.goto(flow.path, { waitUntil: "domcontentloaded" });
      const createButton = page.getByRole("button", { name: flow.button, exact: true });
      await expect(createButton).toBeEnabled();
      await createButton.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const basicSection = dialog.locator('[data-form-section="basic"]');
      await expect(basicSection).toBeVisible();
      const labels = await basicSection.locator("label").allTextContents();
      expect(labels.map((label) => label.trim()), flow.path).toEqual(flow.labels);
      await expect(dialog.locator("details")).not.toHaveAttribute("open", "");
    }

    await page.goto("/documents/new", { waitUntil: "domcontentloaded" });
    await expect(page.locator('input[type="file"]')).toBeAttached();
    await expect(page.getByLabel("Belge Türü", { exact: false })).toBeVisible();
    await expect(page.locator("form details")).not.toHaveAttribute("open", "");
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
