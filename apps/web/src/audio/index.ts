// Procedural audio: one shared Web Audio bus, a small synth, and a palette of
// named sounds. Nothing here loads an audio file.
export { audioBus } from "./AudioBus";
export { playSfx, setAudioEnabled } from "./play";
export { ui } from "./ui";
export type { VoiceName } from "./voices";
