import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaudeJSON } from '../_shared/claude.ts';

interface RequestBody {
  profile: Record<string, unknown>;
  weekWorkouts: Record<string, unknown>[];
  weekMealPlans: Record<string, unknown>[];
  weekWaterLogs: Record<string, unknown>[];
  weightEntries: Record<string, unknown>[];
  chatMessages: { role: string; content: string }[];
}

interface WeeklySummaryResult {
  summaryText: string;
  insights: string[];
}

function buildSystemPrompt(body: RequestBody): string {
  return `Generate a comprehensive weekly fitness summary for this user. Analyze their workout adherence, nutrition compliance, hydration habits, weight trends, and chat context to produce an encouraging, insightful summary.

USER PROFILE:
${JSON.stringify(body.profile, null, 2)}

THIS WEEK'S WORKOUTS:
${JSON.stringify(body.weekWorkouts, null, 2)}

THIS WEEK'S MEAL PLANS:
${JSON.stringify(body.weekMealPlans, null, 2)}

THIS WEEK'S WATER LOGS:
${JSON.stringify(body.weekWaterLogs, null, 2)}

WEIGHT ENTRIES:
${JSON.stringify(body.weightEntries, null, 2)}

RELEVANT CHAT MESSAGES:
${body.chatMessages.map((m) => `${m.role}: ${m.content}`).join('\n')}

RULES:
- Write a 3-4 sentence narrative summary covering highlights and areas for improvement
- Generate 3-5 specific data-driven insights (e.g., "Workout consistency: 80%", "Average protein: 115g/day")
- Be encouraging but honest — celebrate wins, gently flag areas to improve
- Reference specific numbers and trends
- If the user had life events (travel, festivals, injury) that affected the week, acknowledge that context

Respond with valid JSON only:
{"summaryText": "narrative summary paragraph", "insights": ["insight 1", "insight 2", "insight 3"]}`;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    const systemPrompt = buildSystemPrompt(body);

    const result = await callClaudeJSON<WeeklySummaryResult>(
      systemPrompt,
      [{ role: 'user', content: 'Generate my weekly fitness summary.' }],
      undefined,
      1024,
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('weekly-summary error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate weekly summary',
        details: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
