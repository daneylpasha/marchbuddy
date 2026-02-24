import { create } from 'zustand';
import { SessionPlan, GeoPoint, CompletedSession } from '../types/session';
import { calculateRouteDistance } from '../utils/sessionUtils';

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

  // Calculated (updated by timer hook every 100ms)
  totalElapsedSeconds: number;
  segmentElapsedSeconds: number;

  // Actions
  startSession: (plan: SessionPlan) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  advanceSegment: () => void;
  addRoutePoint: (point: GeoPoint) => void;
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
  totalElapsedSeconds: 0,
  segmentElapsedSeconds: 0,
};

export const useActiveSessionStore = create<ActiveSessionState>((set, get) => ({
  ...initialState,

  startSession: (plan: SessionPlan) => {
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
      totalElapsedSeconds: 0,
      segmentElapsedSeconds: 0,
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
    const { plan, currentSegmentIndex } = get();
    if (!plan) return;

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
    const newRoute = [...route, point];
    set({
      route: newRoute,
      distanceKm: calculateRouteDistance(newRoute),
    });
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
      completedSegments: state.currentSegmentIndex + 1,
      endedEarly: state.currentSegmentIndex < state.plan.segments.length - 1,
      pacePerKm:
        state.distanceKm > 0
          ? (state.totalElapsedSeconds / 60) / state.distanceKm
          : null,
      route: state.route,
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
}));
