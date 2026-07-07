"use client";

import { WalletCards } from "lucide-react";
import { useState } from "react";

import { ActionButton } from "@/components/action-buttons";
import { EntityForm, type EntityFormField } from "@/components/entity-form";
import { FormModal } from "@/components/form-modal";

type ReminderPayButtonProps = {
  endpoint: string;
  fields: EntityFormField[];
  defaults: Record<string, string>;
};

export function ReminderPayButton({ endpoint, fields, defaults }: ReminderPayButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ActionButton
        label="Öde"
        icon={WalletCards}
        tone="primary"
        ariaLabel="Hatırlatmayı gider olarak öde"
        onClick={() => setOpen(true)}
      />
      <FormModal
        open={open}
        title="Gider Olarak Öde"
        description="Hatırlatma tamamlanır, gider kaydı ve kasa çıkışı aynı işlemde oluşturulur."
        onOpenChange={setOpen}
      >
        <EntityForm
          title="Gider Olarak Öde"
          endpoint={endpoint}
          schemaKey="reminderExpensePayment"
          fields={fields}
          defaults={defaults}
          submitLabel="Ödendi ve gider oluştur"
          resetOnSuccess={false}
          successMessage="Hatırlatma ödendi ve gider kaydı oluşturuldu."
          onSuccess={() => setOpen(false)}
        />
      </FormModal>
    </>
  );
}
