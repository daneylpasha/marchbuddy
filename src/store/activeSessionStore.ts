import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionPlan, GeoPoint, CompletedSession } from '../types/session';
import { calculateRouteDistance, haversineDistance } from '../utils/sessionUtils';

// Minimum movement between accepted route points. Below this, the "movement"
// is GPS noise from a stationary user, not real walking. Without this guard,
// sitting still for 20 min produces a tangled zigzag instead of a single dot.
const MIN_ROUTE_DELTA_METERS = 3;

// Implied speed above which a fix is treated as a GPS teleport (signal
// briefly jumped to a wrong location, then snapped back). 30 km/h is well
// above any realistic walking or jogging pace.
const MAX_PLAUSIBLE_SPEED_KMH = 30;

// A persisted session that hasn't been touched for this long is considered
// abandoned and silently discarded on cold-start. 6h is generous enough for
// "I paused at lunch and came back after dinner" but short enough that a
// session paused yesterday or 3 days ago doesn't hijack today's flow.
export const STALE_SESSION_THRESHOLD_MS = 6 * 60 * 60 * 1000;

// Reference time used for both staleness checks and the resume-prompt
// "X ago" string. pausedAt is preferred — it represents the user's last
// active interaction; startedAt is only a fallback when somehow the
// session was killed without going through pause (e.g. hard crash).
export function getSessionReferenceTime(state: {
  startedAt: Date | null;
  pausedAt: Date | null;
}): Date | null {
  return state.pausedAt ?? state.startedAt;
}

export function isSessionStale(state: { startedAt: Date | null; pausedAt: Date | null }): boolean {
  const ref = getSessionReferenceTime(state);
  if (!(ref instanceof Date)) return false;
  return Date.now() - ref.getTime() > STALE_SESSION_THRESHOLD_MS;
}

interface ActiveSessionState {
  // Session data
  plan: SessionPlan | null;
  isActive: boolean;
  isPaused: boolean;

  // Timing
  startedAt: Date | null;
  pausedAt: Date | null;
  currentSegmentIndex: number;
  segmentStartedAt: Date | null;

  // GPS
  route: GeoPoint[];
  distanceKm: number;

  // Pedometer (session-relative — already baselined by pedometerService)
  stepCount: number;

  // Environment
  environment: 'indoor' | 'outdoor' | null;

  // Calculated (updated by timer hook every 100ms)
  totalElapsedSeconds: number;
  segmentElapsedSeconds: number;

  // Actions
  startSession: (plan: SessionPlan, environment: 'indoor' | 'outdoor') => void;
  pauseSession: () => void;
  resumeSession: () => void;
  advanceSegment: () => void;
  addRoutePoint: (point: GeoPoint) => void;
  setStepCount: (steps: number) => void;
  updateElapsedTime: (totalSeconds: number, segmentSeconds: number) => void;
  endSession: () => CompletedSession | null;
  resetSession: () => void;
}

const initialState = {
  plan: null,
  isActive: false,
  isPaused: false,
  startedAt: null,
  pausedAt: null,
  currentSegmentIndex: 0,
  segmentStartedAt: null,
  route: [],
  distanceKm: 0,
  stepCount: 0,
  totalElapsedSeconds: 0,
  segmentElapsedSeconds: 0,
  environment: null as 'indoor' | 'outdoor' | null,
};

