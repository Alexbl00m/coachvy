import { describe, expect, it } from "vitest";

import { readReportText } from "./report-text";

/**
 * Sidtexterna som unpdf läser ur riktiga rapporter, med namn, adresser och
 * annat som inte behövs borttaget. Ordningen och radbrytningarna är
 * rapporternas egna.
 */
const AKTIVITUS_TAIL =
  "00:00 03:00 06:00 09:00 12:00 15:00 18:00 21:00\nEffekt (W)\nLaktattest cykel\nRPE (Borg) Kadens (rpm) Hjärtfrekvens (slag/min) Effekt (W) Laktat (mmol/l)\nAktivitus";

const aktivitusCycling = (chart: string) => [
  "2020-11-27 14:26\nTestrapport\n2020-11-27\nNamn: X Starteffekt: 80 W\nEffektökning: 40 W\nIntervalltid: 3:00 min\nVikt: 78,5 kg\nAktivitus",
  `2020-11-27 14:26\nAnaerob tröskel (AT/FTP): Maxpuls:\nEffekt: 300 W Estimerad: 185 slag/min\nEffekt/kg 3,82 W/kg Högsta puls på test: 180 slag/min\nTröskelpuls: 164 slag/min\nAerob Tröskel (LT), FatMax: Intensitetszoner:\nEffekt: 190 W Högintensiv träningszon: 164 -185 slag/min\nEffekt/kg: 2,42 W/kg Medelintensiv träningszon: 135 -164 slag/min\nTröskelpuls: 135 slag/min Lågintensiv träningszon: 115 -135 slag/min\n${chart}\n${AKTIVITUS_TAIL}`,
  "Protokoll och testvärden\nUtmattning:\nTid: 07:40 min\nEffekt: 420 W\nTestvärde: 63,5 ml O2/kg/min\nAktivitus",
];

describe("Aktivitus", () => {
  it("läser cykeltestet: vilan först, pulsen per minut, kadensen före", () => {
    const result = readReportText(
      aktivitusCycling(
        "8\n10\n12\n14\n15\n16\n17\n1.3 1.37 1.38 1.27 1.6 1.97\n3.01\n5.13\n90 92 90 90 93 94 99\n89 96 98 100 105 106 109 115 119 121\n131 131 132 139 145 149 154 157 158 164 165 166\n80\n120\n160\n200\n240\n280\n320\n0\n40\n80\n120\n160\n200\n240",
      ),
    );
    expect(result?.format).toBe("Aktivitus");
    const r = result!.reading;
    expect(r.sport).toBe("cykling");
    expect(r.performedOn).toBe("2020-11-27");
    expect(r.weightKg).toBe(78.5);
    expect(r.rest).toEqual({ lactate: 1.3, heartRate: 89 });
    expect(r.steps.map((s) => s.intensity)).toEqual([
      80, 120, 160, 200, 240, 280, 320,
    ]);
    expect(r.steps.map((s) => s.lactate)).toEqual([
      1.37, 1.38, 1.27, 1.6, 1.97, 3.01, 5.13,
    ]);
    // Pulsen i slutet av varje tre minuters steg.
    expect(r.steps.map((s) => s.heartRate)).toEqual([
      100, 109, 121, 132, 149, 158, 166,
    ]);
    expect(r.steps.map((s) => s.rpe)).toEqual([8, 10, 12, 14, 15, 16, 17]);
    expect(r.steps.every((s) => s.durationSeconds === 180)).toBe(true);
    expect(r.peak).toEqual({
      intensity: null,
      heartRate: 180,
      lactate: null,
      vo2max: 63.5,
    });
    expect(r.labValues).toContain("AT 300 W (164 slag/min)");
    expect(r.labValues).toContain("LT 190 W (135 slag/min)");
    expect(r.warnings).toEqual([]);
  });

  it("läser ett cykeltest utan kadens", () => {
    const r = readReportText(
      aktivitusCycling(
        "7\n8\n10\n12\n13\n15\n18\n2.5\n1.98 1.97 2.06 2.3 2.73\n3.99\n6.32\n93 95 94 96 104 103 102\n112 115 113\n124 129 126\n140 142 143\n157 161 161\n172 176 179\n80\n120\n160\n200\n240\n280\n320\n0\n40",
      ),
    )!.reading;
    expect(r.rest).toEqual({ lactate: 2.5, heartRate: 93 });
    expect(r.steps.map((s) => s.heartRate)).toEqual([
      96, 102, 113, 126, 143, 161, 179,
    ]);
  });

  it("läser löptestet i km/h med fyra minuters steg", () => {
    const r = readReportText([
      "Testrapport\n2020-11-27\nNamn: X Starthastighet: 10,0 km/h\nHastighetsökning: 1,0 km/h\nIntervalltid: 4:00 min\nVikt: 78,5 kg\nAktivitus",
      "Anaerob tröskel (AT): Maxpuls:\nHastighet: 14,5 km/h Estimerad: 185 slag/min\nTempo: 4:05 min/km Högsta puls på test: 170 slag/min\nTröskelpuls: 170 slag/min\nAerob Tröskel (LT), FatMax: Intensitetszoner:\nHastighet: 12,0 km/h Högintensiv träningszon: 170 -185 slag/min\nTempo: 5:00 min/km Medelintensiv träningszon: 155 -170 slag/min\nTröskelpuls: 155 slag/min Lågintensiv träningszon: 135 -155 slag/min\n11\n13\n15\n16 16\n17\n1.3 1.6 1.4 1.4 1.8 2.4\n4.2\n100\n136 137 137 138 142 143 144 146 154 153 153 154 161 160 160 160 165 164 166 165 167 167 168 170\n10\n11\n12\n13\n14\n15\n6\n7\n8\n00:00 04:00 08:00\nLaktattest löpning\nAktivitus",
    ])!.reading;
    expect(r.sport).toBe("löpning");
    expect(r.unit).toBe("km/h");
    expect(r.steps.map((s) => s.intensity)).toEqual([10, 11, 12, 13, 14, 15]);
    expect(r.steps.map((s) => s.lactate)).toEqual([
      1.6, 1.4, 1.4, 1.8, 2.4, 4.2,
    ]);
    expect(r.steps.map((s) => s.heartRate)).toEqual([
      138, 146, 154, 160, 165, 170,
    ]);
    expect(r.rest).toEqual({ lactate: 1.3, heartRate: 100 });
    expect(r.steps[0].durationSeconds).toBe(240);
    expect(r.labValues).toContain("AT 14,5 km/h");
  });
});

