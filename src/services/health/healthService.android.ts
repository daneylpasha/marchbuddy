import {
  initialize,
  requestPermission,
  insertRecords,
  ExerciseType,
} from 'react-native-health-connect';
import type { IHealthService, WorkoutSummary } from './types';

const PERMISSIONS = [
  { accessType: 'write' as const, recordType: 'ExerciseSession' as const },
  { accessType: 'write' as const, recordType: 'Distance' as const },
];

// initialize() checks Health Connect is installed on the device.
// requestPermission() shows the system permission sheet once; subsequent
// calls are no-ops if already granted.
async function init(): Promise<boolean> {
  try {
    const available = await initialize();
    if (!available) return false;
    const granted = await requestPermission(PERMISSIONS);
    return granted.some((p) => p.accessType === 'write' && p.recordType === 'ExerciseSession');
  } catch {
    return false;
  }
}

// Saves distance as a separate Distance record. Health Connect automatically
// associates it with the ExerciseSession when both share the same time range.
const healthService: IHealthService = {
  async saveWorkout(workout: WorkoutSummary): Promise<boolean> {
    const initialized = await init();
    if (!initialized) return false;

    const startTime = workout.startDate.toISOString();
    const endTime = workout.endDate.toISOString();

    await Promise.all([
      insertRecords([
        {
          recordType: 'ExerciseSession',
          startTime,
          endTime,
          exerciseType:
            workout.workoutType === 'running' ? ExerciseType.RUNNING : ExerciseType.WALKING,
          title: 'MarchBuddy Session',
        },
      ]),
      insertRecords([
        {
          recordType: 'Distance',
          startTime,
          endTime,
          distance: { value: workout.distanceKm, unit: 'kilometers' },
        },
      ]),
    ]);

    return true;
  },
};

export default healthService;
