import { CapitalImportWizard } from "@/components/capital-import-wizard";
import { requireUser } from "@/lib/auth";
import { getDocumentUploadLimitBytes } from "@/lib/document-storage";

export default async function CapitalImportPage() {
  const user = await requireUser();
  const maxUploadBytes = await getDocumentUploadLimitBytes(user.id);
  const maxUploadMb = Math.round(maxUploadBytes / 1024 / 1024);

  return <CapitalImportWizard maxUploadMb={maxUploadMb} />;
}
