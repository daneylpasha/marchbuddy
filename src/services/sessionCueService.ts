import * as Haptics from 'expo-haptics';
import { SegmentType } from '../types/session';

class SessionCueService {
  private lastCountdownPlayed = 0;

  async playSegmentChange(nextSegmentType: SegmentType): Promise<void> {
    // Reset countdown tracking for the new segment
    this.lastCountdownPlayed = 0;

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error playing segment change cue:', error);
    }
  }

  async playCountdown(secondsRemaining: number): Promise<void> {
    // Deduplicate — only play once per countdown value
    if (this.lastCountdownPlayed === secondsRemaining) return;
    this.lastCountdownPlayed = secondsRemaining;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error playing countdown cue:', error);
    }
  }

  async playSessionComplete(): Promise<void> {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(async () => {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }, 200);
    } catch (error) {
      console.error('Error playing session complete cue:', error);
    }
  }

  async playPause(): Promise<void> {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Error playing pause cue:', error);
    }
  }

  async playResume(): Promise<void> {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Error playing resume cue:', error);
    }
  }

  reset(): void {
    this.lastCountdownPlayed = 0;
  }
}

export const sessionCueService = new SessionCueService();
