import { ToolHeader } from "@/components/public/tool-header";
import { ZoneCalculator } from "@/components/public/zone-calculator";

export const metadata = {
  title: "Träningszoner",
  description:
    "Träningszoner ur FTP, tröskeltempo eller critical speed. Tre modeller, eftersom de utgår från tre slags test.",
};

export default function ZonesPage() {
  return (
    <>
      <ToolHeader
        title="Träningszoner"
        description="Zoner betyder något först när de räknas från något mätt. Här finns tre modeller, en för varje slags tröskelvärde. De går inte att byta mot varandra."
      />
      <ZoneCalculator />
    </>
  );
}
