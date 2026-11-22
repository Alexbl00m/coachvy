/**
 * Hela distanstestet i ett anrop: kontroll av indata, skattning, osäkerhet, kvalitetsflaggor
 * och zoner. Det här är ingången för andra appar som använder biblioteket.
 */
import { estimateProfile, OutputSpread, ProfileEstimate, profileVariants, RemoteTestInput, spreadFromVariants, UncertaintyOptions } from "./inversion";
import { assessQuality, QualityFlag, validateInput } from "./quality";
import { MetabolicZone, metabolicZones } from "./zones";

export interface RemoteTestAnalysis {
  ok: true;
  input: RemoteTestInput;
  estimate: ProfileEstimate;
  /** 1 SD per resultat vid normala mätfel */
  spread: OutputSpread;
  /** Profilen med en felkälla i taget förskjuten; underlag för osäkerhetsband i kurvorna */
  variants: ProfileEstimate[];
  flags: QualityFlag[];
  zones: MetabolicZone[];
}

export interface RemoteTestFailure {
  ok: false;
  errors: QualityFlag[];
}

export const analyzeRemoteTest = (
  input: RemoteTestInput,
  options: UncertaintyOptions = {}
): RemoteTestAnalysis | RemoteTestFailure => {
  const errors = validateInput(input);
  if (errors.length) return { ok: false, errors };
  const estimate = estimateProfile(input);
  if (!estimate) {
    return {
      ok: false,
      errors: [
        {
          level: "error",
          code: "solve",
          title: "Beräkningen gick inte",
          message: "Testerna räcker inte för att skatta VO2max och VLaMax. Kontrollera sprinten och de längre testerna.",
        },
      ],
    };
  }
  const variants = profileVariants(input, estimate, options);
  return {
    ok: true,
    input,
    estimate,
    spread: spreadFromVariants(estimate, variants),
    variants,
    flags: assessQuality(input, estimate),
    zones: metabolicZones(estimate.engine),
  };
};
