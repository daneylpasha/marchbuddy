export type MessageRole = 'user' | 'coach' | 'system';
export type MessageType = 'text' | 'image';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  imageUri?: string;
  timestamp: string;
}

export interface AvailableSession {
  title: string;
  durationMinutes: number;
}

export interface ChatContext {
  userName: string;
  currentLevel: number;
  totalSessions: number;
  currentStreak: number;
  lastSessionDate: string | null;
  triggerStatement: string;
  anchorPerson: string;
  primaryFear: string;
  successVision: string;
  recentSessions: {
    date: string;
    title: string;
    feedback: string;
  }[];
  availableSessions: {
    recommended: AvailableSession;
    quick: AvailableSession;
    challenge: AvailableSession;
    push: AvailableSession;
  };
}
