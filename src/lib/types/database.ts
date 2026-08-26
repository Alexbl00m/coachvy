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

export type Adept = {
  id: string;
  coach_id: string | null;
  sport: string | null;
  goal: string | null;
  current_level: string | null;
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
        Insert: Pick<Adept, "id"> & Partial<Adept>;
        Update: Partial<Adept>;
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
