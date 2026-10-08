"use client";

import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, FilePlus2, Send, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  deleteDraft,
  newDraft,
  publishVersion,
  setTemplateArchived,
} from "@/lib/plan-library/admin-actions";
import { routes } from "@/lib/routes";

import { useAction } from "../use-action";

/** Publicera, nytt utkast, ta bort utkast och arkivera mallen. */
export function TemplateActions({
  templateId,
  versionId,
  status,
  hasDraft,
  archived,
  blocking,
  instances,
}: {
  templateId: string;
  versionId: string;
  status: "utkast" | "publicerad" | "arkiverad";
  hasDraft: boolean;
  archived: boolean;
  /** Fel som stoppar publiceringen. */
  blocking: number;
  instances: number;
}) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  const base = `${routes.planTemplates}/${templateId}`;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {status === "utkast" ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                if (!confirm("Ta bort utkastet? Det går inte att ångra."))
                  return;
                run(
                  () => deleteDraft(versionId),
                  () => router.push(base),
                );
              }}
            >
              <Trash2 aria-hidden className="size-4" />
              Ta bort utkastet
            </Button>
            <Button
              size="sm"
              disabled={pending || blocking > 0}
              title={
                blocking > 0 ? "Rätta felen under Översikt först." : undefined
              }
              onClick={() => {
                if (
                  !confirm(
                    "Publicera? Versionen kan inte ändras efteråt – nya medlemmar får den här, och planer som redan startats behåller sin version.",
                  )
                )
                  return;
                run(() => publishVersion(versionId));
              }}
            >
              <Send aria-hidden className="size-4" />
              Publicera
            </Button>
          </>
        ) : (
          !hasDraft && (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                run(
                  () => newDraft(templateId),
                  (r) => router.push(`${base}?v=${r.id}`),
                )
              }
            >
              <FilePlus2 aria-hidden className="size-4" />
              Nytt utkast
            </Button>
          )
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (
              !archived &&
              !confirm(
                `Arkivera mallen? Den försvinner ur biblioteket.${instances > 0 ? ` De ${instances} planer som redan startats fortsätter som vanligt.` : ""}`,
              )
            )
              return;
            run(() => setTemplateArchived(templateId, !archived));
          }}
        >
          {archived ? (
            <ArchiveRestore aria-hidden className="size-4" />
          ) : (
            <Archive aria-hidden className="size-4" />
          )}
          {archived ? "Ta tillbaka" : "Arkivera"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="max-w-md text-right text-sm text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
