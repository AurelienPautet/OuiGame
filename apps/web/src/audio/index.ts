// Procedural audio: one shared Web Audio bus, a small synth, a palette of named
// sounds, and an adaptive soundtrack. Nothing here loads an audio file.
import { audioBus } from "./AudioBus";

export { audioBus } from "./AudioBus";
export { playSfx, setSfxVolume, setMusicVolume } from "./play";

/**
 * Install a one-time, page-wide gesture listener that unlocks the AudioContext
 * on the first interaction (so the menu music starts at the first click/keypress
 * anywhere, not only when a sound-emitting control is hit). Returns a teardown.
 */
export const unlockAudioOnGesture = (): (() => void) =>
  audioBus.unlockOnGesture();
export { ui } from "./ui";
export {
  startMenuMusic,
  startGameMusic,
  stopMusic,
  setMusicIntensity,
} from "./music";
export type { VoiceName } from "./voices";
