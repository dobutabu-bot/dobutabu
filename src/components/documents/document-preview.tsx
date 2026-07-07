import { Download, FileText } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { PdfJsViewer } from "@/components/documents/pdf-js-viewer";
import { PrivacyDocumentFrame } from "@/components/privacy/privacy-mask";
import { isCsvFile, isSpreadsheetFile, type TabularDocumentPreview } from "@/lib/documents/preview";

type DocumentPreviewProps = {
  id: string;
  mimeType: string;
  originalFileName: string;
  title: string;
  tabularPreview: TabularDocumentPreview | null;
};

export function DocumentPreview({ id, mimeType, originalFileName, title, tabularPreview }: DocumentPreviewProps) {
  const previewUrl = `/api/documents/${id}/preview`;
  const downloadHref = `/api/documents/${id}/download`;

  if (mimeType === "application/pdf") {
    return (
      <PrivacyDocumentFrame>
        <PdfJsViewer url={previewUrl} title={title} />
      </PrivacyDocumentFrame>
    );
  }

  if (mimeType.startsWith("image/")) {
    return (
      <PrivacyDocumentFrame>
        <div className="relative min-h-[420px] bg-slate-950">
          <Image src={previewUrl} alt={title} fill unoptimized sizes="100vw" className="object-contain p-3" />
        </div>
      </PrivacyDocumentFrame>
    );
  }

  if (isCsvFile(mimeType, originalFileName) || isSpreadsheetFile(mimeType, originalFileName)) {
    return (
      <PrivacyDocumentFrame>
        <TabularPreviewTable preview={tabularPreview} downloadHref={downloadHref} />
      </PrivacyDocumentFrame>
    );
  }

  return (
    <PrivacyDocumentFrame>
      <DownloadFallback downloadHref={downloadHref} message="Bu dosya türü tarayıcıda önizlenemeyebilir." />
    </PrivacyDocumentFrame>
  );
}

function TabularPreviewTable({ preview, downloadHref }: { preview: TabularDocumentPreview | null; downloadHref: string }) {
  if (!preview || preview.rows.length === 0) {
    return <DownloadFallback downloadHref={downloadHref} message="Satır önizlemesi oluşturulamadı." />;
  }

  return (
    <div className="p-4">
      <div className="scroll-x-stable rounded-3xl border border-slate-100">
        <table className="min-w-full text-left text-sm">
          <tbody className="divide-y divide-slate-100">
            {preview.rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row.join("|")}`} className={rowIndex === 0 ? "bg-slate-950 text-slate-100" : "bg-white"}>
                {row.map((cell, cellIndex) => (
                  <td key={`${cellIndex}-${cell}`} className="max-w-[18rem] truncate px-3 py-2">
                    {cell || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        {preview.kind.toUpperCase()} için ilk {preview.rows.length} satır gösteriliyor
        {preview.truncated ? "; dosyanın devamı için indirme bağlantısını kullanın" : ""}.
      </p>
    </div>
  );
}

function DownloadFallback({ downloadHref, message }: { downloadHref: string; message: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center p-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-950 text-white">
        <FileText className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-950">{message}</p>
      <Link href={downloadHref} className="secondary-action mt-4">
        <Download className="h-4 w-4" aria-hidden />
        Dosyayı İndir
      </Link>
    </div>
  );
}
