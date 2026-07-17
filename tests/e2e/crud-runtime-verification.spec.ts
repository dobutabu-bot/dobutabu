import "dotenv/config";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { expect, test, type ConsoleMessage, type Locator, type Page, type Request } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const adminEmail = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const adminPassword = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";
const screenshotDir = path.join(process.cwd(), "test-results", "crud-runtime-verification");

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("son yerel runtime doğrulaması - gerçek UI CRUD aksiyonları", () => {
  test("edit, delete/archive, cancel, restore and reconciliation actions work through the UI", async ({ page }) => {
// A clean local review run compiles every V4 route once before exercising it.
// Keep assertions strict while allowing the cold App Router build to finish.
test.setTimeout(600_000);

    const stamp = `CRUD-RT-${Date.now()}`;
    const state: RuntimeState = {
      stamp,
      userId: "",
      clientId: "",
      caseFileId: "",
      incomeId: "",
      expenseId: "",
      receiptDraftId: "",
      receiptIssuedId: "",
      documentId: "",
      reminderId: "",
      cashAccountId: "",
      assetId: "",
      bankImportId: "",
      bankRowId: "",
      documentFileName: "",
      documentStoragePath: ""
    };
    const consoleErrors: string[] = [];
    const consoleReads: Promise<void>[] = [];
    const networkErrors: string[] = [];
    const networkReads: Promise<void>[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleReads.push(describeConsoleMessage(message).then((text) => {
          if (!/favicon|ResizeObserver loop/i.test(text)) consoleErrors.push(text);
        }));
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(`pageerror ${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`);
    });
    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/api/") && response.status() >= 400) {
        networkReads.push(response.text()
          .then((body) => networkErrors.push(`${response.status()} ${url} ${body}`))
          .catch(() => networkErrors.push(`${response.status()} ${url}`)));
      }
    });
    trackRscRequests(page);

    await mkdir(screenshotDir, { recursive: true });
    try {
      state.userId = await getAdminUserId();
      await loginThroughUi(page);
      await expect(page.getByTestId("page-ready-dashboard")).toBeVisible();
      await screenshot(page, "00-dashboard-login-pass.png");

      await expect.poll(() => healthStatus(page), { message: "/api/health ok dönmeli" }).toBe(true);

      const clientName = `${stamp} Müvekkil`;
      const updatedClientName = `${clientName} CRUD TEST GÜNCELLENDİ`;
      await gotoReady(page, "/clients");
      const clientForm = await openCreateDialog(page, "Müvekkil Ekle");
      await clientForm.getByLabel("Ad / Ünvan").fill(clientName);
      await clientForm.getByLabel("Telefon").fill("05000000000");
      await clientForm.getByRole("button", { name: "Kaydet" }).click();
      await expect(page.getByText(clientName).filter({ visible: true }).first()).toBeVisible();
      state.clientId = await findClientId(clientName);

      let dialog = await openTableEditDialog(page, clientName, "Müvekkil Düzenle");
      await dialog.getByLabel("Ad / Ünvan").fill(updatedClientName);
      await submitDialog(dialog);
      await expect.poll(() => clientNameById(state.clientId)).toBe(updatedClientName);
      await gotoReady(page, `/clients/${state.clientId}`);
      await expect(page.getByText(updatedClientName).filter({ visible: true }).first()).toBeVisible();
      await gotoReady(page, "/clients");
      await deleteTableRow(page, updatedClientName, "Müvekkil silinsin mi?", "Sil");
      await expect.poll(() => isClientDeleted(state.clientId)).toBe(true);
      await restoreFromDeletedRecords(page, "clients", updatedClientName);
      await expect.poll(() => isClientDeleted(state.clientId)).toBe(false);
      await screenshot(page, "01-clients-edit-delete-restore.png");

      const caseTitle = `${stamp} Dosya`;
      const updatedCaseTitle = `${caseTitle} CRUD TEST GÜNCELLENDİ`;
      await gotoReady(page, "/cases");
      const caseForm = await openCreateDialog(page, "Dosya Ekle");
      const caseClientSelect = caseForm.getByLabel("Müvekkil", { exact: true });
      await caseClientSelect.selectOption({ label: updatedClientName });
      await expect(caseClientSelect).toHaveValue(state.clientId);
      await caseForm.getByLabel("Başlık").fill(caseTitle);
      await caseForm.getByLabel("Dosya No").fill(`2026/${stamp.slice(-5)} E.`);
      await caseForm.getByRole("button", { name: "Kaydet" }).click();
      await expect(page.getByText(caseTitle).filter({ visible: true }).first()).toBeVisible();
      state.caseFileId = await findCaseId(caseTitle);

      dialog = await openTableEditDialog(page, caseTitle, "Dosya Düzenle");
      await dialog.getByLabel("Başlık").fill(updatedCaseTitle);
      await submitDialog(dialog);
      await expect.poll(() => caseTitleById(state.caseFileId)).toBe(updatedCaseTitle);
      await gotoReady(page, "/cases");
      await deleteTableRow(page, updatedCaseTitle, "Dosya silinsin/arşivlensin mi?", "Sil/Arşivle");
      await expect.poll(() => isCaseDeleted(state.caseFileId)).toBe(true);
      await restoreFromDeletedRecords(page, "cases", updatedCaseTitle);
      await expect.poll(() => isCaseDeleted(state.caseFileId)).toBe(false);
      await screenshot(page, "02-cases-edit-archive-restore.png");

      const incomeDescription = `${stamp} Tahsilat`;
      const updatedIncomeDescription = `${incomeDescription} CRUD TEST GÜNCELLENDİ`;
      await gotoReady(page, "/collections?create=1");
      dialog = page.getByRole("dialog", { name: "Tahsilat Ekle" });
      await expect(dialog).toBeVisible();
      await openAdvanced(dialog);
      await dialog.getByLabel("Müvekkil", { exact: true }).selectOption(state.clientId);
      await dialog.getByLabel("Dosya", { exact: true }).selectOption(state.caseFileId);
      await dialog.getByLabel("Tutar").fill("1200.00");
      await dialog.getByLabel("Açıklama").fill(incomeDescription);
      await submitDialog(dialog, "Kaydet");
      await expect(page.getByText(incomeDescription).filter({ visible: true }).first()).toBeVisible();
      state.incomeId = await findIncomeId(incomeDescription);
      const originalIncomeLedgerCount = await prisma.cashLedgerEntry.count({ where: { incomeId: state.incomeId } });

      dialog = await openTableEditDialog(page, incomeDescription, "Tahsilat Düzenle");
      await dialog.getByLabel("Tutar").fill("1500.00");
      await dialog.getByLabel("Açıklama").fill(updatedIncomeDescription);
      await submitDialog(dialog);
      await expect.poll(() => incomeAmount(state.incomeId)).toBe("1500");
      await expect.poll(() => prisma.cashLedgerEntry.count({ where: { incomeId: state.incomeId } })).toBe(originalIncomeLedgerCount);
      await gotoReady(page, "/collections");
      await deleteTableRow(page, updatedIncomeDescription, "Tahsilat silinsin mi?", "Sil");
      await expect.poll(() => incomeAndLedgerDeleted(state.incomeId)).toBe(true);
      await restoreFromDeletedRecords(page, "incomes", updatedClientName);
      await expect.poll(() => incomeAndLedgerDeleted(state.incomeId)).toBe(false);
      await screenshot(page, "03-collections-edit-delete-restore.png");

      const expenseDescription = `${stamp} Gider`;
      const updatedExpenseDescription = `${expenseDescription} CRUD TEST GÜNCELLENDİ`;
      await gotoReady(page, "/expenses?create=1");
      dialog = page.getByRole("dialog", { name: "Gider Ekle" });
      await expect(dialog).toBeVisible();
      await openAdvanced(dialog);
      await dialog.getByLabel("Müvekkil", { exact: true }).selectOption(state.clientId);
      await dialog.getByLabel("Dosya", { exact: true }).selectOption(state.caseFileId);
      await dialog.getByLabel("Tutar").fill("400.00");
      await dialog.getByLabel("Açıklama").fill(expenseDescription);
      await submitDialog(dialog, "Kaydet");
      await expect(page.getByText(expenseDescription).filter({ visible: true }).first()).toBeVisible();
      state.expenseId = await findExpenseId(expenseDescription);
      const originalExpenseLedgerCount = await prisma.cashLedgerEntry.count({ where: { expenseId: state.expenseId } });

      dialog = await openTableEditDialog(page, expenseDescription, "Gider Düzenle");
      await dialog.getByLabel("Tutar").fill("475.00");
      await dialog.getByLabel("Açıklama").fill(updatedExpenseDescription);
      await submitDialog(dialog);
      await expect.poll(() => expenseAmount(state.expenseId)).toBe("475");
      await expect.poll(() => prisma.cashLedgerEntry.count({ where: { expenseId: state.expenseId } })).toBe(originalExpenseLedgerCount);
      await gotoReady(page, "/expenses");
      await deleteTableRow(page, updatedExpenseDescription, "Gider silinsin mi?", "Sil");
      await expect.poll(() => expenseAndLedgerDeleted(state.expenseId)).toBe(true);
      await restoreFromDeletedRecords(page, "expenses", updatedClientName);
      await expect.poll(() => expenseAndLedgerDeleted(state.expenseId)).toBe(false);
      await screenshot(page, "04-expenses-edit-delete-restore.png");

      const draftReceiptNumber = `${stamp}-DRAFT`;
      const issuedReceiptNumber = `${stamp}-ISSUED`;
      const updatedReceiptNumber = `${draftReceiptNumber}-GUNCEL`;
      await gotoReady(page, "/receipts");
      const receiptForm = formByTitle(page, "Makbuz / Fatura Ekle");
      await receiptForm.getByLabel("Müvekkil", { exact: true }).selectOption(state.clientId);
      await receiptForm.getByLabel("Dosya", { exact: true }).selectOption(state.caseFileId);
      await receiptForm.getByLabel("Belge Numarası").fill(draftReceiptNumber);
      await receiptForm.getByLabel("Brüt Tutar").fill("1000.00");
      await receiptForm.getByLabel("KDV Tutarı").fill("200.00");
      await receiptForm.getByLabel("Net Tutar").fill("1200.00");
      await receiptForm.getByRole("button", { name: "Kaydet" }).click();
      await expect(page.getByText(draftReceiptNumber).filter({ visible: true }).first()).toBeVisible();
      state.receiptDraftId = await findReceiptId(draftReceiptNumber);

      dialog = await openTableEditDialog(page, draftReceiptNumber, "Makbuz / Fatura Düzenle");
      await dialog.getByLabel("Belge Numarası").fill(updatedReceiptNumber);
      await submitDialog(dialog);
      await expect.poll(() => receiptNumberById(state.receiptDraftId)).toBe(updatedReceiptNumber);
      await gotoReady(page, "/receipts");
      await deleteTableRow(page, updatedReceiptNumber, "Belge kaydı silinsin mi?", "Sil");
      await expect.poll(() => isReceiptDeleted(state.receiptDraftId)).toBe(true);
      await restoreFromDeletedRecords(page, "receipts", updatedReceiptNumber);
      await expect.poll(() => isReceiptDeleted(state.receiptDraftId)).toBe(false);

      state.receiptIssuedId = await createIssuedReceiptFixture(state.userId, state.clientId, state.caseFileId, issuedReceiptNumber);
      await gotoReady(page, "/receipts");
      await deleteTableRow(page, issuedReceiptNumber, "Belge kaydı iptal edilsin mi?", "İptal");
      await expect.poll(() => receiptStatusById(state.receiptIssuedId)).toBe("CANCELLED");
      await screenshot(page, "05-receipts-edit-delete-cancel-restore.png");

      const documentTitle = `${stamp} Belge`;
      const updatedDocumentTitle = `${documentTitle} CRUD TEST GÜNCELLENDİ`;
      await createDocumentFixture(state, documentTitle);
      await gotoReady(page, `/documents?q=${encodeURIComponent(documentTitle)}&view=table`);
      await expect(page.getByText(documentTitle).filter({ visible: true }).first()).toBeVisible();
      await clickRowLink(page, documentTitle, "Düzenle");
      await expect(page.getByRole("heading", { name: "Belgeyi Düzenle" })).toBeVisible();
      const documentForm = formByTitle(page, "Belge Bilgileri");
      await documentForm.getByLabel("Belge Başlığı").fill(updatedDocumentTitle);
      await documentForm.getByRole("button", { name: "Belgeyi Güncelle" }).click();
      await expect.poll(() => documentTitleById(state.documentId)).toBe(updatedDocumentTitle);
      await gotoReady(page, `/documents?q=${encodeURIComponent(updatedDocumentTitle)}&view=table`);
      await deleteTableRow(page, updatedDocumentTitle, "Belge silinsin mi?", "Onayla");
      await expect.poll(() => isDocumentDeleted(state.documentId)).toBe(true);
      await restoreFromDeletedRecords(page, "documents", updatedDocumentTitle);
      await expect.poll(() => isDocumentDeleted(state.documentId)).toBe(false);
      const previewResponse = await page.request.get(`/api/documents/${state.documentId}/preview`);
      expect(previewResponse.ok()).toBeTruthy();
      await screenshot(page, "06-documents-edit-delete-restore-preview.png");

      const reminderTitle = `${stamp} Hatırlatma`;
      const updatedReminderTitle = `${reminderTitle} CRUD TEST GÜNCELLENDİ`;
      await gotoReady(page, "/reminders?create=1");
      dialog = page.getByRole("dialog", { name: "Hatırlatma Ekle" });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Başlık").fill(reminderTitle);
      await submitDialog(dialog, "Hatırlatma ekle");
      await expect(page.getByText(reminderTitle).filter({ visible: true }).first()).toBeVisible();
      state.reminderId = await findReminderId(reminderTitle);

      dialog = await openTableEditDialog(page, reminderTitle, "Hatırlatma Düzenle");
      await dialog.getByLabel("Başlık").fill(updatedReminderTitle);
      await submitDialog(dialog);
      await expect.poll(() => reminderTitleById(state.reminderId)).toBe(updatedReminderTitle);
      await gotoReady(page, "/reminders");
      await clickRowButton(page, updatedReminderTitle, "Tamamla");
      await expect.poll(() => reminderStatusById(state.reminderId)).toBe("DONE");
      await reloadReady(page);
      await clickRowButton(page, updatedReminderTitle, "Aç");
      await expect.poll(() => reminderStatusById(state.reminderId)).toBe("OPEN");
      await deleteTableRow(page, updatedReminderTitle, "Hatırlatma silinsin mi?", "Sil");
      await expect.poll(() => isReminderDeleted(state.reminderId)).toBe(true);
      await restoreFromDeletedRecords(page, "reminders", updatedReminderTitle);
      await expect.poll(() => isReminderDeleted(state.reminderId)).toBe(false);
      await screenshot(page, "07-reminders-edit-done-reopen-delete-restore.png");

      const cashName = `${stamp} Kasa`;
      const updatedCashName = `${cashName} CRUD TEST GÜNCELLENDİ`;
      await gotoReady(page, "/cash/accounts");
      const cashForm = formByTitle(page, "Kasa Hesabı Ekle");
      await cashForm.getByLabel("Hesap adı").fill(cashName);
      await cashForm.getByLabel("Açılış bakiyesi").fill("250.00");
      await cashForm.getByRole("button", { name: "Hesap ekle" }).click();
      await expect(page.getByText(cashName).filter({ visible: true }).first()).toBeVisible();
      state.cashAccountId = await findCashAccountId(cashName);

      dialog = await openArticleEditDialog(page, cashName, "Kasa Hesabı Düzenle");
      await dialog.getByLabel("Hesap adı").fill(updatedCashName);
      await submitDialog(dialog);
      await expect.poll(() => cashAccountNameById(state.cashAccountId)).toBe(updatedCashName);
      await gotoReady(page, "/cash/accounts");
      await deleteArticle(page, updatedCashName, "Kasa hesabı silinsin/arşivlensin mi?", "Onayla");
      await expect.poll(() => isCashAccountDeleted(state.cashAccountId)).toBe(true);
      await restoreFromDeletedRecords(page, "cash-accounts", updatedCashName);
      await expect.poll(() => isCashAccountDeleted(state.cashAccountId)).toBe(false);
      await screenshot(page, "08-cash-accounts-edit-archive-restore.png");

      const assetName = `${stamp} Varlık`;
      const updatedAssetName = `${assetName} CRUD TEST GÜNCELLENDİ`;
      await gotoReady(page, "/capital");
      await page.getByRole("button", { name: "Varlık Ekle", exact: true }).click();
      dialog = page.getByRole("dialog", { name: "Varlık Ekle" });
      await expect(dialog).toBeVisible();
      const assetForm = dialog.locator("form");
      await assetForm.getByLabel("Varlık adı").fill(assetName);
      await assetForm.getByLabel("Toplam değer").fill("900.00");
      await assetForm.getByRole("button", { name: "Varlık ekle" }).click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });
      await expect(page.getByText(assetName).filter({ visible: true }).first()).toBeVisible();
      state.assetId = await findAssetId(assetName);

      dialog = await openArticleEditDialog(page, assetName, "Varlık Düzenle");
      await dialog.getByLabel("Varlık adı").fill(updatedAssetName);
      await submitDialog(dialog);
      await expect.poll(() => assetNameById(state.assetId)).toBe(updatedAssetName);
      await gotoReady(page, "/capital");
      await deleteArticle(page, updatedAssetName, "Varlık silinsin mi?", "Sil");
      await expect.poll(() => isAssetDeleted(state.assetId)).toBe(true);
      await restoreFromDeletedRecords(page, "assets", updatedAssetName);
      await expect.poll(() => isAssetDeleted(state.assetId)).toBe(false);
      await screenshot(page, "09-capital-edit-delete-restore.png");

      await createBankRowFixture(state);
      await gotoReady(page, `/bank-statements/${state.bankImportId}/reconciliation`);
      await expect(page.getByText(`${stamp} Mutabakat Gideri`).filter({ visible: true }).first()).toBeVisible();
      await clickRowButton(page, `${stamp} Mutabakat Gideri`, "Yoksay");
      await expect(page.getByRole("dialog", { name: "Banka Hareketini Yoksay" })).toBeVisible();
      await page.getByRole("dialog", { name: "Banka Hareketini Yoksay" }).getByRole("button", { name: "Onayla ve Yoksay" }).click();
      await expect.poll(() => bankRowMatchType(state.bankRowId)).toBe("IGNORED");
      await reloadReady(page);
      await clickRowButton(page, `${stamp} Mutabakat Gideri`, "Geri al");
      await page.getByRole("dialog", { name: "İşlemi Geri Al" }).getByRole("button", { name: "Onayla ve Geri Al" }).click();
      await expect.poll(() => bankRowMatchType(state.bankRowId)).toBe("NONE");
      await settleClientRender(page);
      await screenshot(page, "10-reconciliation-ignore-undo.png");

      await Promise.all(consoleReads);
      await Promise.all(networkReads);
      expect(consoleErrors, `Browser console hataları: ${consoleErrors.join("\n")}`).toEqual([]);
      expect(networkErrors, `Başarısız API network istekleri: ${networkErrors.join("\n")}`).toEqual([]);
    } finally {
      await Promise.all([...consoleReads, ...networkReads]);
      await cleanupRuntimeRecords(stamp);
    }
  });
});

