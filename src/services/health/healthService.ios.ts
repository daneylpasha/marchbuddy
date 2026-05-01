import AppleHealthKit, {
  HealthActivity,
  HealthKitPermissions,
  HealthUnit,
} from 'react-native-health';
import type { IHealthService, WorkoutSummary } from './types';

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [],
    write: [
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
    ],
  },
};

// initHealthKit both requests permissions (first call) and re-verifies them
// (subsequent calls). Safe to call before every save — HealthKit is idempotent.
function init(): Promise<boolean> {
  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (error) => {
      resolve(!error);
    });
  });
}

function writeWorkout(workout: WorkoutSummary): Promise<boolean> {
  return new Promise((resolve) => {
    AppleHealthKit.saveWorkout(
      {
        type: workout.workoutType === 'running' ? HealthActivity.Running : HealthActivity.Walking,
        startDate: workout.startDate.toISOString(),
        endDate: workout.endDate.toISOString(),
      },
      (error) => resolve(!error),
    );
  });
}

// Saves distance as a separate HKQuantitySample. HealthKit automatically
// associates it with the overlapping workout when both share the same time range.
function writeDistance(workout: WorkoutSummary): Promise<void> {
  return new Promise<void>((resolve) => {
    AppleHealthKit.saveWalkingRunningDistance(
      {
        value: workout.distanceKm * 1000, // HealthKit expects meters
        unit: HealthUnit.meter,
        startDate: workout.startDate.toISOString(),
        endDate: workout.endDate.toISOString(),
      },
      () => resolve(),
    );
  });
}

const healthService: IHealthService = {
  async saveWorkout(workout: WorkoutSummary): Promise<boolean> {
    const initialized = await init();
    if (!initialized) return false;

    // Write workout and distance in parallel — both are independent HK writes
    const [saved] = await Promise.all([writeWorkout(workout), writeDistance(workout)]);
    return saved;
  },
};

export default healthService;
