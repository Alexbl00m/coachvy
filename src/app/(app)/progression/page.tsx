import { BarChart3 } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Progression" };

export default function ProgressionPage() {
  return (
    <ModulePlaceholder
      title="Progression"
      description="Utveckling över tid för varje adept och för hela stallet."
      icon={BarChart3}
      planned={[
        "Trendkurvor per testvariabel",
        "Jämför perioder och planer mot utfall",
        "Flaggor för avvikelser och stagnation",
      ]}
    />
  );
}