async function describeConsoleMessage(message: ConsoleMessage) {
  const values = await Promise.all(message.args().map(async (argument) => {
    return argument.evaluate((value: unknown) => {
      if (value instanceof Error) {
        return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
      }
      try {
        return typeof value === "string" ? value : JSON.stringify(value);
      } catch {
        return String(value);
      }
    }).catch(() => "");
  }));

  const location = message.location();
  const source = location.url ? ` @ ${location.url}:${location.lineNumber}:${location.columnNumber}` : "";
  return `${values.filter(Boolean).join(" ") || message.text()}${source}`;
}

type RuntimeState = {
  stamp: string;
  userId: string;
  clientId: string;
  caseFileId: string;
  incomeId: string;
  expenseId: string;
  receiptDraftId: string;
  receiptIssuedId: string;
  documentId: string;
  reminderId: string;
  cashAccountId: string;
  assetId: string;
  bankImportId: string;
  bankRowId: string;
  documentFileName: string;
  documentStoragePath: string;
};

async function loginThroughUi(page: Page) {
  const response = await page.request.post("/api/auth/login", {
    form: { email: adminEmail, password: adminPassword },
    maxRedirects: 0
  });
  expect(response.status()).toBe(303);
  await gotoReady(page, "/dashboard");
}

async function gotoReady(page: Page, href: string) {
  await navigateWithRetry(page, href);
  await expect(page.getByTestId(pageReadyTestId(href))).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-app-shell-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('form[data-form-ready="false"]')).toHaveCount(0, { timeout: 30_000 });
  await settleClientRender(page);
}

