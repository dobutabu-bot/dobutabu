export type DocumentScanStatus = "SKIPPED" | "CLEAN" | "BLOCKED" | "FAILED";

export type DocumentScanInput = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  fileHash: string;
};

export type DocumentScanResult = {
  status: DocumentScanStatus;
  provider: string;
  message: string;
};

export interface DocumentScannerAdapter {
  readonly provider: string;
  scan(input: DocumentScanInput): Promise<DocumentScanResult>;
}

export class DisabledDocumentScanner implements DocumentScannerAdapter {
  readonly provider = "disabled";

  async scan(input: DocumentScanInput): Promise<DocumentScanResult> {
    void input;
    return {
      status: "SKIPPED",
      provider: this.provider,
      message: "AV/CDR sağlayıcısı bu sürümde yapılandırılmadı; tarama adımı atlandı."
    };
  }
}

let activeScanner: DocumentScannerAdapter | null = null;

export function getDocumentScanner() {
  activeScanner ??= new DisabledDocumentScanner();
  return activeScanner;
}

export async function scanUploadedDocument(input: DocumentScanInput) {
  return getDocumentScanner().scan(input);
}
