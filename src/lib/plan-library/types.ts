/**
 * Planbibliotekets begrepp, frikopplade från databasraderna så att logiken
 * kan testas utan Supabase. `queries.ts` översätter raderna hit.
 */

import type { TargetBasis, WorkoutBlock } from "@/lib/workouts/schema";

export type SeasonPhase = "grund" | "uppbyggnad" | "specifik" | "topp" | "vila";

export type Level = {
  id: string;
  /** Högre är mer: A har högst rank. */
  rank: number;
  key: string;
  name: string;
};

export type Phase = {
  id: string;
  position: number;
  name: string;
  /** Så kort fasen får bli när planen kortas. */
  minWeeks: number;
  /** Ordningen faserna kortas i, lägst först. Null: kortas aldrig. */
  trimOrder: number | null;
  seasonPhase: SeasonPhase | null;
};

export type WeekKind = "normal" | "avlastning" | "test" | "tävling";

export type TemplateWeek = {
  id: string;
  phaseId: string;
  /** Ordningen i en plan av maxlängd. */
  position: number;
  kind: WeekKind;
  /** Avstämning: formuppskattningen ses över i slutet av veckan. */
  checkpoint?: boolean;
};

export type VolumeUnit = "km" | "h";

/** Veckans volym på en nivå: ett tal, eller ett spann. */
export type WeekVolume = {
  weekId: string;
  levelId: string;
  min: number;
  max: number | null;
};

export type Variant = {
  levelId: string;
  description: string | null;
  durationS: number | null;
  distanceM: number | null;
  zone: string | null;
  basis: TargetBasis | null;
  blocks: WorkoutBlock[] | null;
};

export type TemplateSession = {
  id: string;
  weekId: string;
  /** 0 är veckans första dag. Null: valfri dag. */
  day: number | null;
  position: number;
  discipline: string;
  type: string | null;
  title: string;
  description: string | null;
  variants: Variant[];
};

export type ChangeKind =
  | "byte"
  | "stegvis"
  | "tillfällig"
  | "återgång"
  | "återstart";

export type ChangeReason =
  | "eget val"
  | "form"
  | "resa"
  | "sjukdom"
  | "skada"
  | "arbete"
  | "familj"
  | "uppehåll"
  | "återstart";

export type ChangeSource = "medlem" | "coach" | "ai";

/** Ett nivåbyte, som det står i historiken. */
export type LevelChange = {
  id?: string;
  effectiveWeek: number;
  fromLevelId: string;
  toLevelId: string;
  kind: ChangeKind;
  reason: ChangeReason;
  source: ChangeSource;
  groupId?: string | null;
  note?: string | null;
  createdAt?: string;
  revokedAt?: string | null;
};

/** Ett planerat byte innan det sparats: utan id, källa och orsak. */
export type PlannedChange = Pick<
  LevelChange,
  "effectiveWeek" | "fromLevelId" | "toLevelId" | "kind"
>;

export type OverrideAction = "flytta" | "ersätt" | "stryk";

export type Override = {
  sessionId: string;
  planWeek: number;
  action: OverrideAction;
  movedTo: string | null;
  workoutId: string | null;
  note?: string | null;
};

export type LogStatus = "genomförd" | "delvis" | "hoppad";

export type SessionLog = {
  sessionId: string;
  planWeek: number;
  status: LogStatus;
  activityId?: string | null;
  rpe?: number | null;
  note?: string | null;
};
