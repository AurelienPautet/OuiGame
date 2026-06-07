/**
 * AudioBus — the single shared Web Audio graph for the whole app.
 *
 * Every sound (the in-game SoundManager *and* the menu/UI click layer) routes
 * through this one bus, so there is exactly one AudioContext (browsers cap how
 * many you may open) and one master gain that the "Sound effects" setting mutes.
 *
 * The context is created lazily on first use and starts suspended until a user
 * gesture; `resume()` — called from every click/keypress play path — unlocks it.
 */
type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

class AudioBus {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Mirrors the user's "Sound effects" setting; gates all playback. */
  enabled = true;
  /** Master level when enabled. Disabling ramps this to 0. */
  private readonly volume = 0.85;

  /** The shared context, created on first access (null in non-browser envs). */
  get ctx(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = this.enabled ? this.volume : 0;
    master.connect(ctx.destination);
    this.context = ctx;
    this.master = master;
    return ctx;
  }

  /** The node every voice connects to (the master gain). Null if unsupported. */
  get out(): GainNode | null {
    return this.ctx ? this.master : null;
  }

  /** Resume the context after a user gesture (no-op once running). */
  resume(): void {
    const ctx = this.ctx;
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  /** Mute/unmute everything with a short ramp (driven by the sound setting). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(
      enabled ? this.volume : 0,
      t + 0.04
    );
  }
}

export const audioBus = new AudioBus();
