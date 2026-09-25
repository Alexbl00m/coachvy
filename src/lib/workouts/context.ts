/**
 * Vad vi faktiskt vet om atleten, samlat på ett ställe.
 *
 * Ett genererat pass är bara så bra som talen det vilar på. Skillnaden mot en
 * chatt som skriver "4×8 min i tröskelfart" är att de talen finns här: CP och
 * W′ ur testtillfällena, uppdaterade av den rullande modellen så fort adepten
 * slår ett personbästa på någon duration.
 *
 * Modulen är avsiktligt ren – den tar testtillfällena som argument i stället
 * för att hämta dem – så att både serveråtgärden och sidan kan bygga samma
 * underlag, och så att den går att räkna på utan databas.
 */

import type { IntensityUnit, Sport } from "@/lib/calculators/lactate";
import type { RollingResult } from "@/lib/tests/rolling";
import type { SessionWithMetrics } from "@/lib/tests/session-queries";
import { protocolByKey } from "@/lib/tests/protocols";
import type { BalanceModel } from "./balance";
import type { TargetBasis } from "./schema";

/** Ett mätt värde och var det kom ifrån. */
export type KnownValue = {
  key: string;
  label: string;
  /** I basenheten: W för effekt, m/s för fart, J för W′, m för D′. */
  value: number;
  unit: string;
  source: string;
  performedOn: string | null;
};

export type AthleteContext = {
  sport: Sport;
  weightKg: number | null;
  /** Vad passets procenttal räknas mot, och värdet i basenhet. */
  basis: TargetBasis | null;
  reference: number | null;
  referenceSource: string | null;
  /** CP/W′ eller CS/D′, när båda finns. Utan den går ingen W′bal att visa. */
  balance: BalanceModel | null;
  balanceSource: string | null;
  /** Allt mätt som är värt att visa för coachen och skicka med i prompten. */
  known: KnownValue[];
  /**
   * Adeptens bakgrund ur profilen, som text. Skador, veckovolym, mål.
   * Det coachen annars hade skrivit om i varje prompt.
   */
  background: string | null;
  /**
   * Belastningsläget just nu, ur incheckningarna.
   *
   * Ett pass byggs inte i ett vakuum. En atlet som ligger 40 % över sin
   * vanliga vecka och sov dåligt i natt ska inte få samma pass som en utvilad,
   * och modellen kan bara ta hänsyn till det om den får veta det.
   */
  loadSummary: string | null;
  /** Vad som saknas och vad det betyder. */
  gaps: string[];
};

/** Farten i testets enhet till m/s. */
function toMetresPerSecond(value: number, unit: string): number | null {
  if (unit === "m/s") return value;
  if (unit === "km/h") return value / 3.6;
  return null;
}

type Found = {
  value: number;
  unit: IntensityUnit | string;
  performedOn: string;
  protocol: string;
};

/**
 * Nyaste värdet för en storhet bland testtillfällena.
 *
 * Sessionerna kommer redan sorterade nyast först, så första träffen är den
 * färskaste. Bara primärvärden räknas: ett laktattest sparar varenda metod
 * som en egen rad, och det är medianen coachen ska läsa, inte OBLA 4,0.
 */
function latestMetric(
  sessions: SessionWithMetrics[],
  key: string,
): Found | null {
  for (const session of sessions) {
    const metric = session.test_metrics.find(
      (m) => m.key === key && (m.is_primary || !m.method),
    );
    if (!metric) continue;
    return {
      value: Number(metric.value),
      unit: metric.unit,
      performedOn: session.performed_on,
      protocol: protocolByKey(session.protocol)?.label ?? session.protocol,
    };
  }
  return null;
}

/** Tröskelvärden coachen fyller i själv, när inget test finns att luta sig mot. */
export type ManualNumbers = {
  reference: number | null;
  critical: number | null;
  reserve: number | null;
};

/**
 * Underlag ihopplockat för hand.
 *
 * Passbyggaren ska gå att använda innan den första adepten har testats – och
 * för den coach som redan vet sin atlets FTP utantill. Formen är densamma som
 * den ur databasen, så resten av kedjan inte behöver veta varifrån talen kom.
 */
export function manualAthleteContext(
  sport: Sport,
  manual: ManualNumbers,
): AthleteContext {
  const cycling = sport === "cykling";
  const balance: BalanceModel | null =
    manual.critical !== null &&
    manual.critical > 0 &&
    manual.reserve !== null &&
    manual.reserve > 0
      ? { critical: manual.critical, reserve: manual.reserve }
      : null;

  const basis: TargetBasis = cycling
    ? "FTP"
    : sport === "simning"
      ? "CSS"
      : "CS";

  const reference =
    manual.reference !== null && manual.reference > 0
      ? manual.reference
      : balance
        ? cycling
          ? balance.critical * 0.95
          : balance.critical
        : null;

  return {
    sport,
    weightKg: null,
    basis: reference === null ? null : basis,
    reference,
    referenceSource: reference === null ? null : "angivet för hand",
    balance,
    balanceSource: balance ? "angivet för hand" : null,
    known: [],
    background: null,
    loadSummary: null,
    gaps:
      balance === null
        ? [
            cycling
              ? "Utan CP och W′ går passet inte att pröva mot den anaeroba reserven."
              : "Utan CS och D′ går passet inte att pröva mot den anaeroba reserven.",
          ]
        : [],
  };
}

