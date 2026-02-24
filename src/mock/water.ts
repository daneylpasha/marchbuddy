import type { WaterLog } from '../types';

const today = new Date().toISOString().split('T')[0];

export const mockWaterLog: WaterLog = {
  id: 'c0000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000001',
  date: today,
  goal: 2500,
  consumed: 1750,
  entries: [
    { id: 'we-1', amount: 500, loggedAt: today + 'T07:15:00.000Z' },
    { id: 'we-2', amount: 250, loggedAt: today + 'T09:00:00.000Z' },
    { id: 'we-3', amount: 500, loggedAt: today + 'T11:30:00.000Z' },
    { id: 'we-4', amount: 250, loggedAt: today + 'T13:45:00.000Z' },
    { id: 'we-5', amount: 250, loggedAt: today + 'T16:00:00.000Z' },
  ],
};
