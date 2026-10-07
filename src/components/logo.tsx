import { cn } from "@/lib/cn";

/**
 * Coachvys märke: ett C – en öppen ring – med en topp inuti.
 *
 * Ritat i en ruta på 100 × 100. Ringen är en båge på 270° (radie 38) vars
 * ändar klipps radiellt i ±45°, parallellt med toppens armar. Toppen är en
 * symmetrisk chevron med armar av samma längd, så att den inte läses som en
 * bock, och den rör inte ringen, så att C:et inte läses som ett G. Streck-
 * vikten är densamma i ring och topp.
 *
 * Två vikter, samma form: den vanliga för stora ytor och den kraftigare för
 * 32 px och mindre, där tunna streck och smala springor annars försvinner.
 * Färgen är `currentColor`, så märket följer texten på mörk och ljus yta.
 * Märket ska vara vitt eller svart – inte orange – så att det inte läses som
 * en annan aktörs orange topp (se DESIGN.md).
 */
const SHAPES = {
  regular: {
    width: 12,
    ring: "M76.87 23.13A38 38 0 1 0 76.87 76.87",
    peak: "M29 57L50 36L71 57",
  },
  bold: {
    width: 14,
    ring: "M75.46 24.54A36 36 0 1 0 75.46 75.46",
    peak: "M31 56L50 37L69 56",
  },
} as const;

export function CoachvyMark({
  weight = "regular",
  className,
}: {
  weight?: keyof typeof SHAPES;
  className?: string;
}) {
  const shape = SHAPES[weight];
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={shape.width}
      className={cn("shrink-0", className)}
    >
      <path d={shape.ring} />
      <path d={shape.peak} strokeLinejoin="miter" strokeMiterlimit={6} />
    </svg>
  );
}

type LogoProps = {
  /** Hide the wordmark and render the mark only. */
  markOnly?: boolean;
  className?: string;
};

export function Logo({ markOnly = false, className }: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <CoachvyMark weight="bold" className="size-8 text-text" />
      <span
        className={cn(
          "text-[17px] font-semibold tracking-tight text-text",
          markOnly && "sr-only",
        )}
      >
        Coachvy
      </span>
    </span>
  );
}
