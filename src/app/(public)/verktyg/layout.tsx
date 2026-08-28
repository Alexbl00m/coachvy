import type { ReactNode } from "react";

/**
 * Verktygssidorna delar den publika sajtens header och footer, men behöver
 * en smalare spalt än marknadsföringssektionerna: en kalkyl läses som en
 * tabell, inte som en affisch.
 */
export default function ToolsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      {children}
    </div>
  );
}