describe("Ergonizer", () => {
  it("läser tabellen med vilan i första kolumnen och ett kortare sista steg", () => {
    const r = readReportText([
      "Ergonizer\nOn 2024-11-22, a multi-stage test was performed on bicycle ergometer. The final\nload step was held by 2:00 min.",
      "Performance diagnostics\nCycling ergometry on 2024-11-22\nErgonizer\nSupplemental data\nCycling ergometry, Step duration 4 min\nPerformance\nWatt\n(Rest)\n160\n180\n200\nRel. Power\nWatt/kg\n(Rest)\n1.80\n2.02\n2.25\nHeart rate\nbpm\n60\n107\n113\n120\nLactate\nmmol/L\n0.80\n0.80\n0.80\n1.10\nRPE\n6 - 20\n(Rest)\n10\n11\n11\nEnergy expenditure\nkcal/h\n89\nAnalysis of results\nBody weight 89.0 kg\nLT 175.1 Watt\nIAT (Lactate constant: 0.5 mmol/L) 219.4 Watt\nMax. glyc. Power ( VLaMax ) 0.93 mmol/L/s",
    ])!;
    expect(r.format).toBe("Ergonizer");
    expect(r.reading.performedOn).toBe("2024-11-22");
    expect(r.reading.rest).toEqual({ lactate: 0.8, heartRate: 60 });
    expect(
      r.reading.steps.map((s) => [s.intensity, s.lactate, s.heartRate, s.rpe]),
    ).toEqual([
      [160, 0.8, 107, 10],
      [180, 0.8, 113, 11],
      [200, 1.1, 120, 11],
    ]);
    expect(r.reading.steps.map((s) => s.durationSeconds)).toEqual([
      240, 240, 120,
    ]);
    expect(r.reading.labValues).toBe(
      "LT 175,1 W · IAT 219,4 W · VLamax 0,93 mmol/l/s",
    );
  });
});

describe("Tabeller", () => {
  it("läser bara det aktuella testet ur laktatkurvan", () => {
    const r = readReportText([
      "Datum: 2024-08-23 Datum föregående test: 2024-03-15\nNamn Watt Laktat Puls Borg Watt/Km Laktat Puls Borg\nKön 230 1,23 140 10 230 1,41 143 10\nÅlder 260 1,57 148 12 260 2,01 159 12\nVikt 290 2,7 164 14 290 3,78 173 14\nLängd 320 5,19 175 15 320 7,37 182 17\nWatt Zon\n230-270 A1 124 154\n81 kg",
    ])!.reading;
    expect(r.performedOn).toBe("2024-08-23");
    expect(r.weightKg).toBe(81);
    expect(
      r.steps.map((s) => [s.intensity, s.lactate, s.heartRate, s.rpe]),
    ).toEqual([
      [230, 1.23, 140, 10],
      [260, 1.57, 148, 12],
      [290, 2.7, 164, 14],
      [320, 5.19, 175, 15],
    ]);
  });

  it("läser 30K:s protokoll", () => {
    const r = readReportText([
      "Typ av test Cykel\nVikt 79\nDatum 2023-08-23\nBelastning (w) Laktat [mmol] Puls [bpm]\nVO2/kg 76,96 ml/kg\n225 1,3 130 Anaerob tröskel 164 bpm Sluttid 9,5 min\n260 1,9 144 Tröskelpuls % 83 % Slutwatt 470 watt\n295 3,4 158 Maxpuls 197 bpm\n330 5,1 174 Övrig info",
    ])!.reading;
    expect(r.steps.map((s) => s.intensity)).toEqual([225, 260, 295, 330]);
    expect(r.peak).toEqual({
      intensity: 470,
      heartRate: 197,
      lactate: null,
      vo2max: 76.96,
    });
  });

  it("lämnar okända rapporter åt modellen", () => {
    expect(readReportText(["Någon annan rapport\n100 2,0 150"])).toBeNull();
  });
});
