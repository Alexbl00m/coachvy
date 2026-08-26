import { Bot } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "AI Coach Assistant" };

export default function AiCoachPage() {
  return (
    <ModulePlaceholder
      title="AI Coach Assistant"
      description="Assistenten som hjälper dig tolka data och utforma träning."
      icon={Bot}
      planned={[
        "Förslag på planjusteringar utifrån testresultat",
        "Sammanfattningar av en adepts period",
        "Frågor och svar om din egen träningsdata",
      ]}
    />
  );
}