async function navigateWithRetry(page: Page, href: string) {
  await settleClientRender(page);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(href, { waitUntil: "commit" });
      return;
    } catch (error) {
      const message = String(error);
      const interrupted =
        message.includes("NS_BINDING_ABORTED") ||
        message.includes("ERR_ABORTED") ||
        message.includes("interrupted by another navigation") ||
        message.includes("frame was detached");

      if (!interrupted || attempt === 2) throw error;
    }
  }
}

async function reloadReady(page: Page) {
  const href = page.url();
  await settleClientRender(page);
  await page.reload({ waitUntil: "commit" });
  await expect(page.getByTestId(pageReadyTestId(href))).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-app-shell-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('form[data-form-ready="false"]')).toHaveCount(0, { timeout: 30_000 });
  await settleClientRender(page);
}

async function settleClientRender(page: Page) {
  const tracker = trackRscRequests(page);
  await waitForRscQuiet(tracker);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await waitForRscQuiet(tracker);
}

type RscTracker = { requests: Set<Request>; lastActivity: number };
const pendingRscRequests = new WeakMap<Page, RscTracker>();

async function waitForRscQuiet(tracker: RscTracker) {
  await expect.poll(
    () => tracker.requests.size === 0 && Date.now() - tracker.lastActivity >= 500,
    { timeout: 30_000, message: "RSC istekleri 500 ms boyunca sessiz kalmalı" }
  ).toBe(true);
}

