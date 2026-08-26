/**
 * Handwritten mirror of `supabase/migrations`. Once the Supabase CLI is linked
 * this file can be replaced by `supabase gen types typescript --linked`.
 */

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
    Functions: { [_ in never]: never };
    Enums: {
      account_role: AccountRole;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
