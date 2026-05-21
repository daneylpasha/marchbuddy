// ============================================================================
// MarchBuddy V2 — Personal Record + comparison types (client-side)
//
// Keep these in lockstep with supabase/functions/_shared/pr-detection.ts and
// the personal_records table. The Edge Function is the source of truth; this
// file mirrors its shape for typed consumption in React Native components.
// ============================================================================

export type PrType =
  | 'fastest_pace'
  | 'fastest_1k_split'
  | 'longest_distance'
  | 'longest_duration'
  | 'first_milestone'
  | 'highest_cadence'; // reserved, surfaced in V2.1

export type FirstMilestoneSubtype =
  | 'first_1k'
  | 'first_3k'
  | 'first_5k'
  | 'first_30min_no_walk';

export type PrConfidence = 'high' | 'low';

export interface PersonalRecord {
  id: string;
  pr_type: PrType;
  pr_subtype: string | null; // FirstMilestoneSubtype | null in practice
  value: number;
  previous_value: number | null;
  session_id: string;
  achieved_at: string; // ISO timestamp
  confidence: PrConfidence;
  metadata: Record<string, unknown>;
}

export type ComparisonWindow =
  | 'vs_4_weeks_ago_same_distance'
  | 'vs_first_at_level'
  | 'vs_last_week_same_type'
  | 'vs_prior_30_day_avg';

export interface Comparison {
  window: ComparisonWindow;
  improvement_pct: number;
  before_value: number;
  after_value: number;
  label: string;
  unit: 'pace_sec_per_km' | 'duration_sec' | 'distance_m';
}

export interface DetectPrResponse {
  prs: PersonalRecord[];
  comparison: Comparison | null;
}

// ─── UI display helpers ──────────────────────────────────────────────────

/** Human-readable label per pr_type for banners. */
export function prTypeLabel(type: PrType, subtype?: string | null): string {
  switch (type) {
    case 'fastest_pace':
      return 'Fastest pace';
    case 'fastest_1k_split':
      return 'Fastest 1K split';
    case 'longest_distance':
      return 'Longest distance';
    case 'longest_duration':
      return 'Longest session';
    case 'first_milestone':
      switch (subtype) {
        case 'first_1k':
          return 'First 1K';
        case 'first_3k':
          return 'First 3K';
        case 'first_5k':
          return 'First 5K';
        case 'first_30min_no_walk':
          return 'First 30-min nonstop session';
        default:
          return 'First milestone';
      }
    case 'highest_cadence':
      return 'Highest cadence';
  }
}

/** Format the raw `value` per pr_type into a display string. */
export function formatPrValue(pr: PersonalRecord): string {
  switch (pr.pr_type) {
    case 'fastest_pace':
    case 'fastest_1k_split':
      return formatPace(pr.value);
    case 'longest_distance':
      return `${(pr.value / 1000).toFixed(2)} km`;
    case 'longest_duration': {
      const min = Math.floor(pr.value / 60);
      const sec = Math.round(pr.value % 60);
      return sec > 0 ? `${min}m ${sec}s` : `${min} min`;
    }
    case 'first_milestone':
      return ''; // banner uses pr_subtype label instead
    case 'highest_cadence':
      return `${Math.round(pr.value)} spm`;
  }
}

function formatPace(secPerKm: number): string {
  const totalSec = Math.round(secPerKm);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}/km`;
}

/** "Beat your previous X" framing for the banner subtitle. */
export function previousValueLabel(pr: PersonalRecord): string | null {
  if (pr.previous_value === null) return null;
  switch (pr.pr_type) {
    case 'fastest_pace':
    case 'fastest_1k_split':
      return `Previous: ${formatPace(pr.previous_value)}`;
    case 'longest_distance':
      return `Previous: ${(pr.previous_value / 1000).toFixed(2)} km`;
    case 'longest_duration': {
      const min = Math.floor(pr.previous_value / 60);
      return `Previous: ${min} min`;
    }
    default:
      return null;
  }
}
