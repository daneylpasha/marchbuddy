import { useEffect, useRef, useCallback } from 'react';
import { SessionSegment } from '../types/session';
import { useActiveSessionStore } from '../store/activeSessionStore';
import { sessionCueService } from '../services/sessionCueService';

interface UseSessionTimerOptions {
  onComplete?: () => void;
}

interface UseSessionTimerReturn {
  totalElapsedSeconds: number;
  segmentElapsedSeconds: number;
  segmentRemainingSeconds: number;
  isSegmentComplete: boolean;
  currentSegment: SessionSegment | null;
  nextSegment: SessionSegment | null;
  progress: number; // 0–1 for current segment
}

export const useSessionTimer = ({ onComplete }: UseSessionTimerOptions = {}): UseSessionTimerReturn => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAnnouncedRef = useRef<Set<number>>(new Set());
  const hasAnnouncedAdvanceRef = useRef<Set<number>>(new Set());
  const hasAnnouncedHalfwayRef = useRef<Set<number>>(new Set());
  // Use a ref so the tick callback doesn't need onComplete in its dep array
  const onCompleteRef = useRef<(() => void) | undefined>(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const {
    plan,
    isActive,
    isPaused,
    startedAt,
    segmentStartedAt,
    currentSegmentIndex,
    totalElapsedSeconds,
    segmentElapsedSeconds,
    updateElapsedTime,
    advanceSegment,
  } = useActiveSessionStore();

  const currentSegment = plan?.segments[currentSegmentIndex] ?? null;
  const nextSegment = plan?.segments[currentSegmentIndex + 1] ?? null;

  const segmentRemainingSeconds = currentSegment
    ? Math.max(0, currentSegment.durationSeconds - segmentElapsedSeconds)
    : 0;

  const isSegmentComplete = currentSegment !== null && segmentRemainingSeconds === 0;

  const progress = currentSegment
    ? Math.min(1, segmentElapsedSeconds / currentSegment.durationSeconds)
    : 0;

  // Stable tick ref to avoid restarting the interval on every render
  const tickRef = useRef<() => void>(() => {});

  const tick = useCallback(() => {
    if (!startedAt || !segmentStartedAt || !currentSegment) return;

    const now = Date.now();

    // startedAt and segmentStartedAt are shifted forward on each resume,
    // so simple subtraction gives correct active-only elapsed time.
    const totalSeconds = Math.floor((now - startedAt.getTime()) / 1000);
    const segmentSeconds = Math.floor((now - segmentStartedAt.getTime()) / 1000);

    updateElapsedTime(totalSeconds, segmentSeconds);

    // Segment completion
    if (segmentSeconds >= currentSegment.durationSeconds) {
      // Cue fires at most once per index. Advance is idempotent in the store,
      // so we call it unconditionally — even if the ref somehow got set
      // without state actually advancing (e.g. a prior tick's advance was
      // skipped by a stale guard), the tick will keep retrying until the
      // index moves forward.
      if (!hasAnnouncedRef.current.has(currentSegmentIndex)) {
        hasAnnouncedRef.current.add(currentSegmentIndex);
        if (nextSegment) {
          sessionCueService.playSegmentChange(nextSegment.type, nextSegment.label);
        } else {
          sessionCueService.playSessionComplete();
        }
      }
      advanceSegment();
      if (!nextSegment) {
        onCompleteRef.current?.();
      }
      return;
    }

    // Last-10-seconds countdown cues before segment ends (voice + haptic).
    const remaining = currentSegment.durationSeconds - segmentSeconds;
    if (remaining <= 10 && remaining > 0) {
      sessionCueService.playCountdown(remaining);
    }

    // Per-segment halfway voice cue — only for segments longer than 2 minutes,
    // so short walks/runs don't get a voice spam at their midpoint.
    if (
      currentSegment.durationSeconds > 120 &&
      segmentSeconds >= Math.floor(currentSegment.durationSeconds / 2) &&
      !hasAnnouncedHalfwayRef.current.has(currentSegmentIndex)
    ) {
      hasAnnouncedHalfwayRef.current.add(currentSegmentIndex);
      sessionCueService.playSegmentHalfway(currentSegment.type);
    }

    // 30-second advance warning before an upcoming run segment — fires once
    // per segment. Guard on durationSeconds > 30 so short walk segments
    // (< 30s) don't immediately fire a misleading "30 seconds" warning.
    if (
      nextSegment?.type === 'run' &&
      currentSegment.durationSeconds > 30 &&
      remaining <= 30 &&
      remaining > 0 &&
      !hasAnnouncedAdvanceRef.current.has(currentSegmentIndex)
    ) {
      hasAnnouncedAdvanceRef.current.add(currentSegmentIndex);
      sessionCueService.playUpcomingRun();
    }
  }, [
    startedAt,
    segmentStartedAt,
    currentSegment,
    currentSegmentIndex,
    nextSegment,
    updateElapsedTime,
    advanceSegment,
  ]);

  // Keep tickRef in sync with latest tick without restarting the interval
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  // Start/stop interval based on session state
  useEffect(() => {
    if (isActive && !isPaused) {
      intervalRef.current = setInterval(() => tickRef.current(), 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, isPaused]);

  return {
    totalElapsedSeconds,
    segmentElapsedSeconds,
    segmentRemainingSeconds,
    isSegmentComplete,
    currentSegment,
    nextSegment,
    progress,
  };
};
