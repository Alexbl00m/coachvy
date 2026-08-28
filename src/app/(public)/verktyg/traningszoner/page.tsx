import { ToolHeader } from "@/components/public/tool-header";
import { ZoneCalculator } from "@/components/public/zone-calculator";

export const metadata = {
  title: "Träningszoner",
  description:
    "Träningszoner ur FTP, tröskeltempo eller critical speed – tre modeller, för de utgår från olika slags test.",
};

export default function ZonesPage() {
  return (
    <>
      <ToolHeader
        title="Träningszoner"
        description="Zoner är bara meningsfulla i förhållande till något mätt. Här är tre modeller, en för varje slags tröskelvärde – och de är inte utbytbara mot varandra."
      />
      <ZoneCalculator />
    </>
  );
}
