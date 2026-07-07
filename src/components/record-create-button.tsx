"use client";

import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ActionButton } from "@/components/action-buttons";
import { EntityForm, type EntityFormField } from "@/components/entity-form";
import { FormModal } from "@/components/form-modal";
import type { SchemaKey } from "@/lib/validations";

type RecordCreateButtonProps = {
  label: string;
  title: string;
  endpoint: string;
  schemaKey: SchemaKey;
  fields: EntityFormField[];
  defaults: Record<string, string>;
  submitLabel?: string;
  successMessage?: string;
  autoOpenParam?: string;
};

export function RecordCreateButton({
  label,
  title,
  endpoint,
  schemaKey,
  fields,
  defaults,
  submitLabel = "Kaydet",
  successMessage = "Kayıt oluşturuldu.",
  autoOpenParam
}: RecordCreateButtonProps) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!autoOpenParam || searchParams.get(autoOpenParam) !== "1") {
      return;
    }

    setOpen(true);
  }, [autoOpenParam, searchParams]);

  return (
    <>
      <ActionButton
        label={label}
        icon={Plus}
        tone="primary"
        className="w-full border border-white/10 bg-white text-slate-950 hover:bg-slate-100 sm:w-auto"
        onClick={() => setOpen(true)}
      />
      <FormModal open={open} title={title} onOpenChange={setOpen}>
        <EntityForm
          title={title}
          endpoint={endpoint}
          schemaKey={schemaKey}
          fields={fields}
          defaults={defaults}
          submitLabel={submitLabel}
          successMessage={successMessage}
          onSuccess={() => setOpen(false)}
        />
      </FormModal>
    </>
  );
}
