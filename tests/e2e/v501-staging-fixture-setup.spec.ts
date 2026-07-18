import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const email = process.env.ADMIN_EMAIL ?? "avukat@example.com";
const password = process.env.ADMIN_PASSWORD ?? "DemoAvukat2026!";
const marker = `PDF-SMOKE-TEST-${process.env.GITHUB_RUN_ID ?? "LOCAL"}`;

test("staging PDF matrisi icin anonim ve izlenebilir kayitlar olusturur", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);

  let clientId = await findOptionalDetailId(page, "/clients", /^\/clients\/([^/?#]+)$/);
  if (!clientId) {
    await expectApiOk(
      await page.request.post("/api/clients", {
        data: {
          name: `${marker} Müvekkil`,
          type: "COMPANY",
          tcNo: "",
          taxNo: "",
          email: "",
          phone: "",
          address: "",
          notes: marker
        }
      }),
      "müvekkil"
    );
    clientId = await findSearchDetailId(page, "/clients/");
  }

  let caseId = await findOptionalDetailId(page, "/cases", /^\/cases\/([^/?#]+)$/);
  if (!caseId) {
    await expectApiOk(
      await page.request.post("/api/cases", {
        data: {
          clientId,
          title: `${marker} Dosya`,
          fileNumber: marker,
          courtOrOffice: "",
          caseType: "Anonim PDF kalite kontrolü",
          status: "ACTIVE",
          notes: marker
        }
      }),
      "dosya"
    );
    caseId = await findSearchDetailId(page, "/cases/");
  }

  const today = new Date().toISOString().slice(0, 10);
  let collectionId = await findOptionalDetailId(page, "/collections", /^\/collections\/([^/?#]+)$/);
  if (!collectionId) {
    await expectApiOk(
      await page.request.post("/api/collections", {
        data: {
          clientId,
          caseFileId: "",
          cashAccountId: "",
          amount: "1250.00",
          currency: "TRY",
          date: today,
          paymentMethod: "BANK_TRANSFER",
          category: "LEGAL_FEE",
          description: `${marker} Tahsilat`,
          receiptIssued: false,
          receiptNumber: ""
        }
      }),
      "tahsilat"
    );
    collectionId = await findSearchDetailId(page, "/collections/");
  }

  let expenseId = await findOptionalDetailId(page, "/expenses", /^\/expenses\/([^/?#]+)$/);
  if (!expenseId) {
    await expectApiOk(
      await page.request.post("/api/expenses", {
        data: {
          clientId: "",
          caseFileId: "",
          cashAccountId: "",
          amount: "375.00",
          currency: "TRY",
          date: today,
          paymentMethod: "BANK_TRANSFER",
          category: "OFFICE",
          isClientExpense: false,
          description: `${marker} Gider`
        }
      }),
      "gider"
    );
    expenseId = await findSearchDetailId(page, "/expenses/");
  }

  let bankImportId = await findOptionalDetailId(
    page,
    "/bank-statements",
    /^\/bank-statements\/(?!import(?:[/?#]|$)|analysis(?:[/?#]|$))([^/?#]+)$/
  );
  if (!bankImportId) {
    const csv = [
      "Tarih;Açıklama;Borç;Alacak;Bakiye",
      `${today};${marker} Banka hareketi;0,00;1250,00;1250,00`
    ].join("\n");
    const bankResponse = await page.request.post("/api/bank-statements/import", {
      multipart: {
        file: {
          name: `${marker}.csv`,
          mimeType: "text/csv",
          buffer: Buffer.from(csv, "utf8")
        },
        bankName: marker,
        currency: "TRY",
        mapDate: "Tarih",
        mapDescription: "Açıklama",
        mapDebit: "Borç",
        mapCredit: "Alacak",
        mapBalance: "Bakiye",
        dateFormat: "YYYY-MM-DD",
        decimalSeparator: ",",
        thousandSeparator: ".",
        delimiter: ";"
      }
    });
    await expectApiOk(bankResponse, "banka ekstresi");
    const bankPayload = (await bankResponse.json()) as { id?: string };
    expect(bankPayload.id, "banka ekstresi kimliği").toBeTruthy();
    bankImportId = bankPayload.id!;
  }

  const evidence = {
    marker,
    createdAt: new Date().toISOString(),
    clientId,
    caseId,
    collectionId,
    expenseId,
    bankImportId
  };
  const evidenceDir = path.resolve("test-results", "v501-staging-fixture");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(path.join(evidenceDir, "fixture.json"), JSON.stringify(evidence, null, 2), "utf8");
  console.log(`STAGING_FIXTURE_EVIDENCE=${JSON.stringify(evidence)}`);
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill(password);
  await Promise.all([page.waitForURL(/\/dashboard/), page.getByRole("button", { name: "Giriş yap" }).click()]);
  await page.waitForLoadState("networkidle");
}

async function findOptionalDetailId(page: Page, listUrl: string, pattern: RegExp) {
  await page.goto(listUrl, { waitUntil: "networkidle" });
  const hrefs = await page.locator("main a[href]").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")).filter((href): href is string => Boolean(href))
  );
  return hrefs.map((href) => href.match(pattern)?.[1]).find(Boolean) ?? null;
}

async function findSearchDetailId(page: Page, hrefPrefix: string) {
  const response = await page.request.get(`/api/search?q=${encodeURIComponent(marker)}`);
  await expectApiOk(response, "global arama");
  const payload = (await response.json()) as {
    groups?: Array<{ items?: Array<{ href?: string }> }>;
  };
  const href = payload.groups
    ?.flatMap((group) => group.items ?? [])
    .map((item) => item.href)
    .find((candidate) => candidate?.startsWith(hrefPrefix));
  const id = href?.split("/").filter(Boolean).at(-1);
  expect(id, `${hrefPrefix} staging fixture kimliği`).toBeTruthy();
  return id!;
}

async function expectApiOk(response: { ok(): boolean; status(): number; text(): Promise<string> }, label: string) {
  if (!response.ok()) {
    throw new Error(`${label} oluşturulamadı: HTTP ${response.status()} ${await response.text()}`);
  }
}
