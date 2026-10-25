"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Share, ShareKind } from "@/lib/sharing/shares";

import { ShareDialog } from "./share-dialog";

/** Knappen som öppnar "Vem ser det här?" för ett pass eller en plan. */
export function ShareButton({
  kind,
  itemId,
  title,
  shares,
  adepts,
  ownerIsAdmin,
  size = "sm",
}: {
  kind: ShareKind;
  itemId: string;
  title: string;
  shares: Share[];
  adepts: { id: string; full_name: string }[];
  ownerIsAdmin: boolean;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant="secondary" onClick={() => setOpen(true)}>
        <Share2 aria-hidden className="size-3.5" />
        Välj vem som ser {kind === "pass" ? "passet" : "planen"}
      </Button>
      {open && (
        <ShareDialog
          open
          onClose={() => setOpen(false)}
          kind={kind}
          itemId={itemId}
          title={title}
          shares={shares}
          adepts={adepts}
          ownerIsAdmin={ownerIsAdmin}
        />
      )}
    </>
  );
}
