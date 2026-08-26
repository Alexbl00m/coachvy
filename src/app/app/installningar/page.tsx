import { Settings } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Inställningar" };

export default function InstallningarPage() {
  return (
    <ModulePlaceholder
      title="Inställningar"
      description="Konto, profil och inställningar för din organisation."
      icon={Settings}
      planned={[
        "Profil- och företagsuppgifter",
        "Aviseringar och e-post",
        "Teammedlemmar och behörigheter",
      ]}
    />
  );
}
