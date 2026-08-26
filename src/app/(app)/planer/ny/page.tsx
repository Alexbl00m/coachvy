import { ClipboardList } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Skapa ny plan" };

export default function NyPlanPage() {
  return (
    <ModulePlaceholder
      title="Skapa ny plan"
      description="Här byggs planeditorn – välj adept, period och struktur."
      icon={ClipboardList}
      planned={[
        "Välj adept och planperiod",
        "Bygg veckor och pass med mallar",
        "Koppla zoner från senaste testresultat",
      ]}
    />
  );
}
