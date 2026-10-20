import { describe, expect, it } from "vitest";

import {
  utilisationDiagnosis,
  type UtilisationRow,
  type UtilisationSummary,
  type Vo2Source,
} from "./progression";

const vo2max: Vo2Source = {
  sessionId: "s1",
  performedOn: "2026-10-01",
  sport: "cykling",
  value: 63.5,
  weightKg: 75,
  measured: true,
  method: "labb",
};

const row = (
  key: string,
  pct: number,
  performedOn = "2026-10-01",
  measured = true,
): UtilisationRow => ({
  key,
  label: key,
  intensity: 280,
  unit: "W",
  pct,
  performedOn,
  protocol: "laktat-steg",
  vo2max: { ...vo2max, measured },
  range: null,
});

const summary = (
  rows: UtilisationRow[],
  measured = true,
): UtilisationSummary => ({
  rows,
  vo2max: { ...vo2max, measured },
  lt1OfLt2: null,
  sport: "cykling",
});

describe("utilisationDiagnosis", () => {
  it("pekar mot utnyttjandet när tröskeln ligger lågt", () => {
    const d = utilisationDiagnosis(summary([row("LT2", 70)]));
    expect(d?.verdict).toBe("utnyttjande");
  });

  it("pekar mot motorn när tröskeln ligger högt", () => {
    expect(utilisationDiagnosis(summary([row("LT2", 87)]))?.verdict).toBe(
      "motor",
    );
  });

  it("väljer LT2 före FTP och lägger till en reservation för skattat VO2max", () => {
    const d = utilisationDiagnosis(
      summary([row("FTP", 90), row("LT2", 80, "2026-10-01", false)]),
    );
    expect(d?.verdict).toBe("balans");
    expect(d?.label).toBe("LT2");
    expect(d?.text).toContain("VO2max är skattat");
  });

  it("tar den nyaste markören före ett gammalt laktattest", () => {
    const d = utilisationDiagnosis(
      summary([row("LT2", 70, "2025-04-17"), row("AT", 80, "2026-08-12")]),
    );
    expect(d?.label).toBe("AT");
    expect(d?.verdict).toBe("balans");
  });

  it("ger null utan en tröskelmarkör", () => {
    expect(utilisationDiagnosis(summary([row("FatMax", 60)]))).toBeNull();
  });
});