function trackRscRequests(page: Page) {
  const existing = pendingRscRequests.get(page);
  if (existing) return existing;

  const tracker: RscTracker = { requests: new Set<Request>(), lastActivity: Date.now() };
  const isRsc = (request: Request) => {
    const headers = request.headers();
    const prefetch = headers["next-router-prefetch"] === "1" || headers.purpose === "prefetch";
    return !prefetch && (headers.rsc === "1" || request.url().includes("_rsc="));
  };
  page.on("request", (request) => {
    if (!isRsc(request)) return;
    tracker.requests.add(request);
    tracker.lastActivity = Date.now();
  });
  const finish = (request: Request) => {
    if (!tracker.requests.delete(request)) return;
    tracker.lastActivity = Date.now();
  };
  page.on("requestfinished", finish);
  page.on("requestfailed", finish);
  pendingRscRequests.set(page, tracker);
  return tracker;
}

function pageReadyTestId(href: string) {
  const pathname = new URL(href, "http://localhost").pathname;
  const slug = pathname.replace(/^\/+/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "root";
  return `page-ready-${slug}`;
}

async function healthStatus(page: Page) {
  const response = await page.request.get("/api/health");
  if (!response.ok()) return false;
  const body = (await response.json()) as { ok?: boolean };
  return body.ok === true;
}

function formByTitle(pageOrLocator: Page | Locator, title: string) {
  return pageOrLocator.locator("form").filter({ hasText: title }).first();
}

async function openCreateDialog(page: Page, title: string) {
  await page.getByRole("button", { name: title, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  return dialog.locator("form");
}

async function openAdvanced(container: Locator) {
  const details = container.locator("details");
  await expect(details).toBeVisible();
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
}

async function openTableEditDialog(page: Page, rowText: string, title: string) {
  await clickRowButton(page, rowText, "Düzenle");
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openArticleEditDialog(page: Page, articleText: string, title: string) {
  const article = page.locator("article").filter({ hasText: articleText }).first();
  await expect(article).toBeVisible();
  await article.getByRole("button", { name: "İşlemler" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Düzenle" }).click();
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function submitDialog(dialog: Locator, name = "Güncelle") {
  await dialog.getByRole("button", { name }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

async function clickRowButton(page: Page, rowText: string, buttonName: string) {
  const row = visibleRecord(page, rowText);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "İşlemler" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: buttonName, exact: true }).click();
}

async function clickRowLink(page: Page, rowText: string, linkName: string) {
  const row = visibleRecord(page, rowText);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "İşlemler" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: linkName, exact: true }).click();
}

async function deleteTableRow(page: Page, rowText: string, dialogTitle: string, confirmName: string) {
  const row = visibleRecord(page, rowText);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "İşlemler" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: /^(Sil|Sil\/Arşivle|İptal|Onayla)$/ }).first().click();
  const dialog = page.getByRole("dialog", { name: dialogTitle });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: confirmName, exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

async function deleteArticle(page: Page, articleText: string, dialogTitle: string, confirmName: string) {
  const article = page.locator("article").filter({ hasText: articleText }).first();
  await expect(article).toBeVisible();
  await article.getByRole("button", { name: "İşlemler" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: /^(Sil|Sil\/Arşivle)$/ }).click();
  const dialog = page.getByRole("dialog", { name: dialogTitle });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: confirmName, exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

async function restoreFromDeletedRecords(page: Page, tab: string, rowText: string) {
  await gotoReady(page, `/settings/deleted-records?tab=${tab}`);
  const row = visibleRecord(page, rowText);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "İşlemler" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Geri Al" }).click();
  const dialog = page.getByRole("dialog", { name: "Kayıt geri alınsın mı?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Geri Al" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await settleClientRender(page);
  await expect(row).toBeHidden({ timeout: 30_000 });
}

function visibleRecord(page: Page, rowText: string) {
  return page.locator("tr:visible, article:visible").filter({ hasText: rowText }).first();
}

async function screenshot(page: Page, fileName: string) {
  await page.screenshot({ path: path.join(screenshotDir, fileName), fullPage: true });
}

async function getAdminUserId() {
  const user = await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } });
  expect(user, `Seed kullanıcısı bulunamadı: ${adminEmail}`).toBeTruthy();
  return user!.id;
}

async function createIssuedReceiptFixture(userId: string, clientId: string, caseFileId: string, number: string) {
  const receipt = await prisma.invoiceOrReceipt.create({
    data: {
      userId,
      clientId,
      caseFileId,
      type: "E_SMM",
      number,
      issueDate: new Date(),
      grossAmount: "1000",
      vatAmount: "200",
      withholdingAmount: "0",
      netAmount: "1200",
      status: "ISSUED",
      notes: "CRUD runtime issued fixture"
    }
  });
  return receipt.id;
}

async function createDocumentFixture(state: RuntimeState, title: string) {
  const fileName = `${randomUUID()}.csv`;
  const content = `title,amount\n${title},123\n`;
  const storageRoot = path.resolve(process.env.DOCUMENT_STORAGE_DIR ?? path.join(process.cwd(), "storage", "documents"));
  await mkdir(storageRoot, { recursive: true });
  await writeFile(path.join(storageRoot, fileName), content, "utf8");
  state.documentFileName = fileName;
  state.documentStoragePath = `documents/${fileName}`;
  const document = await prisma.document.create({
    data: {
      userId: state.userId,
      title,
      description: `${state.stamp} belge fixture`,
      documentType: "BANK_RECEIPT",
      fileName,
      originalFileName: `${state.stamp}.csv`,
      mimeType: "text/csv",
      fileSize: Buffer.byteLength(content, "utf8"),
      storagePath: state.documentStoragePath,
      fileHash: `crud-runtime-${state.stamp}-${randomUUID()}`,
      uploadedAt: new Date(),
      documentDate: new Date(),
      amount: "123",
      currency: "TRY",
      extractionStatus: "COMPLETED",
      linkedClientId: state.clientId
    }
  });
  state.documentId = document.id;
}

async function createBankRowFixture(state: RuntimeState) {
  const cashAccount = await prisma.cashAccount.findFirst({
    where: { userId: state.userId, deletedAt: null, isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true }
  });
  expect(cashAccount).toBeTruthy();
  const imported = await prisma.bankStatementImport.create({
    data: {
      userId: state.userId,
      cashAccountId: cashAccount!.id,
      bankName: `${state.stamp} Test Bankası`,
      sourceType: "CSV",
      status: "IMPORTED",
      currency: "TRY",
      fileName: `${state.stamp}.csv`,
      originalFileName: `${state.stamp}.csv`,
      mimeType: "text/csv",
      fileSize: 48,
      storagePath: state.documentStoragePath || "documents/00000000-0000-4000-8000-000000000000.csv",
      fileHash: `bank-import-${state.stamp}-${randomUUID()}`,
      periodStart: new Date(),
      periodEnd: new Date(),
      totalRows: 1,
      successfulRows: 1,
      closingBalance: "1000"
    }
  });
  const row = await prisma.bankStatementRow.create({
    data: {
      userId: state.userId,
      importId: imported.id,
      cashAccountId: cashAccount!.id,
      rowNumber: 1,
      transactionDate: new Date(),
      description: `${state.stamp} Mutabakat Gideri`,
      debitAmount: "45",
      amount: "45",
      balance: "955",
      currency: "TRY",
      direction: "OUT",
      status: "SUCCESS",
      rawData: { description: `${state.stamp} Mutabakat Gideri` },
      rawHash: `bank-row-${state.stamp}-${randomUUID()}`,
      categorySuggestion: "Ofis"
    }
  });
  state.bankImportId = imported.id;
  state.bankRowId = row.id;
}

async function cleanupRuntimeRecords(stamp: string) {
  const clients = await prisma.client.findMany({ where: { name: { contains: stamp } }, select: { id: true } });
  const clientIds = clients.map((item) => item.id);
  const cases = await prisma.caseFile.findMany({ where: { title: { contains: stamp } }, select: { id: true } });
  const caseIds = cases.map((item) => item.id);
  const incomes = await prisma.income.findMany({ where: { description: { contains: stamp } }, select: { id: true } });
  const incomeIds = incomes.map((item) => item.id);
  const expenses = await prisma.expense.findMany({ where: { description: { contains: stamp } }, select: { id: true } });
  const expenseIds = expenses.map((item) => item.id);
  const receipts = await prisma.invoiceOrReceipt.findMany({ where: { number: { contains: stamp } }, select: { id: true } });
  const receiptIds = receipts.map((item) => item.id);
  const documents = await prisma.document.findMany({ where: { title: { contains: stamp } }, select: { id: true } });
  const documentIds = documents.map((item) => item.id);
  const reminders = await prisma.taskReminder.findMany({ where: { title: { contains: stamp } }, select: { id: true } });
  const reminderIds = reminders.map((item) => item.id);
  const cashAccounts = await prisma.cashAccount.findMany({ where: { name: { contains: stamp } }, select: { id: true } });
  const cashAccountIds = cashAccounts.map((item) => item.id);
  const assets = await prisma.assetAccount.findMany({ where: { name: { contains: stamp } }, select: { id: true } });
  const assetIds = assets.map((item) => item.id);
  const bankImports = await prisma.bankStatementImport.findMany({ where: { bankName: { contains: stamp } }, select: { id: true } });
  const bankImportIds = bankImports.map((item) => item.id);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entityId: { in: [...clientIds, ...caseIds, ...incomeIds, ...expenseIds, ...receiptIds, ...documentIds, ...reminderIds, ...cashAccountIds, ...assetIds, ...bankImportIds] } },
        { message: { contains: stamp } }
      ]
    }
  });
  await prisma.bankStatementRow.deleteMany({ where: { OR: [{ description: { contains: stamp } }, { importId: { in: bankImportIds } }] } });
  await prisma.bankStatementImport.deleteMany({ where: { id: { in: bankImportIds } } });
  await prisma.documentTagOnDocument.deleteMany({ where: { documentId: { in: documentIds } } });
  await prisma.documentProcessingLog.deleteMany({ where: { documentId: { in: documentIds } } });
  await prisma.document.deleteMany({ where: { id: { in: documentIds } } });
  await prisma.cashLedgerEntry.deleteMany({
    where: {
      OR: [
        { incomeId: { in: incomeIds } },
        { expenseId: { in: expenseIds } },
        { description: { contains: stamp } },
        { cashAccountId: { in: cashAccountIds } }
      ]
    }
  });
  await prisma.assetValuation.deleteMany({ where: { assetAccountId: { in: assetIds } } });
  await prisma.assetTransaction.deleteMany({ where: { assetAccountId: { in: assetIds } } });
  await prisma.assetAccount.deleteMany({ where: { id: { in: assetIds } } });
  await prisma.taskReminder.deleteMany({ where: { id: { in: reminderIds } } });
  await prisma.invoiceOrReceipt.deleteMany({ where: { id: { in: receiptIds } } });
  await prisma.income.deleteMany({ where: { id: { in: incomeIds } } });
  await prisma.expense.deleteMany({ where: { id: { in: expenseIds } } });
  await prisma.caseFile.deleteMany({ where: { id: { in: caseIds } } });
  await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
  await prisma.cashAccount.deleteMany({ where: { id: { in: cashAccountIds } } });
}

