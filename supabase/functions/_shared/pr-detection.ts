// ============================================================================
// MarchBuddy V2 — Personal Record detection engine + comparison windows
//
// One shared module so the live detect-personal-records Edge Function and
// the bulk backfill script use IDENTICAL logic. Any rule change here flows
// to both — no drift, no replay surprises.
//
// PM constraints (from spec §6 anti-gaming + clarified rules):
//   - Min session duration: 5 minutes
//   - Min distance for pace-based PRs: 500m
//   - GPS accuracy >50m → confidence='low' (still recorded)
//   - Manual treadmill entries: confidence='low' visually different
//   - Pace calc assumes pace_per_km already excludes pause time (verified
//     in active-session code path; pause exclusion happens client-side)
//   - Window 4 comparison: min 3 sessions in both windows, same environment
//   - All comparisons require ≥5% relative improvement to be shown
// ============================================================================

// ─── Types ────────────────────────────────────────────────────────────────

export type PrType =
  | 'fastest_pace'
  | 'fastest_1k_split'
  | 'longest_distance'
  | 'longest_duration'
  | 'first_milestone';
// 'highest_cadence' is reserved in DB enum but not detected in V2.

export type PrConfidence = 'high' | 'low';

export type FirstMilestoneSubtype =
  | 'first_1k'
  | 'first_3k'
  | 'first_5k'
  | 'first_30min_no_walk';

export interface SessionRecord {
  id: string;
  user_id: string;
  plan_level: number;
  plan_title: string;
  planned_segments: unknown[]; // array of segments; length used for walk-break detection
  completed_segments: number;
  actual_duration_minutes: number;
  actual_distance_km: number;
  pace_per_km: number | null; // seconds per km (assumed pause-excluded)
  ended_early: boolean;
  environment: 'indoor' | 'outdoor';
  treadmill_stats: { distanceKm?: number; steps?: number; calories?: number } | null;
  route_data: GpsPoint[] | unknown[];
  started_at: string;
  completed_at: string;
}

export interface GpsPoint {
  latitude: number;
  longitude: number;
  timestamp: number; // ms epoch
  accuracy?: number; // meters; if any point >50m we degrade confidence
}

export interface DetectedPr {
  pr_type: PrType;
  pr_subtype: string | null;
  value: number;
  previous_value: number | null;
  confidence: PrConfidence;
  metadata: Record<string, unknown>;
}

export interface Comparison {
  window:
    | 'vs_4_weeks_ago_same_distance'
    | 'vs_first_at_level'
    | 'vs_last_week_same_type'
    | 'vs_prior_30_day_avg';
  improvement_pct: number; // positive = improvement
  before_value: number;
  after_value: number;
  // Human-readable context the prompt + UI can use directly.
  label: string;
  unit: 'pace_sec_per_km' | 'duration_sec' | 'distance_m';
}

// ─── Constants ────────────────────────────────────────────────────────────

const MIN_SESSION_DURATION_MIN = 5;
const MIN_DISTANCE_FOR_PACE_M = 500;
const GPS_ACCURACY_THRESHOLD_M = 50;
const COMPARISON_MIN_IMPROVEMENT_PCT = 5;
const WINDOW_4_MIN_SESSIONS_EACH_SIDE = 3;
const WINDOW_1_DATE_TOLERANCE_DAYS = 3; // "~4 weeks ago" = 28 ± 3 days
const WINDOW_1_DISTANCE_BUCKET_M = 200; // same-distance match tolerance (e.g. 2.0–2.2km)

// ─── Eligibility (anti-gaming gate) ──────────────────────────────────────

export function isSessionEligibleForPrs(s: SessionRecord): {
  eligible: boolean;
  reason?: string;
} {
  if (s.actual_duration_minutes < MIN_SESSION_DURATION_MIN) {
    return { eligible: false, reason: 'session_too_short' };
  }
  return { eligible: true };
}

