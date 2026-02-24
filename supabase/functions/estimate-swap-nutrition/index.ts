import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaudeJSON } from '../_shared/claude.ts';

interface RequestBody {
  foodDescription: string;
}

interface NutritionEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const SYSTEM_PROMPT = `You are a nutrition estimation AI. Given a food description, estimate its nutritional content for a single typical serving.

Respond with valid JSON only:
{
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams)
}

Be realistic with estimates based on typical serving sizes. If the description is vague, estimate for a standard portion. Round to whole numbers.`;

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    const { foodDescription } = body;

    if (!foodDescription || foodDescription.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'foodDescription is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const result = await callClaudeJSON<NutritionEstimate>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: `Estimate the nutritional content of: ${foodDescription}` }],
      undefined,
      256,
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('estimate-swap-nutrition error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to estimate nutrition',
        details: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
