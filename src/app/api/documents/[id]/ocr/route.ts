import { requireApiUser, unauthorized } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { getDocumentOcrJob, queueDocumentOcr } from "@/lib/jobs/document-ocr-job";
import { isSupportedOcrImage } from "@/lib/ocr/tesseract-adapter";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type DocumentOcrRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: DocumentOcrRouteProps) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: {
      id: true,
      title: true,
      mimeType: true,
      originalFileName: true,
      extractionStatus: true
    }
  });

  if (!document) {
    return Response.json({ message: "Belge bulunamadı." }, { status: 404 });
  }

  if (document.mimeType === "application/pdf") {
    return Response.json(
      {
        message:
          "PDF OCR için görsele dönüştürme entegrasyonu bu sürümde yok. Metin katmanı olmayan taranmış PDF'lerde manuel metadata girebilir veya görsel dosya yükleyebilirsiniz."
      },
      { status: 422 }
    );
  }

  if (!isSupportedOcrImage(document.mimeType)) {
    return Response.json({ message: "OCR yalnızca PNG ve JPEG görseller için kullanılabilir." }, { status: 400 });
  }

  const body = await parseOptionalJson(request);
  const timeoutMs = normalizeTimeout(body?.timeoutMs);
  const job = await queueDocumentOcr({ userId: user.id, documentId: document.id, timeoutMs });

  await writeAuditLog({
    entityType: "DOCUMENT",
    entityId: document.id,
    action: "UPDATE",
    oldValue: document,
    newValue: { ...document, ocrJobId: job.id, ocrJobStatus: job.status },
    message: "Belge OCR kuyruğuna alındı",
    userId: user.id
  });

  return Response.json(
    {
      ok: true,
      jobId: job.id,
      jobStatus: job.status,
      extractionStatus: "PROCESSING",
      message:
        job.status === "RUNNING"
          ? "OCR işlemi başladı. Sonuç hazır olduğunda belge işleme geçmişinde görünecek."
          : "OCR işi kuyruğa alındı. Sonuç hazır olduğunda belge işleme geçmişinde görünecek."
    },
    { status: 202 }
  );
}

export async function GET(request: Request, { params }: DocumentOcrRouteProps) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: { id: true }
  });

  if (!document) {
    return Response.json({ message: "Belge bulunamadı." }, { status: 404 });
  }

  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) {
    return Response.json({ message: "Job bilgisi için jobId gerekli." }, { status: 400 });
  }

  const job = getDocumentOcrJob(jobId);
  if (!job) {
    return Response.json({ message: "OCR işi bulunamadı veya tamamlanmış iş kayıtları temizlenmiş olabilir." }, { status: 404 });
  }

  return Response.json({ ok: true, job });
}

async function parseOptionalJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return (await request.json().catch(() => null)) as { timeoutMs?: unknown } | null;
}

function normalizeTimeout(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return undefined;
  }

  return Math.min(Math.round(numericValue), 120_000);
}