export function computeConfidence(s: SessionRecord): PrConfidence {
  // Manual treadmill entries: confidence='low' (user self-reported numbers).
  if (s.environment === 'indoor' && s.treadmill_stats) {
    return 'low';
  }
  // Outdoor GPS sessions: if any route point has accuracy worse than the
  // threshold, mark as low. Empty/missing route_data on an outdoor session
  // is also a yellow flag — treat as low.
  if (s.environment === 'outdoor') {
    if (!Array.isArray(s.route_data) || s.route_data.length === 0) {
      return 'low';
    }
    const points = s.route_data as GpsPoint[];
    const worstAccuracy = points.reduce(
      (acc, p) => (typeof p?.accuracy === 'number' ? Math.max(acc, p.accuracy) : acc),
      0,
    );
    if (worstAccuracy > GPS_ACCURACY_THRESHOLD_M) {
      return 'low';
    }
  }
  return 'high';
}

// ─── PR detection ────────────────────────────────────────────────────────

/**
 * Given the freshly-saved session and the user's prior session history,
 * return the set of PRs this session set. Caller is responsible for
 * persisting these to `personal_records`.
 *
 * History should NOT include the current session.
 */
export function detectPrs(
  current: SessionRecord,
  history: SessionRecord[],
): DetectedPr[] {
  const eligibility = isSessionEligibleForPrs(current);
  if (!eligibility.eligible) return [];

  const confidence = computeConfidence(current);
  const prs: DetectedPr[] = [];

  // Filter history to only eligible sessions for comparison.
  const eligibleHistory = history.filter((h) => isSessionEligibleForPrs(h).eligible);

  // ── 1. fastest_pace (lifetime overall pace) ─────────────────────────────
  if (
    current.pace_per_km !== null &&
    current.actual_distance_km * 1000 >= MIN_DISTANCE_FOR_PACE_M
  ) {
    const pacedHistory = eligibleHistory.filter(
      (h) =>
        h.pace_per_km !== null &&
        h.actual_distance_km * 1000 >= MIN_DISTANCE_FOR_PACE_M,
    );
    const bestPriorPace =
      pacedHistory.length > 0
        ? Math.min(...pacedHistory.map((h) => h.pace_per_km as number))
        : Number.POSITIVE_INFINITY;
    if (current.pace_per_km < bestPriorPace) {
      prs.push({
        pr_type: 'fastest_pace',
        pr_subtype: null,
        value: current.pace_per_km,
        previous_value: Number.isFinite(bestPriorPace) ? bestPriorPace : null,
        confidence,
        metadata: { distance_km: current.actual_distance_km },
      });
    }
  }

  // ── 2. fastest_1k_split ─────────────────────────────────────────────────
  const split = bestKmSplitFromRoute(current);
  if (split !== null && current.actual_distance_km * 1000 >= 1000) {
    // Compare against the best 1k split across all eligible history.
    const bestPriorSplit = eligibleHistory.reduce<number>((acc, h) => {
      const s = bestKmSplitFromRoute(h);
      return s !== null && s < acc ? s : acc;
    }, Number.POSITIVE_INFINITY);
    if (split < bestPriorSplit) {
      prs.push({
        pr_type: 'fastest_1k_split',
        pr_subtype: null,
        value: split,
        previous_value: Number.isFinite(bestPriorSplit) ? bestPriorSplit : null,
        confidence,
        metadata: { source: 'gps_route' },
      });
    }
  }

  // ── 3. longest_distance ─────────────────────────────────────────────────
  const currentDistanceM = current.actual_distance_km * 1000;
  if (currentDistanceM > 0) {
    const bestPriorDistance = eligibleHistory.reduce(
      (acc, h) => Math.max(acc, h.actual_distance_km * 1000),
      0,
    );
    if (currentDistanceM > bestPriorDistance) {
      prs.push({
        pr_type: 'longest_distance',
        pr_subtype: null,
        value: currentDistanceM,
        previous_value: bestPriorDistance > 0 ? bestPriorDistance : null,
        confidence,
        metadata: {},
      });
    }
  }

  // ── 4. longest_duration ─────────────────────────────────────────────────
  const currentDurationSec = current.actual_duration_minutes * 60;
  if (currentDurationSec > 0) {
    const bestPriorDuration = eligibleHistory.reduce(
      (acc, h) => Math.max(acc, h.actual_duration_minutes * 60),
      0,
    );
    if (currentDurationSec > bestPriorDuration) {
      prs.push({
        pr_type: 'longest_duration',
        pr_subtype: null,
        value: currentDurationSec,
        previous_value: bestPriorDuration > 0 ? bestPriorDuration : null,
        confidence,
        metadata: {},
      });
    }
  }

  // ── 5. first_milestone (binary firsts) ──────────────────────────────────
  // Spec calls out: first_1k, first_3k, first_5k, first_30min_no_walk.
  // Each fires AT MOST ONCE per user (idempotency guarded by the DB unique
  // constraint, which uses session_id — we additionally check history here
  // to avoid re-emitting for backfill replays).
  const subtypesAchieved = new Set<FirstMilestoneSubtype>();

  const priorDistanceCovered = (thresholdM: number): boolean =>
    eligibleHistory.some((h) => h.actual_distance_km * 1000 >= thresholdM);

  if (currentDistanceM >= 1000 && !priorDistanceCovered(1000)) {
    subtypesAchieved.add('first_1k');
  }
  if (currentDistanceM >= 3000 && !priorDistanceCovered(3000)) {
    subtypesAchieved.add('first_3k');
  }
  if (currentDistanceM >= 5000 && !priorDistanceCovered(5000)) {
    subtypesAchieved.add('first_5k');
  }

  // first_30min_no_walk: session ≥30 min, all planned segments completed,
  // not ended early. "No walking break" is inferred from completed_segments
  // matching the planned segment count (we don't track segment-by-segment
  // pace, so this is the closest signal available).
  const segmentsPlanned = Array.isArray(current.planned_segments)
    ? current.planned_segments.length
    : 0;
  const noWalkBreak =
    current.actual_duration_minutes >= 30 &&
    !current.ended_early &&
    segmentsPlanned > 0 &&
    current.completed_segments >= segmentsPlanned;
  const priorNoWalk = eligibleHistory.some((h) => {
    const hp = Array.isArray(h.planned_segments) ? h.planned_segments.length : 0;
    return (
      h.actual_duration_minutes >= 30 &&
      !h.ended_early &&
      hp > 0 &&
      h.completed_segments >= hp
    );
  });
  if (noWalkBreak && !priorNoWalk) {
    subtypesAchieved.add('first_30min_no_walk');
  }

  for (const sub of subtypesAchieved) {
    prs.push({
      pr_type: 'first_milestone',
      pr_subtype: sub,
      value: 0,
      previous_value: null,
      confidence,
      metadata: {},
    });
  }

  return prs;
}

