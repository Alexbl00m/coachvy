"use client";

import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copyTemplate } from "@/lib/plan-library/admin-actions";
import { routes } from "@/lib/routes";

import { useAction } from "./use-action";

/** Kopierar planen till de egna planmallarna och öppnar kopian. */
export function CopyPlanButton({ templateId }: { templateId: string }) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          run(
            () => copyTemplate(templateId),
            (result) => {
              if (result.id) router.push(`${routes.planTemplates}/${result.id}`);
            },
          )
        }
      >
        <Copy aria-hidden className="size-4" />
        {pending ? "Kopierar…" : "Kopiera till mina planmallar"}
      </Button>
      {error && (
        <span role="alert" className="text-[0.8125rem] text-warn">
          {error}
        </span>
      )}
    </span>
  );
}
