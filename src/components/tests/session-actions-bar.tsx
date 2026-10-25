"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import { adeptHref, routes } from "@/lib/routes";
import { deleteTestSession } from "@/lib/tests/session-actions";

/** Ändra och ta bort ett sparat test. Visas bara för adeptens coach. */
export function SessionActionsBar({
  adeptId,
  sessionId,
}: {
  adeptId: string;
  sessionId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <ButtonLink
        href={`${routes.adepts}/${adeptId}/test/${sessionId}/andra`}
        variant="secondary"
        size="sm"
      >
        <Pencil aria-hidden className="size-3.5" />
        Ändra
      </ButtonLink>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Ta bort testet? Rådatan och värdena försvinner.")) return;
          start(async () => {
            const result = await deleteTestSession(sessionId, adeptId);
            if (!result.ok) {
              window.alert(result.error ?? "Testet gick inte att ta bort.");
              return;
            }
            router.push(adeptHref(adeptId, "tester"));
            router.refresh();
          });
        }}
      >
        <Trash2 aria-hidden className="size-3.5" />
        {pending ? "Tar bort …" : "Ta bort"}
      </Button>
    </div>
  );
}
