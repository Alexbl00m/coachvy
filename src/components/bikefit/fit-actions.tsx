"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, ButtonLink } from "@/components/ui/button";
import { deleteFit, shareFit } from "@/lib/bikefit/actions";
import { adeptHref, routes } from "@/lib/routes";

/** Coachens knappar på en fit: dela med adepten, ändra, ta bort. */
export function FitActions({
  adeptId,
  fitId,
  shared,
}: {
  adeptId: string;
  fitId: string;
  shared: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggleShare = () =>
    start(async () => {
      setError(null);
      const r = await shareFit(fitId, !shared);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });

  const remove = () => {
    if (
      !window.confirm(
        "Ta bort fiten, videon och bilden? Det går inte att ångra.",
      )
    )
      return;
    start(async () => {
      setError(null);
      const r = await deleteFit(fitId);
      if (!r.ok) setError(r.error);
      else {
        router.push(adeptHref(adeptId, "bikefit"));
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={shared ? "secondary" : "primary"}
        onClick={toggleShare}
        disabled={pending}
      >
        {shared ? "Sluta dela" : "Dela med adepten"}
      </Button>
      <ButtonLink
        variant="secondary"
        href={`${routes.adepts}/${adeptId}/bikefit/${fitId}/andra`}
      >
        Ändra
      </ButtonLink>
      <Button type="button" variant="ghost" onClick={remove} disabled={pending}>
        Ta bort
      </Button>
      {error && (
        <p role="alert" className="w-full text-[13px] text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
