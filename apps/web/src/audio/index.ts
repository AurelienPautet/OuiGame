// Procedural audio: one shared Web Audio bus, a small synth, a palette of named
// sounds, and an adaptive soundtrack. Nothing here loads an audio file.
export { audioBus } from "./AudioBus";
export { playSfx, setAudioEnabled, setMusicEnabled } from "./play";
export { ui } from "./ui";
export {
  startMenuMusic,
  startGameMusic,
  stopMusic,
  setMusicIntensity,
} from "./music";
export type { VoiceName } from "./voices";