async function findClientId(name: string) {
  const row = await prisma.client.findFirstOrThrow({ where: { name } });
  return row.id;
}

async function findCaseId(title: string) {
  const row = await prisma.caseFile.findFirstOrThrow({ where: { title } });
  return row.id;
}

async function findIncomeId(description: string) {
  const row = await prisma.income.findFirstOrThrow({ where: { description } });
  return row.id;
}

async function findExpenseId(description: string) {
  const row = await prisma.expense.findFirstOrThrow({ where: { description } });
  return row.id;
}

async function findReceiptId(number: string) {
  const row = await prisma.invoiceOrReceipt.findFirstOrThrow({ where: { number } });
  return row.id;
}

async function findReminderId(title: string) {
  const row = await prisma.taskReminder.findFirstOrThrow({ where: { title } });
  return row.id;
}

async function findCashAccountId(name: string) {
  const row = await prisma.cashAccount.findFirstOrThrow({ where: { name } });
  return row.id;
}

async function findAssetId(name: string) {
  const row = await prisma.assetAccount.findFirstOrThrow({ where: { name } });
  return row.id;
}

async function clientNameById(id: string) {
  return (await prisma.client.findUniqueOrThrow({ where: { id }, select: { name: true } })).name;
}

async function caseTitleById(id: string) {
  return (await prisma.caseFile.findUniqueOrThrow({ where: { id }, select: { title: true } })).title;
}

