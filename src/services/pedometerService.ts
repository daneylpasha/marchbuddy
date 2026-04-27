// Pedometer is dynamically required so a missing/unlinked native module
// (e.g. running an old dev build that pre-dates the expo-sensors install)
// degrades silently to "no steps" instead of crashing the screen.
let Pedometer: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Pedometer = require('expo-sensors').Pedometer ?? null;
} catch {
  Pedometer = null;
}

type StepListener = (totalSteps: number) => void;

class PedometerService {
  private subscription: { remove: () => void } | null = null;
  private isTracking = false;
  // Steps observed at the moment tracking started — we subtract this from
  // every event so the listener receives a session-relative count rather
  // than the platform's cumulative-since-device-boot count.
  private baselineSteps = 0;
  private currentSessionSteps = 0;

  async isAvailable(): Promise<boolean> {
    if (!Pedometer?.isAvailableAsync) return false;
    try {
      return await Pedometer.isAvailableAsync();
    } catch {
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (!Pedometer?.requestPermissionsAsync) return false;
    try {
      const { status } = await Pedometer.requestPermissionsAsync();
      return status === 'granted';
    } catch {
      // On Android the Pedometer API doesn't always require an explicit
      // permission request — treat a thrown error as non-blocking.
      return true;
    }
  }

  async startTracking(onSteps: StepListener): Promise<boolean> {
    if (this.isTracking) return true;
    if (!Pedometer?.watchStepCount) return false;

    const available = await this.isAvailable();
    if (!available) return false;

    this.baselineSteps = 0;
    this.currentSessionSteps = 0;

    try {
      this.subscription = Pedometer.watchStepCount((result: { steps: number }) => {
        // Some platforms emit cumulative counts; first event sets the baseline.
        if (this.baselineSteps === 0 && result.steps > 0) {
          this.baselineSteps = result.steps;
        }
        const sessionSteps = Math.max(0, result.steps - this.baselineSteps);
        // Step count must be monotonic — guard against any platform quirks
        // that might emit a lower value than a previous event.
        if (sessionSteps >= this.currentSessionSteps) {
          this.currentSessionSteps = sessionSteps;
          onSteps(sessionSteps);
        }
      });
    } catch {
      this.subscription = null;
      return false;
    }

    this.isTracking = true;
    return true;
  }

  stopTracking(): void {
    if (this.subscription) {
      try {
        this.subscription.remove();
      } catch {
        // ignore — module already gone
      }
      this.subscription = null;
    }
    this.isTracking = false;
    this.baselineSteps = 0;
    this.currentSessionSteps = 0;
  }

  getIsTracking(): boolean {
    return this.isTracking;
  }
}

export const pedometerService = new PedometerService();
