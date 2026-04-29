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
  // Added to every emitted count so a resumed session continues from where
  // it left off instead of restarting at 0. Fresh sessions pass 0.
  // (The native module already returns session-relative counts — see
  // expo-sensors PedometerModule for both iOS and Android — so no extra
  // baseline subtraction is needed here.)
  private externalBaseline = 0;
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

  async startTracking(
    onSteps: StepListener,
    initialBaseline = 0,
  ): Promise<boolean> {
    if (this.isTracking) return true;
    if (!Pedometer?.watchStepCount) return false;

    const available = await this.isAvailable();
    if (!available) return false;

    this.externalBaseline = initialBaseline;
    this.currentSessionSteps = initialBaseline;

    try {
      this.subscription = Pedometer.watchStepCount((result: { steps: number }) => {
        // result.steps is already session-relative (count since the
        // subscription started — verified in expo-sensors native code for
        // both iOS CMPedometer.startUpdates(from:) and Android's
        // PedometerModule which subtracts stepsAtTheBeginning). We only
        // add the externalBaseline so resumed sessions keep their
        // pre-resume count.
        const total = this.externalBaseline + (result.steps ?? 0);
        // Step count must be monotonic — guard against any platform quirks
        // that might emit a lower value than a previous event.
        if (total >= this.currentSessionSteps) {
          this.currentSessionSteps = total;
          onSteps(total);
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
    this.externalBaseline = 0;
    this.currentSessionSteps = 0;
  }

  getIsTracking(): boolean {
    return this.isTracking;
  }
}

export const pedometerService = new PedometerService();