export type ContextInput = {
  sport: Sport;
  weightKg: number | null;
  /** Testtillfällen för adepten, nyast först. Filtreras på gren här. */
  sessions: SessionWithMetrics[];
  /** Rullande CP/CS, när det finns underlag. */
  rolling: RollingResult | null;
  /** Bakgrunden ur adeptprofilen, redan formaterad. */
  background?: string | null;
  /** Belastningsläget ur incheckningarna, redan formaterat. */
  loadSummary?: string | null;
};

export function buildAthleteContext(input: ContextInput): AthleteContext {
  const sessions = input.sessions.filter((s) => s.sport === input.sport);
  const cycling = input.sport === "cykling";
  const known: KnownValue[] = [];
  const gaps: string[] = [];

  const push = (
    key: string,
    label: string,
    value: number,
    unit: string,
    found: { performedOn: string; protocol: string } | null,
    override?: string,
  ) =>
    known.push({
      key,
      label,
      value,
      unit,
      source: override ?? (found ? found.protocol : "–"),
      performedOn: found?.performedOn ?? null,
    });

  // -------------------------------------------------------------------------
  // Tröskeln och reserven
  // -------------------------------------------------------------------------
  let balance: BalanceModel | null = null;
  let balanceSource: string | null = null;

  const criticalKey = cycling ? "CP" : "CS";
  const reserveKey = cycling ? "W_prime" : "D_prime";

  const criticalFound = latestMetric(sessions, criticalKey);
  const reserveFound = latestMetric(sessions, reserveKey);

  // I basenhet: effekt är redan watt, fart kan vara km/h och måste räknas om.
  const criticalValue = criticalFound
    ? cycling
      ? criticalFound.value
      : toMetresPerSecond(criticalFound.value, criticalFound.unit)
    : null;
  // W′ sparas i kilojoule, modellen räknar i joule. D′ är redan meter.
  const reserveValue = reserveFound
    ? cycling
      ? reserveFound.value * 1000
      : reserveFound.value
    : null;

  if (criticalValue !== null && criticalValue > 0) {
    push(
      criticalKey,
      cycling ? "Critical power" : "Critical speed",
      criticalValue,
      cycling ? "W" : "m/s",
      criticalFound,
    );
  }
  if (reserveValue !== null && reserveValue > 0) {
    push(
      reserveKey,
      cycling ? "W′" : "D′",
      reserveValue,
      cycling ? "J" : "m",
      reserveFound,
    );
  }

  /**
   * Den rullande modellen går före det senaste hela testet.
   *
   * Det är hela poängen med den: en adept som slår sitt 3-minutersbästa i ett
   * intervallpass har flyttat kurvan, även om ingen kallade det ett test.
   * Talen ska följa med dit direkt, inte vänta på nästa testtillfälle.
   */
  if (input.rolling && input.rolling.primary > 0 && input.rolling.reserve > 0) {
    balance = {
      critical: input.rolling.primary,
      reserve: input.rolling.reserve,
    };
    balanceSource = input.rolling.updatedByNewBest
      ? `rullande modell, uppdaterad av ett nytt bästavärde ${input.rolling.latestEffort}`
      : `rullande modell över ${input.rolling.usedEfforts.length} durationsband`;
  } else if (
    criticalValue !== null &&
    criticalValue > 0 &&
    reserveValue !== null &&
    reserveValue > 0
  ) {
    balance = { critical: criticalValue, reserve: reserveValue };
    balanceSource = `${criticalFound?.protocol ?? "test"} ${criticalFound?.performedOn ?? ""}`.trim();
  }

  if (!balance) {
    gaps.push(
      criticalValue === null
        ? `Ingen ${cycling ? "critical power" : "critical speed"} är mätt, så passet kan inte prövas mot den anaeroba reserven.`
        : `${cycling ? "W′" : "D′"} saknas. Ett test med minst två insatser av olika längd ger det.`,
    );
  }

  // -------------------------------------------------------------------------
  // Referensen passets procenttal räknas mot
  // -------------------------------------------------------------------------
  let basis: TargetBasis | null = null;
  let reference: number | null = null;
  let referenceSource: string | null = null;

  if (cycling) {
    const ftp = latestMetric(sessions, "FTP");
    if (ftp && ftp.value > 0) {
      basis = "FTP";
      reference = ftp.value;
      referenceSource = `${ftp.protocol} ${ftp.performedOn}`;
      push("FTP", "FTP", ftp.value, "W", ftp);
    } else if (balance) {
      // FTP i den här appen är 0,95 × CP överallt annars; samma här.
      basis = "FTP";
      reference = balance.critical * 0.95;
      referenceSource = `0,95 × CP (${balanceSource})`;
      push("FTP", "FTP", reference, "W", null, referenceSource);
    }
  } else {
    const csValue = balance?.critical ?? criticalValue;
    if (csValue !== null && csValue > 0) {
      basis = input.sport === "simning" ? "CSS" : "CS";
      reference = csValue;
      referenceSource = balanceSource ?? `${criticalFound?.protocol ?? "test"}`;
    } else {
      const lt2 = latestMetric(sessions, "LT2");
      const lt2Speed = lt2 ? toMetresPerSecond(lt2.value, lt2.unit) : null;
      if (lt2 && lt2Speed !== null && lt2Speed > 0) {
        basis = "LT2";
        reference = lt2Speed;
        referenceSource = `${lt2.protocol} ${lt2.performedOn}`;
        push("LT2", "LT2 – anaerob tröskel", lt2Speed, "m/s", lt2);
      }
    }
  }

  // Laktattrösklarna är värda att visa även när de inte är referensen: de
  // säger var det lugna arbetet ligger, vilket procent av CP inte gör.
  if (!cycling && basis !== "LT2") {
    const lt1 = latestMetric(sessions, "LT1");
    const lt1Speed = lt1 ? toMetresPerSecond(lt1.value, lt1.unit) : null;
    if (lt1Speed !== null && lt1Speed > 0) {
      push("LT1", "LT1 – aerob tröskel", lt1Speed, "m/s", lt1);
    }
  } else if (cycling) {
    const lt2 = latestMetric(sessions, "LT2");
    if (lt2 && lt2.unit === "W" && lt2.value > 0) {
      push("LT2", "LT2 – anaerob tröskel", lt2.value, "W", lt2);
    }

    // Den metabola profilen. Inget av det styr procenttalen, men det säger
    // varför atleten är som hen är: en hög VLamax förklarar en låg tröskel i
    // förhållande till VO2max, och FatMax är där långa lugna pass hör hemma.
    for (const [key, label] of [
      ["AT", "Anaerob tröskel (Mader)"],
      ["FatMax", "FatMax"],
      ["VLamax", "VLamax"],
      ["VO2max", "VO2max"],
    ] as const) {
      const found = latestMetric(sessions, key);
      if (found && found.value > 0) push(key, label, found.value, found.unit, found);
    }
  }

  if (reference === null) {
    gaps.push(
      "Inget mätt referensvärde finns för den här grenen. Registrera ett testtillfälle först – annars blir procenttalen bara siffror.",
    );
  }

  if (input.weightKg && input.weightKg > 0) {
    push("vikt", "Vikt", input.weightKg, "kg", null, "adeptprofilen");
  }

  return {
    sport: input.sport,
    weightKg: input.weightKg,
    basis,
    reference,
    referenceSource,
    balance,
    balanceSource,
    known,
    background: input.background ?? null,
    loadSummary: input.loadSummary ?? null,
    gaps,
  };
}

