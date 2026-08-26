import { ClipboardList } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Planer" };

export default function PlanerPage() {
  return (
    <ModulePlaceholder
      title="Planer"
      description="Träningsplaner du har byggt och tilldelat dina adepter."
      icon={ClipboardList}
      planned={[
        "Skapa planer från mallar eller från grunden",
        "Tilldela planer till en eller flera adepter",
        "Versionshantering och periodisering",
      ]}
    />
  );
}
