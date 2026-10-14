"use client";

import { useState } from "react";
import { Library } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LibrarySession } from "@/lib/session-library/library";

import { LibraryPicker } from "./library-picker";
import { ScheduleDialog } from "./schedule-dialog";

/**
 * "Lägg till pass ur biblioteket" på en dag i kalendern: välj passet, sedan
 * nivå – adepten och dagen är redan givna.
 */
export function AddFromLibrary({
  sessions,
  adept,
  date,
}: {
  sessions: LibrarySession[];
  adept: { id: string; full_name: string };
  date: string;
}) {
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<LibrarySession | null>(null);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
        <Library aria-hidden className="size-3.5" />
        Lägg till pass ur biblioteket
      </Button>
      <LibraryPicker
        open={picking}
        onClose={() => setPicking(false)}
        sessions={sessions}
        description={`Passet läggs i kalendern för ${adept.full_name} och räknas om mot adeptens värden. Nivån väljer du i nästa steg.`}
        onPick={(session) => {
          setPicking(false);
          setChosen(session);
        }}
      />
      <ScheduleDialog
        key={chosen ? `${chosen.id}-${date}` : "stängd"}
        session={chosen}
        adepts={[adept]}
        initialAdeptId={adept.id}
        initialDate={date}
        onClose={() => setChosen(null)}
      />
    </>
  );
}
