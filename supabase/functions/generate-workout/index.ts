import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaudeJSON } from '../_shared/claude.ts';

interface RequestBody {
  profile: Record<string, unknown>;
  previousWorkouts: Record<string, unknown>[];
  recentFeedback: Record<string, unknown>[];
  chatContext: string[];
  weekNumber?: number;
  missedDays?: number;
  energyLevel?: number;
  muscleGroupFrequency?: Record<string, number>;
  readiness?: { energyLevel: number; sleepQuality?: number; stressLevel?: number; muscleSoreness?: number; timeAvailable?: number };
  recentRPE?: { date: string; rpe: number }[];
  equipmentAvailable?: string[];
}

interface GeneratedWorkout {
  exercises: {
    name: string;
    muscleGroup: string;
    sets: number;
    reps: number;
    restSeconds: number;
    order: number;
    weight?: number;
    formCues?: string[];
  }[];
  warmUp: {
    name: string;
    duration: string;
    description: string;
    order: number;
  }[];
  coolDown: {
    name: string;
    duration: string;
    description: string;
    order: number;
  }[];
  isRestDay: boolean;
  restDayType: string | null;
  aiNotes: string;
}

function buildSystemPrompt(body: RequestBody): string {
  const recentWorkoutSummary = body.previousWorkouts.length > 0
    ? JSON.stringify(body.previousWorkouts, null, 2)
    : 'No recent workouts';

  const feedbackSummary = body.recentFeedback.length > 0
    ? JSON.stringify(body.recentFeedback, null, 2)
    : 'No recent feedback';

  const chatSummary = body.chatContext.length > 0
    ? body.chatContext.join('\n')
    : 'No relevant chat context';

  return `Generate a daily workout plan for this user. Consider their profile, recent workout history, exercise feedback, and any context from coach chat.

USER PROFILE:
${JSON.stringify(body.profile, null, 2)}

RECENT WORKOUTS (last 7 days):
${recentWorkoutSummary}

RECENT EXERCISE FEEDBACK (includes actual weights/reps performed):
${feedbackSummary}

RECENT CHAT CONTEXT:
${chatSummary}

PERIODIZATION & INTENSITY RAMP:
User is in Week ${body.weekNumber ?? 99} of their program.

BEGINNER RAMP (Weeks 1-3):
- Week 1: 2-3 bodyweight exercises, 10-15 min. Focus on form and habit-building.
- Week 2: 3-4 exercises, light weights allowed, 20-25 min.
- Week 3: 4-5 exercises, moderate intensity, 30-35 min.

PERIODIZATION CYCLES (Week 4+):
Use the cycle position = ((weekNumber - 4) % 8) to determine the current phase:
- Cycle position 0-2 (Hypertrophy): 4-6 exercises, 8-12 reps, moderate weight, 60-90s rest. Focus on time under tension.
- Cycle position 3 (Deload): 3-4 exercises, reduce volume by 40%, maintain moderate weight, 90s rest. Recovery week.
- Cycle position 4-6 (Strength): 4-5 exercises, 4-6 reps, heavier weight, 120-180s rest. Focus on compound lifts.
- Cycle position 7 (Deload): 3-4 exercises, light weights, 10-12 reps, 60s rest. Active recovery week.

Current cycle position: ${((body.weekNumber ?? 99) >= 4) ? ((body.weekNumber! - 4) % 8) : 'N/A (beginner ramp)'}.
Include the current phase name in aiNotes (e.g., "Hypertrophy phase — focus on controlled reps").
If weekNumber is not provided, assume full programming with hypertrophy defaults.

PROGRESSIVE OVERLOAD RULES:
- For each exercise, you may prescribe a "weight" in kg. Omit weight (set to null) for bodyweight exercises.
- The recentFeedback includes exerciseName, prescribedWeight, actualWeight, and actualReps from previous sessions.
- If an exercise was "too-easy" AND completed at weight X: increase by ~2.5kg (upper body) or ~5kg (lower body).
- If an exercise was "too-hard" AND completed at weight X: decrease by ~2.5kg.
- If an exercise was "completed" with no difficulty issues: maintain or make a small increase (+1-2 reps OR +2.5kg).
- ALWAYS include "weight" in the JSON for weighted exercises so the app can track progression.

READINESS CHECK-IN:
Energy Level: ${body.readiness?.energyLevel ?? body.energyLevel ?? 'not provided'} (1=exhausted, 5=energized)
Sleep Quality: ${body.readiness?.sleepQuality ?? 'not provided'} (1=terrible, 5=great)
Stress Level: ${body.readiness?.stressLevel ?? 'not provided'} (1=extreme stress, 5=calm)
Time Available: ${body.readiness?.timeAvailable ?? 'not provided'} minutes

READINESS RULES:
- Energy 1-2: prescribe a lighter workout (reduce volume by 30-50%, favor lower intensity)
- Energy 3: normal workout
- Energy 4-5: full intensity, can push slightly harder
- Sleep 1-2: use familiar exercises (avoid complex new movements), reduce intensity slightly
- Stress 1-2: include stress-relief movements (yoga flows, light cardio, breathing cues in formCues)
- Time constraint: fit workout within the selected duration:
  * 15 min: 3-4 exercises, minimal rest (30-45s), compound movements only
  * 30 min: 4-5 exercises, standard rest
  * 45 min: 5-6 exercises, normal programming
  * 60 min: full workout, no restrictions
- If no readiness data is provided, assume normal energy and no time constraint.

COMEBACK / STREAK RECOVERY:
User has missed ${body.missedDays ?? 0} consecutive day(s) before today.
- 0 missed days: normal programming
- 1-2 missed days: normal workout, include an encouraging welcome-back note in aiNotes
- 3-5 missed days: reduce volume by ~30% (fewer sets, moderate weight). Mention easing back in aiNotes.
- 7+ missed days: reduce intensity by ~50%. Focus on compound movements at light weight. This is a "fresh start" session.
- Tone in aiNotes should be compassionate and non-punitive. Never shame the user.

WARM-UP & COOL-DOWN:
- Always include a "warmUp" array with 3-5 dynamic stretches/mobility exercises appropriate for today's target muscle groups.
- Always include a "coolDown" array with 3-5 static stretches targeting the muscles worked.
- Each warm-up/cool-down item has: name, duration (e.g. "30 seconds", "10 reps each side"), description (brief form cue), order.
- On rest days, return empty arrays for warmUp and coolDown.

FORM CUES (CRITICAL FOR SAFETY):
- For EVERY exercise, include a "formCues" array with 2-3 short tips (max 8 words each).
- Focus on the most common mistakes and key safety points.
- Examples: "Keep back straight", "Don't lock knees", "Squeeze at the top", "Control the descent"
- Beginners (week 1-3) should get simpler, more fundamental cues.

MUSCLE GROUP BALANCE (last 7 days):
${body.muscleGroupFrequency ? JSON.stringify(body.muscleGroupFrequency) : 'No data'}
- Ensure each major group (Chest, Back, Legs, Shoulders) is hit 1-2x per week.
- Pull exercises (Back, Biceps) should roughly equal Push exercises (Chest, Triceps, Shoulders) for joint health.
- If Legs count is 0 and it's been 5+ days, prioritize legs today.
- If a group has 3+ sessions in the last 7 days, avoid it today (overuse risk).
- Core can be trained 2-3x per week as accessory work.

RPE FATIGUE MONITORING:
Recent session RPE (Rate of Perceived Exertion, 1-10): ${body.recentRPE && body.recentRPE.length > 0 ? JSON.stringify(body.recentRPE) : 'No RPE data'}
- RPE 1-3: very light, 4-5: moderate, 6-7: hard, 8-9: very hard, 10: maximal.
- If last 2+ sessions averaged RPE >= 8: prescribe a lighter day or rest day (accumulated fatigue risk).
- If last session was RPE >= 9: strongly consider a deload or rest day regardless of schedule.
- If RPE has been trending upward over 3+ sessions, mention in aiNotes that fatigue is building.
- If no RPE data is available, ignore this section.

EQUIPMENT AVAILABLE:
${body.equipmentAvailable && body.equipmentAvailable.length > 0 ? body.equipmentAvailable.join(', ') : 'Bodyweight only'}
- ONLY prescribe exercises that can be performed with the listed equipment.
- If "Bodyweight" is the only equipment, all exercises must be bodyweight movements (push-ups, squats, lunges, planks, etc.).
- If "Dumbbells" is listed but not "Barbell", do NOT prescribe barbell exercises (use dumbbell equivalents).
- If "Machines" is NOT listed, do NOT prescribe machine-based exercises (leg press, cable fly, lat pulldown, etc.).
- If "Cables" is NOT listed, do NOT prescribe cable exercises.
- If "Pull-Up Bar" is NOT listed, do NOT prescribe pull-ups or chin-ups (use alternatives like bent-over rows).
- Always adapt exercises to match available equipment — never assume the user has equipment not listed.

GENERAL RULES:
- Choose exercises appropriate for user's fitness history and current level
- If user reported injury/pain in chat, avoid that area completely
- If user changed schedule (fewer days), adjust split accordingly
- Prescribe rest days when patterns suggest fatigue (consecutive "too-hard" or missed sessions)
- Include sets, reps, rest seconds for each exercise
- Assign a muscleGroup from: Chest, Back, Legs, Shoulders, Arms, Core, Full Body
- Order exercises logically (compound movements first, isolation last)

Respond with valid JSON only:
{
  "exercises": [{"name": "", "muscleGroup": "", "sets": 0, "reps": 0, "restSeconds": 0, "order": 0, "weight": null, "formCues": ["tip1", "tip2"]}],
  "warmUp": [{"name": "", "duration": "", "description": "", "order": 0}],
  "coolDown": [{"name": "", "duration": "", "description": "", "order": 0}],
  "isRestDay": false,
  "restDayType": null,
  "aiNotes": "explanation of today's plan choices"
}`;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    const systemPrompt = buildSystemPrompt(body);

    const result = await callClaudeJSON<GeneratedWorkout>(
      systemPrompt,
      [{ role: 'user', content: 'Generate my workout plan for today.' }],
      undefined,
      2048,
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('generate-workout error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate workout plan',
        details: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
