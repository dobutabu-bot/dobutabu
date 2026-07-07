import { createHmac } from "crypto";

import { expect, test, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { renderPdfReportToBuffer, renderPdfReportToStream, type PdfReportInput } from "../../src/lib/pdf/pdf-document";

const prisma = new PrismaClient();
const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "avukat@example.com";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("V3 server-side PDF reports", () => {
  test("renders large Turkish PDF reports through buffer and stream helpers", async ({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "PDF render testi tek projede çalışır.");
    expect(browserName).toBe("chromium");

    const input = largeTurkishPdfInput();
    const buffer = await renderPdfReportToBuffer(input);
    expect(pdfSignature(buffer)).toBe("%PDF");
    expect(buffer.byteLength).toBeGreaterThan(20_000);

    const streamed = await new Response(renderPdfReportToStream(input)).arrayBuffer();
    expect(pdfSignature(Buffer.from(streamed))).toBe("%PDF");
    expect(streamed.byteLength).toBeGreaterThan(20_000);
  });

  test("authenticated PDF routes return private attachment responses", async ({ request }, testInfo) => {
    test.skip(!["chromium-desktop", "webkit-desktop"].includes(testInfo.project.name), "PDF route indirme testi Chromium ve WebKit hedeflerinde çalışır.");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    test.skip(!user, `Seed kullanıcısı bulunamadı: ${TEST_EMAIL}`);

    const [client, caseFile, income, expense] = await Promise.all([
      prisma.client.findFirst({ where: { userId: user!.id, deletedAt: null, archivedAt: null }, select: { id: true } }),
      prisma.caseFile.findFirst({
        where: { userId: user!.id, deletedAt: null, archivedAt: null, status: { not: "ARCHIVED" }, client: { deletedAt: null, archivedAt: null } },
        select: { id: true }
      }),
      prisma.income.findFirst({ where: { userId: user!.id, deletedAt: null, client: { deletedAt: null, archivedAt: null } }, select: { id: true } }),
      prisma.expense.findFirst({ where: { userId: user!.id, deletedAt: null }, select: { id: true } })
    ]);
    const cookie = `hukuk_finans_session=${createSessionTokenForTest(user!.id)}`;
    const targets = [
      client ? { label: "Müvekkil cari", path: `/api/reports/client/${client.id}/pdf` } : null,
      caseFile ? { label: "Dosya finans", path: `/api/reports/case/${caseFile.id}/pdf` } : null,
      income ? { label: "Tahsilat özeti", path: `/api/reports/collections/${income.id}/pdf` } : null,
      expense ? { label: "Gider özeti", path: `/api/reports/expenses/${expense.id}/pdf` } : null,
      { label: "Aylık finans", path: "/api/reports/monthly/pdf?range=this-month" },
      { label: "Kasa raporu", path: "/api/reports/cash/pdf" },
      { label: "Banka analizi", path: "/api/reports/bank-analysis/e2e-placeholder/pdf" },
      { label: "Sermaye raporu", path: "/api/reports/capital/pdf" }
    ].filter(Boolean) as Array<{ label: string; path: string }>;

    expect(targets.length).toBeGreaterThanOrEqual(5);

    for (const target of targets) {
      await expectPdfDownload(request, cookie, target.path, target.label);
    }
  });
});

async function expectPdfDownload(request: APIRequestContext, cookie: string, path: string, label: string) {
  const unauthorized = await request.get(path);
  expect(unauthorized.status(), `${label} yetkisiz erişim`).toBe(401);

  const response = await request.get(path, { headers: { cookie } });
  expect(response.status(), `${label} status`).toBe(200);
  expect(response.headers()["content-type"], `${label} content-type`).toContain("application/pdf");
  expect(response.headers()["content-disposition"], `${label} content-disposition`).toContain("attachment");
  expect(response.headers()["content-disposition"], `${label} filename`).toContain(".pdf");
  expect(response.headers()["cache-control"], `${label} cache-control`).toContain("no-store");

  const buffer = Buffer.from(await response.body());
  expect(pdfSignature(buffer), `${label} imza`).toBe("%PDF");
  expect(buffer.byteLength, `${label} boyut`).toBeGreaterThan(1_500);
}

function largeTurkishPdfInput(): PdfReportInput {
  return {
    title: "Türkçe Büyük Finans Raporu",
    subtitle: "İcra, ödeme, müvekkil cari, şüpheli alacak ve kasa hareketleri",
    firmName: "Çağrı Şahin Hukuk Bürosu",
    ownerName: "Av. İpek Öztürk",
    reportDate: "06.07.2026",
    period: "01.07.2025 - 06.07.2026",
    summaries: [
      { label: "Toplam Tahsilat", value: "+₺1.245.000,00", tone: "green" },
      { label: "Toplam Gider", value: "-₺382.450,00", tone: "rose" },
      { label: "Net Durum", value: "+₺862.550,00", tone: "green" },
      { label: "Açık Alacak", value: "₺210.000,00", tone: "amber" },
      { label: "Belge Sayısı", value: "180", tone: "blue" }
    ],
    notes: [
      "Türkçe karakter testi: ğ, ü, ş, ı, ö, ç, İ, Ğ, Ü, Ş, Ö, Ç.",
      "Bu rapor sistem kayıtlarına göre oluşturulmuştur."
    ],
    tables: [
      {
        title: "Büyük Tahsilat ve Gider Tablosu",
        headers: ["Tarih", "Müvekkil", "Dosya", "Açıklama", "Tutar"],
        rows: Array.from({ length: 180 }, (_, index) => ({
          Tarih: "06.07.2026",
          Müvekkil: `Örnek Müvekkil ${index + 1}`,
          Dosya: `${2026}/${1000 + index} İstanbul İcra Dairesi`,
          Açıklama: index % 2 === 0 ? "Tahsilat - sözleşme alacağı ve vekalet ücreti" : "Gider - harç, posta ve bilirkişi masrafı",
          Tutar: index % 2 === 0 ? "+₺12.500,00" : "-₺1.250,00"
        }))
      }
    ]
  };
}

function pdfSignature(buffer: Buffer) {
  return buffer.subarray(0, 4).toString("utf8");
}

function createSessionTokenForTest(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
    })
  ).toString("base64url");

  return `${payload}.${createHmac("sha256", testAuthSecret()).update(payload).digest("base64url")}`;
}

function testAuthSecret() {
  const value = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  return value && value.length >= 32 ? value : "local-development-secret-change-me-32chars";
}
