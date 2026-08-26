import { Users } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Adepter" };

export default function AdepterPage() {
  return (
    <ModulePlaceholder
      title="Adepter"
      description="Dina adepter, deras profiler och koppling till dig som coach."
      icon={Users}
      planned={[
        "Lista och sök bland dina adepter",
        "Bjud in nya adepter via e-post",
        "Adeptprofil med sport, mål och nuvarande nivå",
      ]}
    />
  );
}
