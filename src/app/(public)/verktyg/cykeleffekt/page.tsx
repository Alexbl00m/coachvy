import { BikePowerCalculator } from "@/components/calculators/bike-power-calculator";
import { ToolHeader } from "@/components/public/tool-header";

export const metadata = {
  title: "Effekt och fart",
  description:
    "Effektbalansen på cykel: rullmotstånd, stigning och luft. Räknar fram effekt, fart eller måltid – och vad aero, vikt och däck är värda i tid.",
};

export default function BikePowerPage() {
  return (
    <>
      <ToolHeader
        title="Effekt och fart"
        description="Vid konstant fart går all effekt åt till rullmotstånd, stigning och luft. Ange två av effekt, fart och tid – modellen räknar fram den tredje."
      />
      <BikePowerCalculator />
    </>
  );
}
