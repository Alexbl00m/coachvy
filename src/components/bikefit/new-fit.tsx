"use client";

import { FitForm } from "./fit-form";
import type { BikeFitRow } from "@/lib/types/database";

/** En ny fit: formuläret, med videoanalysen när webbläsaren klarar den. */
export function NewFit({
  adeptId,
  today,
  previous,
}: {
  adeptId: string;
  today: string;
  previous: BikeFitRow | null;
}) {
  return <FitForm adeptId={adeptId} today={today} previous={previous} />;
}
