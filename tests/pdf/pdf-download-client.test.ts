import assert from "node:assert/strict";
import test from "node:test";

import {
  pdfFileNameFromContentDisposition,
  sanitizePdfFileName
} from "../../src/lib/pdf/content-disposition";

test("Content-Disposition filename* Türkçe dosya adını güvenli çözer", () => {
  assert.equal(
    pdfFileNameFromContentDisposition(
      "attachment; filename=\"muvekkil-cari.pdf\"; filename*=UTF-8''m%C3%BCvekkil-cari-%C3%B6zeti.pdf",
      "fallback.pdf"
    ),
    "müvekkil-cari-özeti.pdf"
  );
});

test("bozuk filename* durumunda ASCII filename kullanılır", () => {
  assert.equal(
    pdfFileNameFromContentDisposition(
      "attachment; filename=\"guvenli-rapor.pdf\"; filename*=UTF-8''%E0%A4%A",
      "fallback.pdf"
    ),
    "guvenli-rapor.pdf"
  );
});

test("dosya adı kontrol, path ve CRLF karakterlerinden arındırılır", () => {
  assert.equal(
    sanitizePdfFileName("../gizli\\rapor\r\nX-Test: evet"),
    "gizli-raporX-Test- evet.pdf"
  );
});

test("header dosya adı yoksa güvenli fallback kullanılır", () => {
  assert.equal(
    pdfFileNameFromContentDisposition(null, "aylik finans 2026-07"),
    "aylik finans 2026-07.pdf"
  );
});