/**
 * Underlaget som text, för prompten.
 *
 * Modellen ska se exakt de tal coachen ser, i samma enheter, med datum. Ett
 * pass byggt på "ungefär 280 W" är inte samma sak som ett byggt på ett mätt
 * CP från i förrgår, och skillnaden ska synas i underlaget.
 */
export function contextToPrompt(context: AthleteContext): string {
  const lines: string[] = [`Gren: ${context.sport}`];

  if (context.reference !== null && context.basis) {
    const unit = context.sport === "cykling" ? "W" : "m/s";
    lines.push(
      `Referens för alla procenttal: ${context.basis} = ${context.reference.toFixed(context.sport === "cykling" ? 0 : 2)} ${unit} (${context.referenceSource}).`,
    );
  }

  if (context.balance) {
    const cycling = context.sport === "cykling";
    lines.push(
      cycling
        ? `CP = ${context.balance.critical.toFixed(0)} W, W′ = ${(context.balance.reserve / 1000).toFixed(1)} kJ (${context.balanceSource}).`
        : `CS = ${context.balance.critical.toFixed(2)} m/s, D′ = ${context.balance.reserve.toFixed(0)} m (${context.balanceSource}).`,
    );
  }

  const rest = context.known.filter(
    (k) => !["CP", "CS", "W_prime", "D_prime"].includes(k.key),
  );
  if (rest.length > 0) {
    lines.push("Övriga mätta värden:");
    for (const k of rest) {
      lines.push(
        `- ${k.label}: ${k.value.toFixed(k.unit === "m/s" || k.unit === "mmol/l/s" ? 2 : k.unit === "ml/kg/min" || k.unit === "kg" ? 1 : 0)} ${k.unit}${k.performedOn ? ` (${k.source}, ${k.performedOn})` : ` (${k.source})`}`,
      );
    }
  }

  if (context.background) {
    lines.push("", context.background);
  }

  if (context.loadSummary) {
    lines.push("", context.loadSummary);
  }

  if (context.gaps.length > 0) {
    lines.push("", `Saknas: ${context.gaps.join(" ")}`);
  }

  return lines.join("\n");
}