async function incomeAmount(id: string) {
  return (await prisma.income.findUniqueOrThrow({ where: { id }, select: { amount: true } })).amount.toString();
}

async function expenseAmount(id: string) {
  return (await prisma.expense.findUniqueOrThrow({ where: { id }, select: { amount: true } })).amount.toString();
}

async function receiptNumberById(id: string) {
  return (await prisma.invoiceOrReceipt.findUniqueOrThrow({ where: { id }, select: { number: true } })).number;
}

async function receiptStatusById(id: string) {
  return (await prisma.invoiceOrReceipt.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;
}

async function documentTitleById(id: string) {
  return (await prisma.document.findUniqueOrThrow({ where: { id }, select: { title: true } })).title;
}

async function reminderTitleById(id: string) {
  return (await prisma.taskReminder.findUniqueOrThrow({ where: { id }, select: { title: true } })).title;
}

async function reminderStatusById(id: string) {
  return (await prisma.taskReminder.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;
}

async function cashAccountNameById(id: string) {
  return (await prisma.cashAccount.findUniqueOrThrow({ where: { id }, select: { name: true } })).name;
}

async function assetNameById(id: string) {
  return (await prisma.assetAccount.findUniqueOrThrow({ where: { id }, select: { name: true } })).name;
}

async function bankRowMatchType(id: string) {
  return (await prisma.bankStatementRow.findUniqueOrThrow({ where: { id }, select: { matchType: true } })).matchType;
}

async function isClientDeleted(id: string) {
  return Boolean((await prisma.client.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } })).deletedAt);
}

