/**
 * Alarm Sound Synthesizer & Player using Web Audio API + HTML5 Audio
 * Supports built-in synthesized alarm themes:
 * - 'chime': Harmonious dual-tone bell chime progression
 * - 'siren': Urgent alternating high-low pulsing alert
 * - 'radar': Sonar radar electronic ping
 * - 'marimba': Ascending gentle acoustic notes
 * - 'church': Deep ringing church bell
 * - 'custom': Custom uploaded user ringtone audio file
 */

import { AlarmSoundType } from '../types';

export interface SoundOption {
  id: AlarmSoundType;
  label: string;
  description: string;
  icon: string;
}

export const SOUND_OPTIONS: SoundOption[] = [
  { id: 'chime', label: 'Classic Chimes', description: 'Harmonic ringing bells (Default)', icon: '🔔' },
  { id: 'siren', label: 'Emergency Siren', description: 'Urgent pulsing high-low alarm', icon: '🚨' },
  { id: 'radar', label: 'Radar Sonar', description: 'Modern digital radar beep', icon: '📡' },
  { id: 'marimba', label: 'Morning Marimba', description: 'Melodic warm acoustic tones', icon: '🎵' },
  { id: 'church', label: 'Church Bell', description: 'Deep resonant bronze bell toll', icon: '⛪' },
  { id: 'custom', label: 'Custom Uploaded', description: 'User-uploaded audio ringtone', icon: '📁' },
];

class AlarmAudioSynthesizer {
  private audioCtx: AudioContext | null = null;
  private isRinging: boolean = false;
  private loopIntervalId: number | null = null;
  private masterVolume: number = 0.8;
  private customAudioEl: HTMLAudioElement | null = null;

