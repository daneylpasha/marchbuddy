import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaudeJSON } from '../_shared/claude.ts';

interface RequestBody {
  exerciseName: string;
  muscleGroup: string;
  equipmentAvailable: string[];
  currentExercises: string[];  // other exercises in today's workout (avoid duplicates)
  reason?: string;             // why the user wants to swap
}

interface SwapAlternative {
  name: string;
  muscleGroup: string;
  sets: number;
  reps: number;
  weight: number | null;
  formCues: string[];
  reason: string;  // why this is a good alternative
}

interface SwapResponse {
  alternatives: SwapAlternative[];
}

function buildPrompt(body: RequestBody): string {
  return `Suggest 3 alternative exercises to replace "${body.exerciseName}" (${body.muscleGroup}).

AVAILABLE EQUIPMENT: ${body.equipmentAvailable.length > 0 ? body.equipmentAvailable.join(', ') : 'Bodyweight only'}
ONLY suggest exercises that can be done with the listed equipment.

CURRENT WORKOUT (avoid duplicates): ${body.currentExercises.join(', ')}
${body.reason ? `SWAP REASON: ${body.reason}` : ''}

RULES:
- All 3 alternatives must target the same primary muscle group (${body.muscleGroup})
- Do NOT suggest exercises already in the current workout
- Include sets, reps, weight (null for bodyweight), and 2 formCues per exercise
- The "reason" field should be a short 1-sentence explanation of why this is a good swap
- Order alternatives from most similar to least similar

Respond with valid JSON only:
{
  "alternatives": [
    {"name": "", "muscleGroup": "", "sets": 3, "reps": 10, "weight": null, "formCues": ["tip1", "tip2"], "reason": ""}
  ]
}`;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    const systemPrompt = buildPrompt(body);

    const result = await callClaudeJSON<SwapResponse>(
      systemPrompt,
      [{ role: 'user', content: `Suggest alternatives for ${body.exerciseName}.` }],
      undefined,
      1024,
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('suggest-swap error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to suggest exercise swap',
        details: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
