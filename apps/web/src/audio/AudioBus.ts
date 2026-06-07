/**
 * AudioBus — the single shared Web Audio graph for the whole app.
 *
 * Everything routes through this one context (browsers cap how many you may
 * open). Below the master gain sit two independently-levelled sub-buses:
 *   • sfx   — the in-game SoundManager + the menu/UI click layer ("Sound effects")
 *   • music — the adaptive soundtrack ("Music")
 *
 * Their gains track the user's volume sliders (0 = muted). The context is
 * created lazily on first use and starts suspended until a user gesture;
 * `resume()` — called from every click/keypress play path — unlocks it.
 */
type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

class AudioBus {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  /** Current sub-bus levels (0..1), tracking the volume sliders. */
  private sfxLevel = 0.8;
  private musicLevel = 0.3;

  /** True when SFX would be audible — lets `playSfx` skip work when muted. */
  get enabled(): boolean {
    return this.sfxLevel > 0.0001;
  }

  /** The shared context, created on first access (null in non-browser envs). */
  get ctx(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    const sfx = ctx.createGain();
    sfx.gain.value = this.sfxLevel;
    sfx.connect(master);
    const music = ctx.createGain();
    music.gain.value = this.musicLevel;
    // Gentle low-pass to round off the soundtrack — warm and soft rather than
    // bright/8-bit.
    const warmth = ctx.createBiquadFilter();
    warmth.type = "lowpass";
    warmth.frequency.value = 2600;
    warmth.Q.value = 0.4;
    music.connect(warmth);
    warmth.connect(master);
    this.context = ctx;
    this.master = master;
    this.sfx = sfx;
    this.music = music;
    return ctx;
  }

  /** SFX destination (game sounds + UI clicks). Null if unsupported. */
  get out(): GainNode | null {
    return this.ctx ? this.sfx : null;
  }

  /** Music destination (the adaptive soundtrack). Null if unsupported. */
  get musicOut(): GainNode | null {
    return this.ctx ? this.music : null;
  }

  /** Resume the context after a user gesture (no-op once running). */
  resume(): void {
    const ctx = this.ctx;
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  /** Set the SFX volume (0..1), ramped to avoid clicks. */
  setSfxVolume(v: number): void {
    this.sfxLevel = clamp01(v);
    this.ramp(this.sfx, this.sfxLevel);
  }

  /** Set the music volume (0..1), ramped to avoid clicks. */
  setMusicVolume(v: number): void {
    this.musicLevel = clamp01(v);
    this.ramp(this.music, this.musicLevel);
  }

  private ramp(node: GainNode | null, target: number): void {
    if (!node || !this.context) return;
    const t = this.context.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(node.gain.value, t);
    node.gain.linearRampToValueAtTime(target, t + 0.04);
  }
}

export const audioBus = new AudioBus();
