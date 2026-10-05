"use client";

import { useState, useTransition } from "react";
import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resendConfirmation } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

/** Skickar bekräftelsemejlet igen och säger vad som hände, på samma rad. */
export function ResendConfirmation({
  email,
  className,
}: {
  email: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const resend = () =>
    start(async () => {
      setResult(null);
      const response = await resendConfirmation(email);
      setResult(
        response.ok
          ? { ok: true, text: `Ett nytt mejl är på väg till ${email}.` }
          : { ok: false, text: response.error ?? "Mejlet kunde inte skickas." },
      );
    });

  return (
    <div className={className}>
      <Button
        variant="secondary"
        size="sm"
        onClick={resend}
        disabled={pending || !email}
      >
        <RotateCw aria-hidden className="size-3.5" />
        {pending ? "Skickar …" : "Skicka bekräftelsemejlet igen"}
      </Button>
      {result && (
        <p
          role="status"
          className={cn(
            "mt-2 text-[13px]",
            result.ok ? "text-text-muted" : "text-bad",
          )}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}
