"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { ActionButton } from "@/components/action-buttons";
import { EntityForm, type EntityFormField } from "@/components/entity-form";
import { FormModal } from "@/components/form-modal";
import type { SchemaKey } from "@/lib/validations";

type RecordEditButtonProps = {
  title: string;
  endpoint: string;
  schemaKey: SchemaKey;
  fields: EntityFormField[];
  defaults: Record<string, string>;
  successMessage?: string;
  successMessageRules?: SuccessMessageRule[];
};

type SuccessMessageRule = {
  field: string;
  value: string;
  message: string;
};

export function RecordEditButton({
  title,
  endpoint,
  schemaKey,
  fields,
  defaults,
  successMessage = "Kayıt güncellendi",
  successMessageRules = []
}: RecordEditButtonProps) {
  const [open, setOpen] = useState(false);
  const resolvedSuccessMessage =
    successMessageRules.length > 0
      ? (values: Record<string, string>) =>
          successMessageRules.find((rule) => values[rule.field] === rule.value)?.message ?? successMessage
      : successMessage;

  return (
    <>
      <ActionButton label="Düzenle" icon={Pencil} onClick={() => setOpen(true)} />
      <FormModal open={open} title={title} onOpenChange={setOpen}>
        <EntityForm
          title={title}
          endpoint={endpoint}
          method="PATCH"
          schemaKey={schemaKey}
          fields={fields}
          defaults={defaults}
          submitLabel="Güncelle"
          resetOnSuccess={false}
          successMessage={resolvedSuccessMessage}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
          idPrefix={`${schemaKey}-edit-${endpoint.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
        />
      </FormModal>
    </>
  );
}
