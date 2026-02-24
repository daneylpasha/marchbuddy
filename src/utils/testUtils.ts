// Temporary utility for testing - delete this file later
import { deleteTodayPlans } from '../api/database';
import { generateTodaysPlan } from '../services/dailyPlanService';
import { useAuthStore } from '../store/authStore';
import { useNutritionStore } from '../store/nutritionStore';

/**
 * Delete today's meal plan and regenerate it with variety
 * Use this to test the new meal variety feature
 */
export async function regenerateTodayMealPlan() {
  try {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      console.error('❌ No user logged in');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    console.log('🗑️ Deleting today\'s meal plan...');
    await deleteTodayPlans(userId, today);

    console.log('🔄 Regenerating with new variety logic...');
    await generateTodaysPlan(userId);

    console.log('📱 Refreshing nutrition screen...');
    await useNutritionStore.getState().fetchTodayMealPlan(userId);

    console.log('✅ Done! Check your nutrition screen for new meals!');
  } catch (error) {
    console.error('❌ Error regenerating meal plan:', error);
  }
}

// To use: In React Native debugger console, type:
// import('./utils/testUtils').then(m => m.regenerateTodayMealPlan())
