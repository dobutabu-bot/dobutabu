import type { AuditEntityType } from "@prisma/client";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { DetailSection } from "@/components/detail-shell";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

type DetailActivityLogProps = {
  userId: string;
  entityType: AuditEntityType;
  entityId: string;
};

export async function DetailActivityLog({ userId, entityType, entityId }: DetailActivityLogProps) {
  const logs = await prisma.auditLog.findMany({
    where: { userId, entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  return (
    <DetailSection
      id="activity"
      title="İşlem Geçmişi"
      description="Bu kayıt üzerinde yapılan son kritik işlemler."
    >
      {logs.length === 0 ? (
        <EmptyState title="İşlem geçmişi yok" description="Bu kayıt için henüz audit log bulunmuyor." />
      ) : (
        <DataTable
          rows={logs}
          empty="İşlem geçmişi yok"
          columns={[
            { header: "Tarih", cell: (row) => formatDate(row.createdAt) },
            { header: "İşlem", cell: (row) => row.action },
            { header: "Açıklama", cell: (row) => row.message ?? "-" }
          ]}
        />
      )}
    </DetailSection>
  );
}