export const useActiveSessionStore = create<ActiveSessionState>()(
  persist(
    (set, get) => ({
      ...initialState,

      startSession: (plan: SessionPlan, environment: 'indoor' | 'outdoor') => {
        const now = new Date();
        set({
          plan,
          isActive: true,
          isPaused: false,
          startedAt: now,
          pausedAt: null,
          currentSegmentIndex: 0,
          segmentStartedAt: now,
          route: [],
          distanceKm: 0,
          stepCount: 0,
          totalElapsedSeconds: 0,
          segmentElapsedSeconds: 0,
          environment,
        });
      },

      pauseSession: () => {
        const { isPaused } = get();
        if (isPaused) return;

        set({
          isPaused: true,
          pausedAt: new Date(),
        });
      },

      resumeSession: () => {
        const { isPaused, pausedAt, startedAt, segmentStartedAt } = get();
        if (!isPaused || !pausedAt) return;

        // Shift both timestamps forward by the pause duration so elapsed calculations
        // automatically exclude paused time without needing a totalPausedMs offset.
        const pauseDuration = Date.now() - pausedAt.getTime();
        set({
          isPaused: false,
          pausedAt: null,
          startedAt: startedAt ? new Date(startedAt.getTime() + pauseDuration) : startedAt,
          segmentStartedAt: segmentStartedAt
            ? new Date(segmentStartedAt.getTime() + pauseDuration)
            : segmentStartedAt,
        });
      },

      advanceSegment: () => {
        const { plan, currentSegmentIndex, segmentStartedAt } = get();
        if (!plan) return;

        // Idempotency guard: only advance if the current segment actually finished.
        // This lets callers invoke advanceSegment() every tick safely — if the
        // segment has already advanced, elapsed will be < duration and we bail out.
        const current = plan.segments[currentSegmentIndex];
        if (current && segmentStartedAt) {
          const elapsed = (Date.now() - segmentStartedAt.getTime()) / 1000;
          if (elapsed < current.durationSeconds) return;
        }

        const nextIndex = currentSegmentIndex + 1;

        if (nextIndex >= plan.segments.length) {
          // Last segment done — advance index past the end so the screen's
          // useEffect (watching currentSegmentIndex) fires and calls handleSessionComplete.
          set({ currentSegmentIndex: nextIndex });
          return;
        }

        set({
          currentSegmentIndex: nextIndex,
          segmentStartedAt: new Date(),
          segmentElapsedSeconds: 0,
        });
      },

      addRoutePoint: (point: GeoPoint) => {
        const { route } = get();
        const previous = route[route.length - 1];

        // First fix of the session — nothing to compare against, accept.
        if (!previous) {
          set({ route: [point], distanceKm: 0 });
          return;
        }

        const deltaKm = haversineDistance(previous, point);
        const deltaMeters = deltaKm * 1000;

        // Drop sub-3m moves — stationary GPS noise, not real walking.
        if (deltaMeters < MIN_ROUTE_DELTA_METERS) return;

        // Drop fixes that imply a physically impossible speed (signal teleport).
        const deltaSeconds = (point.timestamp - previous.timestamp) / 1000;
        if (deltaSeconds > 0) {
          const impliedKmh = deltaKm / (deltaSeconds / 3600);
          if (impliedKmh > MAX_PLAUSIBLE_SPEED_KMH) return;
        }

        const newRoute = [...route, point];
        set({
          route: newRoute,
          distanceKm: calculateRouteDistance(newRoute),
        });
      },

      setStepCount: (steps: number) => {
        // pedometerService already enforces monotonicity, but guard here too —
        // we never want the displayed count to go backward.
        const { stepCount } = get();
        if (steps > stepCount) {
          set({ stepCount: steps });
        }
      },

      updateElapsedTime: (totalSeconds: number, segmentSeconds: number) => {
        set({
          totalElapsedSeconds: totalSeconds,
          segmentElapsedSeconds: segmentSeconds,
        });
      },

      endSession: () => {
        const state = get();
        if (!state.plan || !state.startedAt) return null;

        const completed: CompletedSession = {
          id: `session-${Date.now()}`,
          orderId: state.plan.id,
          planId: state.plan.id,
          planLevel: state.plan.level,
          planVariant: state.plan.variant,
          planTitle: state.plan.title,
          plannedDurationMinutes: state.plan.totalDurationMinutes,
          plannedSegments: state.plan.segments,
          actualDurationMinutes: Math.round(state.totalElapsedSeconds / 60),
          actualDistanceKm: state.distanceKm,
          actualSteps: state.stepCount,
          completedSegments: Math.min(state.currentSegmentIndex + 1, state.plan.segments.length),
          endedEarly: state.currentSegmentIndex < state.plan.segments.length - 1,
          pacePerKm:
            state.distanceKm > 0 ? state.totalElapsedSeconds / 60 / state.distanceKm : null,
          route: state.route,
          environment: state.environment ?? 'outdoor',
          treadmillStats: null,
          feedbackRating: null,
          feedbackNotes: null,
          startedAt: state.startedAt.toISOString(),
          completedAt: new Date().toISOString(),
        };

        set(initialState);
        return completed;
      },

      resetSession: () => {
        set(initialState);
      },
    }),
    {
      name: 'march-buddy-active-session',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist what's needed to resume — the timer hook recomputes
      // totalElapsedSeconds/segmentElapsedSeconds from startedAt every tick,
      // so persisting them would just create stale-vs-recomputed flicker on rehydration.
      partialize: (state) => ({
        plan: state.plan,
        isActive: state.isActive,
        isPaused: state.isPaused,
        startedAt: state.startedAt,
        pausedAt: state.pausedAt,
        currentSegmentIndex: state.currentSegmentIndex,
        segmentStartedAt: state.segmentStartedAt,
        route: state.route,
        distanceKm: state.distanceKm,
        stepCount: state.stepCount,
        environment: state.environment,
      }),
      // Dates round-trip through JSON as ISO strings — revive them so
      // pausedAt.getTime() / startedAt.getTime() in the resume math don't crash.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (typeof state.startedAt === 'string') {
          state.startedAt = new Date(state.startedAt);
        }
        if (typeof state.pausedAt === 'string') {
          state.pausedAt = new Date(state.pausedAt);
        }
        if (typeof state.segmentStartedAt === 'string') {
          state.segmentStartedAt = new Date(state.segmentStartedAt);
        }
      },
    },
  ),
);
