import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify the user's JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create a client with the user's JWT to identify them
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userId = user.id;

    // Use service role client to delete user data from all tables
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Delete user data from all relevant tables
    const tablesToClean = [
      'user_onboarding',
      'user_run_progress',
      'user_profiles',
      'session_history',
      'meal_plans',
      'water_logs',
      'food_snaps',
      'weight_entries',
      'chat_messages',
      'weekly_summaries',
    ];

    for (const table of tablesToClean) {
      const { error } = await adminClient
        .from(table)
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.warn(`Warning: Could not delete from ${table}:`, error.message);
        // Continue with other tables — some may not exist
      }
    }

    // Delete the auth user via admin API
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete account. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('delete-account error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