async function isCaseDeleted(id: string) {
  return Boolean((await prisma.caseFile.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } })).deletedAt);
}

async function isReceiptDeleted(id: string) {
  return Boolean((await prisma.invoiceOrReceipt.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } })).deletedAt);
}

async function isDocumentDeleted(id: string) {
  return Boolean((await prisma.document.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } })).deletedAt);
}

async function isReminderDeleted(id: string) {
  return Boolean((await prisma.taskReminder.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } })).deletedAt);
}

async function isCashAccountDeleted(id: string) {
  return Boolean((await prisma.cashAccount.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } })).deletedAt);
}

async function isAssetDeleted(id: string) {
  return Boolean((await prisma.assetAccount.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } })).deletedAt);
}

async function incomeAndLedgerDeleted(id: string) {
  const [income, ledger] = await Promise.all([
    prisma.income.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } }),
    prisma.cashLedgerEntry.findUniqueOrThrow({ where: { incomeId: id }, select: { deletedAt: true } })
  ]);
  return Boolean(income.deletedAt) === Boolean(ledger.deletedAt) && Boolean(income.deletedAt);
}

async function expenseAndLedgerDeleted(id: string) {
  const [expense, ledger] = await Promise.all([
    prisma.expense.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } }),
    prisma.cashLedgerEntry.findUniqueOrThrow({ where: { expenseId: id }, select: { deletedAt: true } })
  ]);
  return Boolean(expense.deletedAt) === Boolean(ledger.deletedAt) && Boolean(expense.deletedAt);
}
