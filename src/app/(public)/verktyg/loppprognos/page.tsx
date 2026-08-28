import { ToolHeader } from "@/components/public/tool-header";
import { RacePredictor } from "@/components/public/race-predictor";

export const metadata = {
  title: "Loppprognos",
  description:
    "Räkna ut vad dina tidigare lopp säger om nästa distans. Med två lopp skattas din egen utmattningsexponent.",
};

export default function RacePredictorPage() {
  return (
    <>
      <ToolHeader
        title="Loppprognos"
        description="Vad säger dina tidigare lopp om nästa distans? Ett lopp räcker för en prognos med Riegels schablon. Med två eller fler räknas din egen utmattningsexponent fram – och den skiljer sig mer mellan löpare än man tror."
      />
      <RacePredictor />
    </>
  );
}
