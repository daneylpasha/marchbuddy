import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaudeJSON } from '../_shared/claude.ts';

interface RequestBody {
  profile: Record<string, unknown>;
  todayWorkout: Record<string, unknown> | null;
  recentMealFeedback: Record<string, unknown>[];
  recentFoodSnaps: Record<string, unknown>[];
  chatContext: string[];
  recentMealDescriptions?: string[]; // NEW: For variety
}

interface GeneratedMealPlan {
  meals: {
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    name: string;
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

function buildSystemPrompt(body: RequestBody): string {
  const workoutSummary = body.todayWorkout
    ? JSON.stringify(body.todayWorkout, null, 2)
    : 'Rest day — no workout planned';

  const feedbackSummary = body.recentMealFeedback.length > 0
    ? JSON.stringify(body.recentMealFeedback, null, 2)
    : 'No recent meal feedback';

  const snapsSummary = body.recentFoodSnaps.length > 0
    ? JSON.stringify(body.recentFoodSnaps, null, 2)
    : 'No recent food snaps';

  const chatSummary = body.chatContext.length > 0
    ? body.chatContext.join('\n')
    : 'No relevant chat context';

  const recentMealsSummary = body.recentMealDescriptions && body.recentMealDescriptions.length > 0
    ? body.recentMealDescriptions.join('\n')
    : 'No recent meals on record';

  return `Generate a daily meal plan for this user. The meals must be practical, culturally appropriate, and aligned with their calorie/macro targets.

USER PROFILE:
${JSON.stringify(body.profile, null, 2)}

TODAY'S WORKOUT:
${workoutSummary}

RECENT MEAL FEEDBACK (what they've been skipping/swapping):
${feedbackSummary}

RECENT FOOD SNAPS (off-plan eating patterns):
${snapsSummary}

RECENT CHAT CONTEXT:
${chatSummary}

RECENT MEALS (last 14 days — AVOID suggesting these again for variety):
${recentMealsSummary}

RULES:
- Generate meals from the user's cuisine region (e.g., South Asian food for Pakistan, Japanese for Japan — NOT generic Western meals for everyone)
- **IMPORTANT: Do NOT repeat any meals from the "RECENT MEALS" list above — provide fresh variety**
- If user always skips breakfast, redistribute those calories to other meals instead of including breakfast
- 3 meals + 1-2 snacks, each with name, description, estimated calories, protein, carbs, fat
- Keep meals practical — common ingredients, reasonable prep time
- If user eats family meals, suggest what to eat more/less of rather than separate meals
- Higher calorie allocation on workout days, slightly lower on rest days
- Total macros should match the user's goals and activity level

Respond with valid JSON only:
{"meals": [{"type": "breakfast|lunch|dinner|snack", "name": "", "description": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0}], "totalCalories": 0, "totalProtein": 0, "totalCarbs": 0, "totalFat": 0}`;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    const systemPrompt = buildSystemPrompt(body);

    const result = await callClaudeJSON<GeneratedMealPlan>(
      systemPrompt,
      [{ role: 'user', content: 'Generate my meal plan for today.' }],
      undefined,
      1024,
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('generate-meal-plan error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate meal plan',
        details: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
