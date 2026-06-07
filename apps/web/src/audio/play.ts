import { audioBus } from "./AudioBus";
import { voices, type VoiceName } from "./voices";

/**
 * Play a named procedural sound. No-op when sound is disabled or Web Audio is
 * unavailable. Resumes the (gesture-locked) context on the way through, so the
 * first click in a session unlocks audio for everything after it.
 */
export function playSfx(name: VoiceName): void {
  if (!audioBus.enabled) return;
  audioBus.resume();
  voices[name]();
}

/** Set the sound-effects volume (0..1) on the shared bus. */
export function setSfxVolume(volume: number): void {
  audioBus.setSfxVolume(volume);
}

/** Set the music volume (0..1) on the shared bus. */
export function setMusicVolume(volume: number): void {
  audioBus.setMusicVolume(volume);
}