  private initContext() {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  /**
   * Unlock AudioContext on any first user interaction (click, touch, keydown)
   */
  public unlockAudio() {
    this.initContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  /**
   * Plays classic 4-chord bell chime burst
   */
  public playChimeBurst() {
    this.initContext();
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const tones = [
      { freq1: 659.25, freq2: 1318.5, start: 0.0, dur: 0.28 }, // E5
      { freq1: 880.0, freq2: 1760.0, start: 0.22, dur: 0.28 }, // A5
      { freq1: 987.77, freq2: 1975.5, start: 0.44, dur: 0.32 }, // B5
      { freq1: 1318.5, freq2: 2637.0, start: 0.68, dur: 0.55 }, // E6
    ];

    tones.forEach((tone) => {
      const startTime = now + tone.start;
      const stopTime = startTime + tone.dur;
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(tone.freq1, startTime);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(tone.freq2, startTime);

      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.001, startTime);
      noteGain.gain.exponentialRampToValueAtTime(this.masterVolume * 0.35, startTime + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

      osc1.connect(noteGain);
      osc2.connect(noteGain);
      noteGain.connect(ctx.destination);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(stopTime);
      osc2.stop(stopTime);
    });
  }

  /**
   * Plays urgent emergency siren pulses
   */
  public playSirenBurst() {
    this.initContext();
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';

    // Modulate pitch up and down like emergency siren
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.linearRampToValueAtTime(1100, now + 0.3);
    osc.frequency.linearRampToValueAtTime(700, now + 0.6);
    osc.frequency.linearRampToValueAtTime(1100, now + 0.9);
    osc.frequency.linearRampToValueAtTime(700, now + 1.2);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(this.masterVolume * 0.28, now + 0.05);
    gain.gain.setValueAtTime(this.masterVolume * 0.28, now + 1.15);
    gain.gain.linearRampToValueAtTime(0.001, now + 1.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.35);
  }

  /**
   * Plays sonar radar double-ping
   */
  public playRadarBurst() {
    this.initContext();
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    [0, 0.25].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1480, now + offset);
      osc.frequency.exponentialRampToValueAtTime(1020, now + offset + 0.22);

      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.exponentialRampToValueAtTime(this.masterVolume * 0.4, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + offset);
      osc.stop(now + offset + 0.25);
    });
  }

  /**
   * Plays warm marimba chord sequence
   */
  public playMarimbaBurst() {
    this.initContext();
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const notes = [
      { f: 523.25, t: 0.0 }, // C5
      { f: 659.25, t: 0.12 }, // E5
      { f: 783.99, t: 0.24 }, // G5
      { f: 1046.5, t: 0.36 }, // C6
    ];

    notes.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + t);

      gain.gain.setValueAtTime(0.001, now + t);
      gain.gain.exponentialRampToValueAtTime(this.masterVolume * 0.45, now + t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + t);
      osc.stop(now + t + 0.42);
    });
  }

  /**
   * Plays resonant deep church bell toll
   */
  public playChurchBellBurst() {
    this.initContext();
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const baseFreq = 440; // A4 church bell strike
    const harmonics = [1, 2.02, 2.8, 4.15];

    harmonics.forEach((h, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(baseFreq * h, now);

      const amp = (this.masterVolume * 0.35) / (idx + 1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(amp, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.65);
    });
  }

  /**
   * Play single burst based on sound type
   */
  public playSoundBurst(soundType: AlarmSoundType = 'chime', customDataUri?: string) {
    if (soundType === 'custom' && customDataUri) {
      this.playCustomAudioOnce(customDataUri);
      return;
    }

    switch (soundType) {
      case 'siren':
        this.playSirenBurst();
        break;
      case 'radar':
        this.playRadarBurst();
        break;
      case 'marimba':
        this.playMarimbaBurst();
        break;
      case 'church':
        this.playChurchBellBurst();
        break;
      case 'chime':
      default:
        this.playChimeBurst();
        break;
    }
  }

  private playCustomAudioOnce(dataUri: string) {
    try {
      const audio = new Audio(dataUri);
      audio.volume = this.masterVolume;
      audio.play().catch((e) => console.warn('Custom audio playback error:', e));
    } catch (err) {
      console.warn('Audio tag error:', err);
    }
  }

  /**
   * Start looping the alarm sequence with chosen sound type
   */
  public startRinging(soundType: AlarmSoundType = 'chime', customDataUri?: string) {
    if (this.isRinging) return;
    this.isRinging = true;

    if (soundType === 'custom' && customDataUri) {
      try {
        if (!this.customAudioEl) {
          this.customAudioEl = new Audio(customDataUri);
          this.customAudioEl.loop = true;
        } else {
          this.customAudioEl.src = customDataUri;
          this.customAudioEl.loop = true;
        }
        this.customAudioEl.volume = this.masterVolume;
        this.customAudioEl.play().catch(() => {
          // If custom fails, fallback to chime synth
          this.playChimeBurst();
        });
        return;
      } catch (e) {
        console.warn('Fallback to chime on custom audio error', e);
      }
    }

    // Interval duration per sound theme
    const intervalMap: Record<string, number> = {
      chime: 1800,
      siren: 1600,
      radar: 1200,
      marimba: 1500,
      church: 2200,
    };
    const interval = intervalMap[soundType] || 1800;

    this.playSoundBurst(soundType, customDataUri);
    this.loopIntervalId = window.setInterval(() => {
      if (this.isRinging) {
        this.playSoundBurst(soundType, customDataUri);
      }
    }, interval);
  }

  /**
   * Stop ringing completely
   */
  public stopRinging() {
    this.isRinging = false;
    if (this.loopIntervalId !== null) {
      clearInterval(this.loopIntervalId);
      this.loopIntervalId = null;
    }
    if (this.customAudioEl) {
      try {
        this.customAudioEl.pause();
        this.customAudioEl.currentTime = 0;
      } catch {
        // ignore pause errors
      }
    }
  }

  public getIsRinging(): boolean {
    return this.isRinging;
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.customAudioEl) {
      this.customAudioEl.volume = this.masterVolume;
    }
  }

  public isAudioBlocked(): boolean {
    return Boolean(this.audioCtx && this.audioCtx.state === 'suspended');
  }

  public getVolume(): number {
    return this.masterVolume;
  }
}

export const alarmAudio = new AlarmAudioSynthesizer();
