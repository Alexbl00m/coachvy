import { FlaskConical } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Testresultat" };

export default function TestresultatPage() {
  return (
    <ModulePlaceholder
      title="Testresultat"
      description="Tester, mätvärden och underlag för tröskelbestämning."
      icon={FlaskConical}
      planned={[
        "Registrera laktat-, tröskel- och kapacitetstester",
        "Importera data från filer och externa tjänster",
        "Koppla testresultat till zoner i planerna",
      ]}
    />
  );
}
