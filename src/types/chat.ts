export type MessageRole = 'user' | 'coach' | 'system';
export type MessageType = 'text' | 'image';

export type ProactiveTrigger =
  | 'session_morning'
  | 'post_session'
  | 'missed_session'
  | 'weekly_recap';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  imageUri?: string;
  timestamp: string;
  // Set when this message was authored by the server-side proactive coach
  // pipeline. Used by analytics + de-duplication in chatStore sync.
  proactiveTrigger?: ProactiveTrigger;
  // Server-side schedule row id. Used as the message id when merging from
  // coach_message_schedule so re-syncs don't insert duplicates.
  serverScheduleId?: string;
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
