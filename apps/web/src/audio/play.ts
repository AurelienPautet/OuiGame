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

/** Mirror the user's "Sound effects" setting onto the shared bus. */
export function setAudioEnabled(enabled: boolean): void {
  audioBus.setEnabled(enabled);
}
