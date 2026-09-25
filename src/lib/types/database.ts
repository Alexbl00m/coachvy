/**
 * Handwritten mirror of `supabase/migrations`. Once the Supabase CLI is linked
 * this file can be replaced by `supabase gen types typescript --linked`.
 */

import type { Sport } from "@/lib/calculators/lactate";
import type { TargetBasis, WorkoutBlock } from "@/lib/workouts/schema";

export type AccountRole = "coach" | "adept";

export type Profile = {
  id: string;
  role: AccountRole;
  full_name: string;
  email: string;
  accepted_terms_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Coach = {
  id: string;
  company_name: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * An adept is owned by a coach and exists whether or not the person has signed
 * up: `profile_id` stays null until an account is linked to the row.
 */
export type Adept = {
  id: string;
  coach_id: string | null;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  sport: string | null;
  goal: string | null;
  current_level: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
};

/** `coach_id === null` marks one of the built-in test types shared by everyone. */
export type TestType = {
  id: string;
  coach_id: string | null;
  label: string;
  default_unit: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TestResult = {
  id: string;
  adept_id: string;
  test_type_id: string;
  value: number;
  unit: string;
  tested_on: string;
  comment: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Referensrad för VLamax-prediktionen: en atlet där VLamax faktiskt mätts.
 * `coach_id === null` markerar den inbyggda datan som alla coacher tränar på.
 */
export type VlamaxSample = {
  id: string;
  coach_id: string | null;
  label: string;
  sex: "man" | "kvinna";
  weight_kg: number;
  body_fat_pct: number;
  height_cm: number | null;
  age: number | null;
  sprint_seconds: number;
  watt_avg: number;
  /** Sparas men används inte av modellen längre. */
  watt_peak: number | null;
  vlamax: number;
  created_at: string;
  updated_at: string;
};

/** Ett testtillfälle: protokoll, gren och datum. Rådatan ligger i test_efforts. */
export type TestSessionRow = {
  id: string;
  adept_id: string;
  protocol: string;
  sport: string;
  intensity_unit: string;
  performed_on: string;
  weight_kg: number | null;
  /** Bara för det metabola protokollet – VLamax räknas per fettfri massa. */
  body_fat_pct: number | null;
  sex: "man" | "kvinna" | null;
  zone_scheme: string | null;
  training_phase: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Ett steg eller en ansträngning. Vilka fält som är satta beror på protokollet. */
export type TestEffortRow = {
  id: string;
  session_id: string;
  ordinal: number;
  intensity: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  lactate: number | null;
  heart_rate: number | null;
  rpe: number | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

/** Ett framräknat värde ur ett testtillfälle: CP, LT2, FTP, CS ... */
export type TestMetricRow = {
  id: string;
  session_id: string;
  key: string;
  value: number;
  unit: string;
  method: string | null;
  is_primary: boolean;
  created_at: string;
};

/**
 * Ett enskilt pass.
 *
 * `blocks` är jsonb: passet läses och skrivs som en helhet och frågas aldrig
 * ut steg för steg, till skillnad från test_efforts. Se migrationen.
 */
export type WorkoutRow = {
  id: string;
  adept_id: string;
  title: string;
  sport: Sport;
  summary: string | null;
  rationale: string | null;
  basis: TargetBasis;
  reference: number;
  critical: number | null;
  reserve: number | null;
  blocks: WorkoutBlock[];
  prompt: string | null;
  scheduled_for: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Adeptens bakgrund. Egen tabell så att adepts förblir coachens register. */
export type AdeptProfileRow = {
  adept_id: string;
  birth_year: number | null;
  sex: "man" | "kvinna" | "annat" | null;
  height_cm: number | null;
  training_years: number | null;
  weekly_hours: number | null;
  weekly_sessions: number | null;
  injuries: string | null;
  medical: string | null;
  strengths: string | null;
  weaknesses: string | null;
  goal: string | null;
  goal_date: string | null;
  created_at: string;
  updated_at: string;
};

/** Den dagliga incheckningen: sessions-RPE och Hoopers fyra frågor. */
export type AdeptCheckinRow = {
  id: string;
  adept_id: string;
  performed_on: string;
  session_rpe: number | null;
  duration_minutes: number | null;
  sleep: number | null;
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
  workout_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** Ett meddelande i tråden mellan coach och adept. */
export type CoachMessageRow = {
  id: string;
  adept_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  workout_id: string | null;
  session_id: string | null;
  created_at: string;
};

export type AiConversationRow = {
  id: string;
  adept_id: string;
  created_by: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type AiMessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type LeadStatus = "ny" | "kontaktad" | "avslutad";

/** Contact request from the public site. */
export type Lead = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  message: string;
  source: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
};

type Timestamps = "created_at" | "updated_at";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, Timestamps | "accepted_terms_at"> &
          Partial<Pick<Profile, Timestamps | "accepted_terms_at">>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      coaches: {
        Row: Coach;
        Insert: Pick<Coach, "id"> & Partial<Coach>;
        Update: Partial<Coach>;
        Relationships: [];
      };
      adepts: {
        Row: Adept;
        Insert: Pick<Adept, "full_name"> & Partial<Adept>;
        Update: Partial<Adept>;
        Relationships: [];
      };
      test_types: {
        Row: TestType;
        Insert: Pick<TestType, "label" | "default_unit"> & Partial<TestType>;
        Update: Partial<TestType>;
        Relationships: [];
      };
      leads: {
        Row: Lead;
        Insert: Pick<Lead, "first_name" | "email" | "message"> & Partial<Lead>;
        Update: Partial<Lead>;
        Relationships: [];
      };
      vlamax_samples: {
        Row: VlamaxSample;
        Insert: Omit<VlamaxSample, "id" | Timestamps> &
          Partial<Pick<VlamaxSample, "id">>;
        Update: Partial<VlamaxSample>;
        Relationships: [];
      };
      test_sessions: {
        Row: TestSessionRow;
        Insert: Pick<
          TestSessionRow,
          "adept_id" | "protocol" | "sport" | "intensity_unit"
        > &
          Partial<TestSessionRow>;
        Update: Partial<TestSessionRow>;
        Relationships: [];
      };
      test_efforts: {
        Row: TestEffortRow;
        Insert: Pick<TestEffortRow, "session_id" | "ordinal"> &
          Partial<TestEffortRow>;
        Update: Partial<TestEffortRow>;
        Relationships: [];
      };
      test_metrics: {
        Row: TestMetricRow;
        Insert: Pick<TestMetricRow, "session_id" | "key" | "value" | "unit"> &
          Partial<TestMetricRow>;
        Update: Partial<TestMetricRow>;
        Relationships: [];
      };
      workouts: {
        Row: WorkoutRow;
        Insert: Pick<
          WorkoutRow,
          "adept_id" | "title" | "sport" | "basis" | "reference" | "blocks"
        > &
          Partial<WorkoutRow>;
        Update: Partial<WorkoutRow>;
        Relationships: [];
      };
      adept_profiles: {
        Row: AdeptProfileRow;
        Insert: Pick<AdeptProfileRow, "adept_id"> & Partial<AdeptProfileRow>;
        Update: Partial<AdeptProfileRow>;
        Relationships: [];
      };
      adept_checkins: {
        Row: AdeptCheckinRow;
        Insert: Pick<AdeptCheckinRow, "adept_id"> & Partial<AdeptCheckinRow>;
        Update: Partial<AdeptCheckinRow>;
        Relationships: [];
      };
      coach_messages: {
        Row: CoachMessageRow;
        Insert: Pick<CoachMessageRow, "adept_id" | "sender_id" | "body"> &
          Partial<CoachMessageRow>;
        Update: Partial<CoachMessageRow>;
        Relationships: [];
      };
      ai_conversations: {
        Row: AiConversationRow;
        Insert: Pick<AiConversationRow, "adept_id" | "created_by"> &
          Partial<AiConversationRow>;
        Update: Partial<AiConversationRow>;
        Relationships: [];
      };
      ai_messages: {
        Row: AiMessageRow;
        Insert: Pick<AiMessageRow, "conversation_id" | "role" | "content"> &
          Partial<AiMessageRow>;
        Update: Partial<AiMessageRow>;
        Relationships: [];
      };
      test_results: {
        Row: TestResult;
        Insert: Pick<
          TestResult,
          "adept_id" | "test_type_id" | "value" | "unit"
        > &
          Partial<TestResult>;
        Update: Partial<TestResult>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      mark_messages_read: {
        Args: { adept: string };
        Returns: number;
      };
    };
    Enums: {
      account_role: AccountRole;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
