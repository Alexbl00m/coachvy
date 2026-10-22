"use client";

import { useEffect, useState } from "react";

/**
 * Hur mycket gränssnittet är uppskalat: rotens textstorlek mot 16 px. Den
 * växer på stora skärmar (globals.css), och ritningar som räknar i pixlar
 * – tidslinjens rader, etiketternas bredd – skalar med den.
 */
export function useRootScale(): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const read = () =>
      setScale(
        parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 ||
          1,
      );
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return scale;
}
