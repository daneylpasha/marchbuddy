import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { SegmentType } from '../types/session';
import { useSettingsStore } from '../store/settingsStore';

const SEGMENT_PHRASES: Record<SegmentType, string[]> = {
  warmup:   ["Let's warm up.", "Start your warmup. Nice and easy."],
  walk:     ["Good work. Time to walk.", "Walk it out.", "Nice effort. Walk now."],
  run:      ["Time to run. Let's go!", "Start running. You've got this!", "Pick it up — time to run!"],
  cooldown: ["Great effort. Time to cool down.", "Almost done. Cool down now."],
};

function pickPhrase(type: SegmentType): string {
  const options = SEGMENT_PHRASES[type];
  return options[Math.floor(Math.random() * options.length)];
}

class SessionCueService {
  private lastCountdownPlayed = 0;
  private audioReady = false;

  // Call once when a session starts. Sets up the audio session so that:
  //   • speech plays through headphones when the screen is locked
  //   • background music is ducked while the voice speaks, then restored
  async initialize(): Promise<void> {
    if (this.audioReady) return;
    try {
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      });
      this.audioReady = true;
    } catch (e) {
      console.warn('sessionCueService: audio mode setup failed', e);
    }
  }

  private isVoiceEnabled(): boolean {
    return useSettingsStore.getState().voiceCuesEnabled;
  }

  private speak(text: string): void {
    if (!this.isVoiceEnabled()) return;
    Speech.stop();
    Speech.speak(text, { language: 'en-US', rate: 0.9, pitch: 1.05 });
  }

  async playSegmentChange(nextSegmentType: SegmentType, nextSegmentLabel?: string): Promise<void> {
    this.lastCountdownPlayed = 0;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    // Prefer the label (e.g. "Brisk walk", "Easy pace") so users hear the
    // intensity, not just the generic segment type.
    const phrase = nextSegmentLabel
      ? `${nextSegmentLabel} now.`
      : pickPhrase(nextSegmentType);
    this.speak(phrase);
  }

  // Fires 30 seconds before an upcoming run segment.
  playUpcomingRun(): void {
    this.speak('Get ready to run in 30 seconds.');
  }

  async playCountdown(secondsRemaining: number): Promise<void> {
    if (this.lastCountdownPlayed === secondsRemaining) return;
    this.lastCountdownPlayed = secondsRemaining;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (secondsRemaining > 0 && secondsRemaining <= 10) {
      this.speak(String(secondsRemaining));
    }
  }

  async playSessionComplete(): Promise<void> {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(async () => {
        try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }, 200);
    } catch {}
    this.speak('Session complete. Amazing work today!');
  }

  playHalfway(): void {
    this.speak('Halfway there. Keep pushing!');
  }

  async playPause(): Promise<void> {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  }

  async playResume(): Promise<void> {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  }

  reset(): void {
    this.lastCountdownPlayed = 0;
    Speech.stop();
  }
}

export const sessionCueService = new SessionCueService();
