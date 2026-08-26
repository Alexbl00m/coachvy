import { CalendarDays } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Kalender" };

export default function KalenderPage() {
  return (
    <ModulePlaceholder
      title="Kalender"
      description="Planerade pass, tester och tävlingar samlat på ett ställe."
      icon={CalendarDays}
      planned={[
        "Vecko- och månadsvy för dig och dina adepter",
        "Dra och släpp pass mellan dagar",
        "Synk mot externa kalendrar",
      ]}
    />
  );
}
