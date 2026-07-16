"use client";

import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ActionButton } from "@/components/action-buttons";
import { Drawer } from "@/components/drawer";
import { EntityForm, type EntityFormField } from "@/components/entity-form";
import type { SchemaKey } from "@/lib/validations";

type RecordCreateDrawerButtonProps = {
  label: string;
  title: string;
  description?: string;
  endpoint: string;
  schemaKey: SchemaKey;
  fields: EntityFormField[];
  defaults: Record<string, string>;
  submitLabel?: string;
  successMessage?: string;
  autoOpenParam?: string;
};

export function RecordCreateDrawerButton({
  label,
  title,
  description,
  endpoint,
  schemaKey,
  fields,
  defaults,
  submitLabel = "Kaydet",
  successMessage = "Kayıt oluşturuldu.",
  autoOpenParam
}: RecordCreateDrawerButtonProps) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    setReady(true);
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
        disabled={!ready}
        className="w-full border border-white/10 bg-white text-slate-950 hover:bg-slate-100 sm:w-auto"
        onClick={() => setOpen(true)}
      />
      <Drawer open={open} title={title} description={description} side="right" onOpenChange={setOpen}>
        <EntityForm
          title={title}
          endpoint={endpoint}
          schemaKey={schemaKey}
          fields={fields}
          defaults={defaults}
          submitLabel={submitLabel}
          successMessage={successMessage}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Drawer>
    </>
  );
}
