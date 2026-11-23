"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { saveAdeptProfile } from "@/lib/adepts/profile-actions";
import { swimPaceText } from "@/lib/workouts/swim-pace";
import type { AdeptProfileRow } from "@/lib/types/database";

/**
 * Adeptens bakgrund.
 *
 * Det här är vad coachen annars skriver om i varje prompt: att hon är på väg
 * tillbaka från en hälsena, att hon tränar sex timmar i veckan, att loppet är
 * om tre veckor. Står det här går det med automatiskt till passbyggaren och
 * AI-coachen, och behöver inte upprepas.
 *
 * Inget fält är obligatoriskt. En halvifylld profil är mer värd än en tom, och
 * ett tomt fält skickas inte med som "okänt" utan utelämnas helt.
 */

const numberOrNull = (raw: string): number | null => {
  const value = Number(raw.replace(",", "."));
  return raw.trim() && Number.isFinite(value) ? value : null;
};

const text = (value: string | null | undefined) => value ?? "";
const digits = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(Number(value));

export function AdeptProfileForm({
  adeptId,
  profile,
  swimFromTest = null,
}: {
  adeptId: string;
  profile: AdeptProfileRow | null;
  /** Tävlingsfarten ur det senaste simtestet, s/100 m. */
  swimFromTest?: {
    im: number | null;
    half: number | null;
    testedOn: string;
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [birthYear, setBirthYear] = useState(digits(profile?.birth_year));
  const [sex, setSex] = useState(text(profile?.sex));
  const [heightCm, setHeightCm] = useState(digits(profile?.height_cm));
  const [trainingYears, setTrainingYears] = useState(
    digits(profile?.training_years),
  );
  const [weeklyHours, setWeeklyHours] = useState(digits(profile?.weekly_hours));
  const [weeklySessions, setWeeklySessions] = useState(
    digits(profile?.weekly_sessions),
  );
  const [injuries, setInjuries] = useState(text(profile?.injuries));
  const [medical, setMedical] = useState(text(profile?.medical));
  const [strengths, setStrengths] = useState(text(profile?.strengths));
  const [weaknesses, setWeaknesses] = useState(text(profile?.weaknesses));
  const [goal, setGoal] = useState(text(profile?.goal));
  const [goalDate, setGoalDate] = useState(text(profile?.goal_date));
  /** Vad ett tomt fält betyder: testets fart, om det finns ett simtest. */
  const raceHint = (token: string, tested: number | null) =>
    tested && swimFromTest
      ? `Per 100 m, för ${token} i simpassen. Tomt följer simtestet ${swimFromTest.testedOn}: ${swimPaceText(tested)}.`
      : `Per 100 m, för ${token} i simpassen. Tomt följer simtestet när det finns ett.`;
  const pace = (v: number | string | null | undefined) =>
    v === null || v === undefined ? "" : swimPaceText(Number(v));
  const [swimIm, setSwimIm] = useState(pace(profile?.swim_im_pace));
  const [swimHalf, setSwimHalf] = useState(pace(profile?.swim_703_pace));

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = () =>
    startTransition(async () => {
      setError(null);
      setSaved(false);

      const result = await saveAdeptProfile({
        adeptId,
        birthYear: numberOrNull(birthYear),
        sex: sex === "" ? null : (sex as "man" | "kvinna" | "annat"),
        heightCm: numberOrNull(heightCm),
        trainingYears: numberOrNull(trainingYears),
        weeklyHours: numberOrNull(weeklyHours),
        weeklySessions: numberOrNull(weeklySessions),
        injuries,
        medical,
        strengths,
        weaknesses,
        goal,
        goalDate: goalDate || null,
        swimImPace: swimIm,
        swimHalfPace: swimHalf,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });

  return (
    <Card className="min-w-0">
      <CardTitle>Bakgrund</CardTitle>

      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Födelseår" htmlFor="birth_year" optional>
            <Input
              id="birth_year"
              inputMode="numeric"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
            />
          </Field>

          <Field label="Kön" htmlFor="sex" optional>
            <Select
              id="sex"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
            >
              <option value="">–</option>
              <option value="man">Man</option>
              <option value="kvinna">Kvinna</option>
              <option value="annat">Annat</option>
            </Select>
          </Field>

          <Field label="Längd" htmlFor="height_cm" hint="cm" optional>
            <Input
              id="height_cm"
              inputMode="decimal"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </Field>

          <Field
            label="Tränat strukturerat"
            htmlFor="training_years"
            hint="år"
            optional
          >
            <Input
              id="training_years"
              inputMode="decimal"
              value={trainingYears}
              onChange={(e) => setTrainingYears(e.target.value)}
            />
          </Field>

          <Field
            label="Veckovolym"
            htmlFor="weekly_hours"
            hint="timmar"
            optional
          >
            <Input
              id="weekly_hours"
              inputMode="decimal"
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value)}
            />
          </Field>

          <Field label="Pass per vecka" htmlFor="weekly_sessions" optional>
            <Input
              id="weekly_sessions"
              inputMode="numeric"
              value={weeklySessions}
              onChange={(e) => setWeeklySessions(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
          <Field label="Nästa mål" htmlFor="goal" optional>
            <Input
              id="goal"
              value={goal}
              placeholder="Vätternrundan under 9 timmar"
              onChange={(e) => setGoal(e.target.value)}
            />
          </Field>
          <Field label="Datum" htmlFor="goal_date" optional>
            <Input
              id="goal_date"
              type="date"
              value={goalDate}
              onChange={(e) => setGoalDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tävlingsfart i simning, Ironman"
            htmlFor="swim_im_pace"
            hint={raceHint("@IM", swimFromTest?.im ?? null)}
            optional
          >
            <Input
              id="swim_im_pace"
              inputMode="numeric"
              placeholder={
                swimFromTest?.im ? swimPaceText(swimFromTest.im) : "1:52"
              }
              value={swimIm}
              onChange={(e) => setSwimIm(e.target.value)}
            />
          </Field>
          <Field
            label="Tävlingsfart i simning, 70.3"
            htmlFor="swim_703_pace"
            hint={raceHint("@703", swimFromTest?.half ?? null)}
            optional
          >
            <Input
              id="swim_703_pace"
              inputMode="numeric"
              placeholder={
                swimFromTest?.half ? swimPaceText(swimFromTest.half) : "1:48"
              }
              value={swimHalf}
              onChange={(e) => setSwimHalf(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Skador och begränsningar"
            htmlFor="injuries"
            hint="går med till passbyggaren"
            optional
          >
            <Textarea
              id="injuries"
              rows={3}
              value={injuries}
              onChange={(e) => setInjuries(e.target.value)}
            />
          </Field>

          <Field
            label="Medicinskt att ta hänsyn till"
            htmlFor="medical"
            optional
          >
            <Textarea
              id="medical"
              rows={3}
              value={medical}
              onChange={(e) => setMedical(e.target.value)}
            />
          </Field>

          <Field label="Styrkor" htmlFor="strengths" optional>
            <Textarea
              id="strengths"
              rows={3}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
            />
          </Field>

          <Field label="Att förbättra" htmlFor="weaknesses" optional>
            <Textarea
              id="weaknesses"
              rows={3}
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-text">{error}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Sparar …" : "Spara bakgrunden"}
        </Button>
        <span className="text-[0.8125rem] text-text-subtle">
          {saved
            ? "Sparat. Nästa pass byggs med den här bakgrunden."
            : "Följer med till passbyggaren och AI-coachen."}
        </span>
      </div>
    </Card>
  );
}
