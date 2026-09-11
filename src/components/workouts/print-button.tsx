"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Utskrift via webbläsarens egen dialog, som på de publika räknarna.
 *
 * Ett pass som ska med ut på vägen eller till bassängkanten vill man ha på
 * papper eller som PDF, och "Spara som PDF" ligger redan i den dialogen.
 */
export function PrintButton({ label = "Skriv ut" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Printer aria-hidden className="size-4" />
      {label}
    </Button>
  );
}
