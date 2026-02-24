import type { ChatMessage } from '../types';

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60 * 1000).toISOString();
}

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000001',
    role: 'user',
    content: 'Hey coach, I felt some tightness in my lower back during deadlifts yesterday. Should I modify today\'s workout?',
    actionsTaken: [],
    createdAt: minutesAgo(45),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    userId: '00000000-0000-0000-0000-000000000001',
    role: 'assistant',
    content: 'Good call flagging that. Lower back tightness after deadlifts is common and usually muscular, not structural. For today\'s chest/tricep session, you should be fine since it\'s upper body focused. Just avoid any exercises that load the spine heavily.\n\nA few tips:\n- Skip standing overhead press; use seated instead\n- Make sure you\'re bracing your core on bench press\n- Add some cat-cow stretches to your warm-up\n\nIf the tightness persists beyond 48 hours or feels sharp rather than dull, consider taking an extra rest day.',
    actionsTaken: ['Modified warm-up to include cat-cow stretch'],
    createdAt: minutesAgo(43),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000003',
    userId: '00000000-0000-0000-0000-000000000001',
    role: 'user',
    content: 'Makes sense, thanks. Also, I swapped my afternoon snack today — had a banana peanut butter smoothie instead of the protein shake with almonds. Is that okay for my macros?',
    actionsTaken: [],
    createdAt: minutesAgo(30),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000004',
    userId: '00000000-0000-0000-0000-000000000001',
    role: 'assistant',
    content: 'That swap is totally fine! A banana PB smoothie is actually a great choice post-workout. Here\'s a rough comparison:\n\n**Planned:** Protein shake + almonds (~320 cal, 35g P, 15g C, 16g F)\n**Your swap:** Banana PB smoothie (~350 cal, 20g P, 40g C, 14g F)\n\nThe protein is a bit lower, so try to make up ~15g at dinner — maybe add an extra portion of salmon or have some Greek yogurt before bed. The extra carbs from the banana are actually helpful for recovery.',
    actionsTaken: [],
    createdAt: minutesAgo(28),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000005',
    userId: '00000000-0000-0000-0000-000000000001',
    role: 'user',
    content: 'Got it. One more thing — I\'ve been at this for 6 weeks now. Am I on track with my weight loss?',
    actionsTaken: [],
    createdAt: minutesAgo(15),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000006',
    userId: '00000000-0000-0000-0000-000000000001',
    role: 'assistant',
    content: 'You\'re doing great. Let me break it down:\n\n**6-week progress:**\n- Starting: 85.0 kg → Current: 82.5 kg\n- Total lost: 2.5 kg (~0.4 kg/week)\n- Waist: 88 cm → 85 cm (-3 cm)\n\nThis is textbook healthy fat loss — 0.3-0.5 kg/week is ideal for preserving muscle while losing fat. Your waist measurement dropping 3 cm is excellent and suggests you\'re losing actual body fat, not just water weight.\n\nAt this pace, you\'d reach your 75 kg target in roughly 18-19 more weeks. To speed it up slightly, we could add one HIIT session per week or reduce calories by 100-150 on rest days. But honestly, your current trajectory is sustainable and healthy. I\'d stick with what\'s working.',
    actionsTaken: [],
    createdAt: minutesAgo(12),
  },
];
