const STORAGE_KEY = 'earth_emds_sound_enabled';

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return win.AudioContext || win.webkitAudioContext || null;
}

export class SoundFX {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    this.enabled = this.readInitialPreference();
  }

  private readInitialPreference(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) return true;
      return raw !== 'false';
    } catch {
      return true;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(enabled));
      } catch {
        // Ignore storage write errors in restricted contexts
      }
    }
    if (enabled) {
      this.playFilter();
    }
  }

  public toggle(): boolean {
    const next = !this.enabled;
    this.setEnabled(next);
    return next;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const Ctor = getAudioContextConstructor();
        if (!Ctor) return null;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
        void this.ctx.resume().catch(() => {
          // Graceful no-op if browser blocks autoplay before gesture
        });
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Subtle futuristic harmonic dual-tone chime (520Hz -> 780Hz sine/triangle envelope, 90ms)
   */
  public playSelect(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(520, now);
      osc1.frequency.exponentialRampToValueAtTime(780, now + 0.09);

      osc2.frequency.setValueAtTime(780, now);
      osc2.frequency.exponentialRampToValueAtTime(1040, now + 0.09);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.095);
      osc2.stop(now + 0.095);
    } catch {
      // Ignore synthesis errors
    }
  }

  /**
   * Soft tactile click (320Hz short sine blip, 35ms)
   */
  public playFilter(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.035);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Ignore synthesis errors
    }
  }

  /**
   * Gentle upward frequency sweep (240Hz -> 440Hz, 110ms)
   */
  public playDrawerOpen(): void {
    this.playSweep(240, 440, 0.11);
  }

  /**
   * Gentle downward frequency sweep (440Hz -> 240Hz, 110ms)
   */
  public playDrawerClose(): void {
    this.playSweep(440, 240, 0.11);
  }

  private playSweep(startFreq: number, endFreq: number, durationSec: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + durationSec);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + durationSec + 0.01);
    } catch {
      // Ignore synthesis errors
    }
  }

  /**
   * Soft sonar radar ping (880Hz with gentle decay, 180ms)
   */
  public playSyncPing(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.065, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.185);
    } catch {
      // Ignore synthesis errors
    }
  }
}

export const soundFx = new SoundFX();
