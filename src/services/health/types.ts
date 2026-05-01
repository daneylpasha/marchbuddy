export interface WorkoutSummary {
  startDate: Date;
  endDate: Date;
  durationMinutes: number;
  distanceKm: number;
  // levels 1-8 are walk-heavy (Walking), 9-16 are run-heavy (Running)
  workoutType: 'walking' | 'running';
}

export interface IHealthService {
  saveWorkout(workout: WorkoutSummary): Promise<boolean>;
}