// ─── 1k split from GPS route ──────────────────────────────────────────────
// Walks the GPS route accumulating distance; the moment we cross every
// 1km boundary, record the time elapsed since the previous boundary (or
// session start for the first km). Returns the FASTEST such 1km split in
// seconds. Returns null if the route is too short or unparseable.

export function bestKmSplitFromRoute(s: SessionRecord): number | null {
  if (!Array.isArray(s.route_data) || s.route_data.length < 2) return null;
  const points = s.route_data as GpsPoint[];
  const valid = points.filter(
    (p) =>
      typeof p?.latitude === 'number' &&
      typeof p?.longitude === 'number' &&
      typeof p?.timestamp === 'number',
  );
  if (valid.length < 2) return null;

  const TARGET_M = 1000;
  let cumulativeM = 0;
  let kmBoundaryM = TARGET_M;
  let lastBoundaryTimeMs = valid[0].timestamp;
  let bestKmSec: number | null = null;

  for (let i = 1; i < valid.length; i++) {
    const a = valid[i - 1];
    const b = valid[i];
    const stepM = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
    if (!Number.isFinite(stepM) || stepM <= 0) continue;
    cumulativeM += stepM;

    // Could cross multiple km boundaries in one step on a long GPS gap.
    while (cumulativeM >= kmBoundaryM) {
      // Linearly interpolate time at the boundary based on how far through
      // this step we crossed it.
      const overshoot = cumulativeM - kmBoundaryM;
      const fractionAtBoundary = stepM > 0 ? 1 - overshoot / stepM : 1;
      const stepDurationMs = b.timestamp - a.timestamp;
      const boundaryTimeMs = a.timestamp + stepDurationMs * fractionAtBoundary;
      const kmSec = (boundaryTimeMs - lastBoundaryTimeMs) / 1000;
      if (kmSec > 0 && (bestKmSec === null || kmSec < bestKmSec)) {
        bestKmSec = kmSec;
      }
      lastBoundaryTimeMs = boundaryTimeMs;
      kmBoundaryM += TARGET_M;
    }
  }

  return bestKmSec;
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Before/After comparison windows ─────────────────────────────────────

/**
 * Compute all 4 comparison windows for the current session against history,
 * apply data-sufficiency + improvement filters, and return the single most
 * impressive comparison (highest relative improvement). Returns null if
 * nothing meets the bar — never force a weak comparison.
 *
 * Spec rules (clarified):
 *   - Window 1: same-distance bucket session from ~4 weeks ago (±3 days)
 *   - Window 2: first session at this user's current level
 *   - Window 3: most recent prior session of same plan_title
 *   - Window 4: 30-day rolling avg pace vs prior 30-day avg pace,
 *               min 3 sessions both sides, same environment only
 *   - All windows: require ≥5% relative improvement
 *   - Regression silent: never return a negative-improvement comparison
 */
export function bestComparison(
  current: SessionRecord,
  history: SessionRecord[],
  firstSessionAtCurrentLevel?: SessionRecord | null,
): Comparison | null {
  const eligibleHistory = history.filter((h) => isSessionEligibleForPrs(h).eligible);
  const candidates: Comparison[] = [];

  const currentPace = current.pace_per_km;
  const currentDate = new Date(current.completed_at).getTime();

  // ── Window 1: vs ~4 weeks ago, same distance bucket ────────────────────
  if (currentPace !== null) {
    const fourWeeksMs = 28 * 24 * 60 * 60 * 1000;
    const toleranceMs = WINDOW_1_DATE_TOLERANCE_DAYS * 24 * 60 * 60 * 1000;
    const distanceBucket = current.actual_distance_km * 1000;
    const candidate = eligibleHistory.find((h) => {
      const hDate = new Date(h.completed_at).getTime();
      const ageMs = currentDate - hDate;
      const distanceM = h.actual_distance_km * 1000;
      return (
        h.pace_per_km !== null &&
        h.environment === current.environment &&
        Math.abs(ageMs - fourWeeksMs) <= toleranceMs &&
        Math.abs(distanceM - distanceBucket) <= WINDOW_1_DISTANCE_BUCKET_M
      );
    });
    if (candidate && candidate.pace_per_km !== null) {
      const improvementPct = relImprovementLowerIsBetter(
        candidate.pace_per_km,
        currentPace,
      );
      if (improvementPct >= COMPARISON_MIN_IMPROVEMENT_PCT) {
        candidates.push({
          window: 'vs_4_weeks_ago_same_distance',
          improvement_pct: improvementPct,
          before_value: candidate.pace_per_km,
          after_value: currentPace,
          label: `4 weeks ago: ${formatPaceMinPerKm(candidate.pace_per_km)} pace · Today: ${formatPaceMinPerKm(currentPace)}`,
          unit: 'pace_sec_per_km',
        });
      }
    }
  }

  // ── Window 2: vs first session at current level ────────────────────────
  if (currentPace !== null && firstSessionAtCurrentLevel) {
    const first = firstSessionAtCurrentLevel;
    if (first.pace_per_km !== null && first.environment === current.environment) {
      const improvementPct = relImprovementLowerIsBetter(first.pace_per_km, currentPace);
      if (improvementPct >= COMPARISON_MIN_IMPROVEMENT_PCT) {
        candidates.push({
          window: 'vs_first_at_level',
          improvement_pct: improvementPct,
          before_value: first.pace_per_km,
          after_value: currentPace,
          label: `First session at Level ${current.plan_level}: ${formatPaceMinPerKm(first.pace_per_km)} · Today: ${formatPaceMinPerKm(currentPace)}`,
          unit: 'pace_sec_per_km',
        });
      }
    }
  }

  // ── Window 3: vs last week's same session type ─────────────────────────
  if (currentPace !== null) {
    const sameTypePast = eligibleHistory
      .filter(
        (h) =>
          h.plan_title === current.plan_title &&
          h.pace_per_km !== null &&
          h.environment === current.environment &&
          new Date(h.completed_at).getTime() < currentDate,
      )
      .sort(
        (a, b) =>
          new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
      )[0];
    if (sameTypePast && sameTypePast.pace_per_km !== null) {
      const improvementPct = relImprovementLowerIsBetter(
        sameTypePast.pace_per_km,
        currentPace,
      );
      if (improvementPct >= COMPARISON_MIN_IMPROVEMENT_PCT) {
        candidates.push({
          window: 'vs_last_week_same_type',
          improvement_pct: improvementPct,
          before_value: sameTypePast.pace_per_km,
          after_value: currentPace,
          label: `Last ${current.plan_title}: ${formatPaceMinPerKm(sameTypePast.pace_per_km)} · Today: ${formatPaceMinPerKm(currentPace)}`,
          unit: 'pace_sec_per_km',
        });
      }
    }
  }

  // ── Window 4: 30-day rolling avg vs prior 30-day avg ───────────────────
  // Requires ≥3 sessions in BOTH windows, same environment as current.
  {
    const dayMs = 24 * 60 * 60 * 1000;
    const recentStart = currentDate - 30 * dayMs;
    const priorStart = currentDate - 60 * dayMs;
    const sameEnvHistory = eligibleHistory.filter(
      (h) => h.environment === current.environment && h.pace_per_km !== null,
    );
    const recent = sameEnvHistory.filter((h) => {
      const t = new Date(h.completed_at).getTime();
      return t >= recentStart && t < currentDate;
    });
    const prior = sameEnvHistory.filter((h) => {
      const t = new Date(h.completed_at).getTime();
      return t >= priorStart && t < recentStart;
    });
    if (
      recent.length >= WINDOW_4_MIN_SESSIONS_EACH_SIDE &&
      prior.length >= WINDOW_4_MIN_SESSIONS_EACH_SIDE
    ) {
      const recentAvg = avg(recent.map((h) => h.pace_per_km as number));
      const priorAvg = avg(prior.map((h) => h.pace_per_km as number));
      const improvementPct = relImprovementLowerIsBetter(priorAvg, recentAvg);
      if (improvementPct >= COMPARISON_MIN_IMPROVEMENT_PCT) {
        candidates.push({
          window: 'vs_prior_30_day_avg',
          improvement_pct: improvementPct,
          before_value: priorAvg,
          after_value: recentAvg,
          label: `Avg pace this month: ${formatPaceMinPerKm(recentAvg)} · Prior month: ${formatPaceMinPerKm(priorAvg)}`,
          unit: 'pace_sec_per_km',
        });
      }
    }
  }

  if (candidates.length === 0) return null;
  // Pick highest relative improvement — "single most impressive" per spec.
  candidates.sort((a, b) => b.improvement_pct - a.improvement_pct);
  return candidates[0];
}

// ─── small helpers ────────────────────────────────────────────────────────

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((acc, v) => acc + v, 0) / xs.length;
}

function relImprovementLowerIsBetter(before: number, after: number): number {
  if (before <= 0) return 0;
  return ((before - after) / before) * 100;
}

function formatPaceMinPerKm(secPerKm: number): string {
  const totalSec = Math.round(secPerKm);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}/km`;
}
