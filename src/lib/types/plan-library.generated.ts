/**
 * GENERERAD – ändra inte för hand. Kör `npm run db:types` efter en migration.
 *
 * Typerna för planbibliotekets tabeller och funktioner, lästa ur databasen
 * (scripts/generate-plan-types.mjs).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PlanLibraryTables = {
  plan_library_settings: {
    Row: {
      id: boolean;
      max_active_plans: number;
      updated_at: string;
    };
    Insert: {
      id?: boolean;
      max_active_plans?: number;
      updated_at?: string;
    };
    Update: {
      id?: boolean;
      max_active_plans?: number;
      updated_at?: string;
    };
    Relationships: [];
  };
  plan_categories: {
    Row: {
      id: string;
      key: string;
      name: string;
      sort: number;
      created_at: string;
    };
    Insert: {
      id?: string;
      key: string;
      name: string;
      sort?: number;
      created_at?: string;
    };
    Update: {
      id?: string;
      key?: string;
      name?: string;
      sort?: number;
      created_at?: string;
    };
    Relationships: [];
  };
  disciplines: {
    Row: {
      key: string;
      name: string;
      structure_sport: "cykling" | "löpning" | "simning" | null;
      sort: number;
    };
    Insert: {
      key: string;
      name: string;
      structure_sport?: "cykling" | "löpning" | "simning" | null;
      sort?: number;
    };
    Update: {
      key?: string;
      name?: string;
      structure_sport?: "cykling" | "löpning" | "simning" | null;
      sort?: number;
    };
    Relationships: [];
  };
  plan_templates: {
    Row: {
      id: string;
      slug: string;
      category_id: string | null;
      is_example: boolean;
      archived_at: string | null;
      created_by: string | null;
      created_at: string;
      updated_at: string;
      race_distance_m: number | null;
    };
    Insert: {
      id?: string;
      slug: string;
      category_id?: string | null;
      is_example?: boolean;
      archived_at?: string | null;
      created_by?: string | null;
      created_at?: string;
      updated_at?: string;
      race_distance_m?: number | null;
    };
    Update: {
      id?: string;
      slug?: string;
      category_id?: string | null;
      is_example?: boolean;
      archived_at?: string | null;
      created_by?: string | null;
      created_at?: string;
      updated_at?: string;
      race_distance_m?: number | null;
    };
    Relationships: [];
  };
  plan_template_versions: {
    Row: {
      id: string;
      template_id: string;
      version: number;
      status: "utkast" | "publicerad" | "arkiverad";
      title: string;
      summary: string | null;
      goal: string | null;
      description: string | null;
      prerequisites: string | null;
      min_weeks: number;
      max_weeks: number;
      published_at: string | null;
      published_by: string | null;
      created_by: string | null;
      created_at: string;
      updated_at: string;
      volume_unit: "km" | "h";
    };
    Insert: {
      id?: string;
      template_id: string;
      version: number;
      status?: "utkast" | "publicerad" | "arkiverad";
      title: string;
      summary?: string | null;
      goal?: string | null;
      description?: string | null;
      prerequisites?: string | null;
      min_weeks: number;
      max_weeks: number;
      published_at?: string | null;
      published_by?: string | null;
      created_by?: string | null;
      created_at?: string;
      updated_at?: string;
      volume_unit?: "km" | "h";
    };
    Update: {
      id?: string;
      template_id?: string;
      version?: number;
      status?: "utkast" | "publicerad" | "arkiverad";
      title?: string;
      summary?: string | null;
      goal?: string | null;
      description?: string | null;
      prerequisites?: string | null;
      min_weeks?: number;
      max_weeks?: number;
      published_at?: string | null;
      published_by?: string | null;
      created_by?: string | null;
      created_at?: string;
      updated_at?: string;
      volume_unit?: "km" | "h";
    };
    Relationships: [];
  };
  plan_template_levels: {
    Row: {
      id: string;
      version_id: string;
      rank: number;
      key: string;
      name: string;
      description: string | null;
      hours_min: number | null;
      hours_max: number | null;
      sessions_min: number | null;
      sessions_max: number | null;
      intensity: Json | null;
    };
    Insert: {
      id?: string;
      version_id: string;
      rank: number;
      key: string;
      name: string;
      description?: string | null;
      hours_min?: number | null;
      hours_max?: number | null;
      sessions_min?: number | null;
      sessions_max?: number | null;
      intensity?: Json | null;
    };
    Update: {
      id?: string;
      version_id?: string;
      rank?: number;
      key?: string;
      name?: string;
      description?: string | null;
      hours_min?: number | null;
      hours_max?: number | null;
      sessions_min?: number | null;
      sessions_max?: number | null;
      intensity?: Json | null;
    };
    Relationships: [];
  };
  plan_template_phases: {
    Row: {
      id: string;
      version_id: string;
      position: number;
      name: string;
      season_phase:
        | "grund"
        | "uppbyggnad"
        | "specifik"
        | "topp"
        | "vila"
        | null;
      purpose: string | null;
      focus: string | null;
      specificity: number | null;
      intensity: Json | null;
      min_weeks: number;
      trim_order: number | null;
    };
    Insert: {
      id?: string;
      version_id: string;
      position: number;
      name: string;
      season_phase?:
        | "grund"
        | "uppbyggnad"
        | "specifik"
        | "topp"
        | "vila"
        | null;
      purpose?: string | null;
      focus?: string | null;
      specificity?: number | null;
      intensity?: Json | null;
      min_weeks?: number;
      trim_order?: number | null;
    };
    Update: {
      id?: string;
      version_id?: string;
      position?: number;
      name?: string;
      season_phase?:
        | "grund"
        | "uppbyggnad"
        | "specifik"
        | "topp"
        | "vila"
        | null;
      purpose?: string | null;
      focus?: string | null;
      specificity?: number | null;
      intensity?: Json | null;
      min_weeks?: number;
      trim_order?: number | null;
    };
    Relationships: [];
  };
  plan_template_weeks: {
    Row: {
      id: string;
      version_id: string;
      phase_id: string;
      position: number;
      kind: "normal" | "avlastning" | "test" | "tävling";
      title: string | null;
      note: string | null;
      checkpoint: boolean;
    };
    Insert: {
      id?: string;
      version_id: string;
      phase_id: string;
      position: number;
      kind?: "normal" | "avlastning" | "test" | "tävling";
      title?: string | null;
      note?: string | null;
      checkpoint?: boolean;
    };
    Update: {
      id?: string;
      version_id?: string;
      phase_id?: string;
      position?: number;
      kind?: "normal" | "avlastning" | "test" | "tävling";
      title?: string | null;
      note?: string | null;
      checkpoint?: boolean;
    };
    Relationships: [];
  };
  plan_template_sessions: {
    Row: {
      id: string;
      version_id: string;
      week_id: string;
      day: number | null;
      position: number;
      discipline: string;
      type: string | null;
      title: string;
      description: string | null;
    };
    Insert: {
      id?: string;
      version_id: string;
      week_id: string;
      day?: number | null;
      position?: number;
      discipline: string;
      type?: string | null;
      title: string;
      description?: string | null;
    };
    Update: {
      id?: string;
      version_id?: string;
      week_id?: string;
      day?: number | null;
      position?: number;
      discipline?: string;
      type?: string | null;
      title?: string;
      description?: string | null;
    };
    Relationships: [];
  };
  plan_template_session_variants: {
    Row: {
      id: string;
      version_id: string;
      session_id: string;
      level_id: string;
      description: string | null;
      duration_s: number | null;
      distance_m: number | null;
      zone: string | null;
      basis:
        | "FTP"
        | "CP"
        | "CS"
        | "CSS"
        | "LT2"
        | "5K"
        | "10K"
        | "HM"
        | "MP"
        | null;
      blocks: Json | null;
    };
    Insert: {
      id?: string;
      version_id: string;
      session_id: string;
      level_id: string;
      description?: string | null;
      duration_s?: number | null;
      distance_m?: number | null;
      zone?: string | null;
      basis?:
        | "FTP"
        | "CP"
        | "CS"
        | "CSS"
        | "LT2"
        | "5K"
        | "10K"
        | "HM"
        | "MP"
        | null;
      blocks?: Json | null;
    };
    Update: {
      id?: string;
      version_id?: string;
      session_id?: string;
      level_id?: string;
      description?: string | null;
      duration_s?: number | null;
      distance_m?: number | null;
      zone?: string | null;
      basis?:
        | "FTP"
        | "CP"
        | "CS"
        | "CSS"
        | "LT2"
        | "5K"
        | "10K"
        | "HM"
        | "MP"
        | null;
      blocks?: Json | null;
    };
    Relationships: [];
  };
  plan_template_week_volumes: {
    Row: {
      id: string;
      version_id: string;
      week_id: string;
      level_id: string;
      volume_min: number;
      volume_max: number | null;
    };
    Insert: {
      id?: string;
      version_id: string;
      week_id: string;
      level_id: string;
      volume_min: number;
      volume_max?: number | null;
    };
    Update: {
      id?: string;
      version_id?: string;
      week_id?: string;
      level_id?: string;
      volume_min?: number;
      volume_max?: number | null;
    };
    Relationships: [];
  };
  plan_instances: {
    Row: {
      id: string;
      adept_id: string;
      template_id: string;
      version_id: string;
      title: string;
      status: "aktiv" | "avslutad" | "avbruten";
      start_date: string;
      weeks: number;
      goal_mode: "lopp" | "fritt";
      race_id: string | null;
      race_date: string | null;
      start_level_id: string;
      week_map: Json;
      created_by: string | null;
      created_at: string;
      updated_at: string;
      ended_at: string | null;
      rounds: Json | null;
      pace_mode: "form" | "mål";
      goal_seconds: number | null;
    };
    Insert: {
      id?: string;
      adept_id: string;
      template_id: string;
      version_id: string;
      title: string;
      status?: "aktiv" | "avslutad" | "avbruten";
      start_date: string;
      weeks: number;
      goal_mode: "lopp" | "fritt";
      race_id?: string | null;
      race_date?: string | null;
      start_level_id: string;
      week_map: Json;
      created_by?: string | null;
      created_at?: string;
      updated_at?: string;
      ended_at?: string | null;
      rounds?: Json | null;
      pace_mode?: "form" | "mål";
      goal_seconds?: number | null;
    };
    Update: {
      id?: string;
      adept_id?: string;
      template_id?: string;
      version_id?: string;
      title?: string;
      status?: "aktiv" | "avslutad" | "avbruten";
      start_date?: string;
      weeks?: number;
      goal_mode?: "lopp" | "fritt";
      race_id?: string | null;
      race_date?: string | null;
      start_level_id?: string;
      week_map?: Json;
      created_by?: string | null;
      created_at?: string;
      updated_at?: string;
      ended_at?: string | null;
      rounds?: Json | null;
      pace_mode?: "form" | "mål";
      goal_seconds?: number | null;
    };
    Relationships: [];
  };
  plan_level_changes: {
    Row: {
      id: string;
      instance_id: string;
      adept_id: string;
      effective_week: number;
      from_level_id: string;
      to_level_id: string;
      reason:
        | "eget val"
        | "form"
        | "resa"
        | "sjukdom"
        | "skada"
        | "arbete"
        | "familj"
        | "uppehåll"
        | "återstart";
      kind: "byte" | "stegvis" | "tillfällig" | "återgång" | "återstart";
      source: "medlem" | "coach" | "ai";
      note: string | null;
      group_id: string | null;
      created_by: string | null;
      created_at: string;
      revoked_at: string | null;
      revoked_by: string | null;
    };
    Insert: {
      id?: string;
      instance_id: string;
      adept_id: string;
      effective_week: number;
      from_level_id: string;
      to_level_id: string;
      reason:
        | "eget val"
        | "form"
        | "resa"
        | "sjukdom"
        | "skada"
        | "arbete"
        | "familj"
        | "uppehåll"
        | "återstart";
      kind?: "byte" | "stegvis" | "tillfällig" | "återgång" | "återstart";
      source: "medlem" | "coach" | "ai";
      note?: string | null;
      group_id?: string | null;
      created_by?: string | null;
      created_at?: string;
      revoked_at?: string | null;
      revoked_by?: string | null;
    };
    Update: {
      id?: string;
      instance_id?: string;
      adept_id?: string;
      effective_week?: number;
      from_level_id?: string;
      to_level_id?: string;
      reason?:
        | "eget val"
        | "form"
        | "resa"
        | "sjukdom"
        | "skada"
        | "arbete"
        | "familj"
        | "uppehåll"
        | "återstart";
      kind?: "byte" | "stegvis" | "tillfällig" | "återgång" | "återstart";
      source?: "medlem" | "coach" | "ai";
      note?: string | null;
      group_id?: string | null;
      created_by?: string | null;
      created_at?: string;
      revoked_at?: string | null;
      revoked_by?: string | null;
    };
    Relationships: [];
  };
  plan_session_overrides: {
    Row: {
      id: string;
      instance_id: string;
      adept_id: string;
      session_id: string;
      plan_week: number;
      action: "flytta" | "ersätt" | "stryk";
      moved_to: string | null;
      workout_id: string | null;
      note: string | null;
      created_by: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      instance_id: string;
      adept_id: string;
      session_id: string;
      plan_week: number;
      action: "flytta" | "ersätt" | "stryk";
      moved_to?: string | null;
      workout_id?: string | null;
      note?: string | null;
      created_by?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      instance_id?: string;
      adept_id?: string;
      session_id?: string;
      plan_week?: number;
      action?: "flytta" | "ersätt" | "stryk";
      moved_to?: string | null;
      workout_id?: string | null;
      note?: string | null;
      created_by?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  plan_session_logs: {
    Row: {
      id: string;
      instance_id: string;
      adept_id: string;
      session_id: string;
      plan_week: number;
      status: "genomförd" | "delvis" | "hoppad";
      activity_id: string | null;
      rpe: number | null;
      note: string | null;
      logged_by: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      instance_id: string;
      adept_id: string;
      session_id: string;
      plan_week: number;
      status: "genomförd" | "delvis" | "hoppad";
      activity_id?: string | null;
      rpe?: number | null;
      note?: string | null;
      logged_by?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      instance_id?: string;
      adept_id?: string;
      session_id?: string;
      plan_week?: number;
      status?: "genomförd" | "delvis" | "hoppad";
      activity_id?: string | null;
      rpe?: number | null;
      note?: string | null;
      logged_by?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  plan_ai_suggestions: {
    Row: {
      id: string;
      instance_id: string;
      adept_id: string;
      kind: "nivåbyte" | "återstart" | "övrigt";
      payload: Json;
      rationale: string;
      status: "föreslagen" | "accepterad" | "avvisad" | "utgången";
      level_change_group: string | null;
      created_by: string | null;
      created_at: string;
      decided_at: string | null;
      decided_by: string | null;
    };
    Insert: {
      id?: string;
      instance_id: string;
      adept_id: string;
      kind: "nivåbyte" | "återstart" | "övrigt";
      payload?: Json;
      rationale: string;
      status?: "föreslagen" | "accepterad" | "avvisad" | "utgången";
      level_change_group?: string | null;
      created_by?: string | null;
      created_at?: string;
      decided_at?: string | null;
      decided_by?: string | null;
    };
    Update: {
      id?: string;
      instance_id?: string;
      adept_id?: string;
      kind?: "nivåbyte" | "återstart" | "övrigt";
      payload?: Json;
      rationale?: string;
      status?: "föreslagen" | "accepterad" | "avvisad" | "utgången";
      level_change_group?: string | null;
      created_by?: string | null;
      created_at?: string;
      decided_at?: string | null;
      decided_by?: string | null;
    };
    Relationships: [];
  };
  plan_instance_events: {
    Row: {
      id: string;
      instance_id: string;
      adept_id: string;
      kind:
        | "startad"
        | "pausad"
        | "återupptagen"
        | "flyttad"
        | "avslutad"
        | "avbruten";
      detail: Json | null;
      created_by: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      instance_id: string;
      adept_id: string;
      kind:
        | "startad"
        | "pausad"
        | "återupptagen"
        | "flyttad"
        | "avslutad"
        | "avbruten";
      detail?: Json | null;
      created_by?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      instance_id?: string;
      adept_id?: string;
      kind?:
        | "startad"
        | "pausad"
        | "återupptagen"
        | "flyttad"
        | "avslutad"
        | "avbruten";
      detail?: Json | null;
      created_by?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  fitness_estimates: {
    Row: {
      id: string;
      adept_id: string;
      sport: string;
      five_k_seconds: number | null;
      marathon_seconds: number | null;
      note: string | null;
      created_by: string | null;
      created_at: string;
      ten_k_seconds: number | null;
      half_seconds: number | null;
    };
    Insert: {
      id?: string;
      adept_id: string;
      sport?: string;
      five_k_seconds?: number | null;
      marathon_seconds?: number | null;
      note?: string | null;
      created_by?: string | null;
      created_at?: string;
      ten_k_seconds?: number | null;
      half_seconds?: number | null;
    };
    Update: {
      id?: string;
      adept_id?: string;
      sport?: string;
      five_k_seconds?: number | null;
      marathon_seconds?: number | null;
      note?: string | null;
      created_by?: string | null;
      created_at?: string;
      ten_k_seconds?: number | null;
      half_seconds?: number | null;
    };
    Relationships: [];
  };
};

export type PlanLibraryFunctions = {
  publish_plan_version: {
    Args: { draft: string };
    Returns: string;
  };
  new_plan_draft: {
    Args: { template: string };
    Returns: string;
  };
  reorder_plan_weeks: {
    Args: { draft: string };
    Returns: number;
  };
  copy_plan_week: {
    Args: { week: string };
    Returns: string;
  };
  can_read_plan_library: {
    Args: Record<string, never>;
    Returns: boolean;
  };
  can_read_plan_version: {
    Args: { plan_version: string };
    Returns: boolean;
  };
  can_edit_plan: {
    Args: { adept: string };
    Returns: boolean;
  };
  plan_week_of: {
    Args: { instance: string; day: string };
    Returns: number;
  };
};
