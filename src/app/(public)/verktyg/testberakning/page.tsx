import { PublicTestCalculator } from "@/components/public/public-test-calculator";
import { ToolHeader } from "@/components/public/tool-header";

export const metadata = {
  title: "Testberäkning",
  description:
    "Räkna ut CP, W′, FTP, VLamax, critical speed och laktattrösklar ur ditt eget test. Tolv protokoll för cykel, löpning och simning – inget konto, inget sparas.",
};

export default function TestCalculatorPage() {
  return (
    <>
      <ToolHeader
        title="Testberäkning"
        description="Tolv testprotokoll för cykel, löpning och simning – samma beräkningar som jag använder med mina adepter. Inget konto behövs och inget sparas: fyll i, läs av, och ta med dig resultatet som PDF."
      />
      <PublicTestCalculator />
    </>
  );
}
