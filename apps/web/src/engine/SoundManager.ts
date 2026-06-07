/**
 * SoundManager — plays the in-game sound effects.
 *
 * Sounds are synthesised on the fly (Web Audio oscillators + filtered noise via
 * `../audio`), so there are no audio files to download or decode. Everything
 * routes through the shared `audioBus`; the SFX volume (and mute) is owned
 * globally by the bus / settings, not per-manager.
 */
import { audioBus, playSfx } from "../audio";

export interface SoundEvents {
  shoot?: boolean;
  kill?: boolean;
  explose?: boolean;
  plant?: boolean;
  ricochet?: boolean;
}

export class SoundManager {
  // Play sounds based on game events.
  playSounds(soundEvents?: SoundEvents | null) {
    if (!soundEvents) return;
    if (soundEvents.shoot) playSfx("shoot");
    if (soundEvents.kill) playSfx("kill");
    if (soundEvents.explose) playSfx("explose");
    if (soundEvents.plant) playSfx("plant");
    if (soundEvents.ricochet) playSfx("ricochet");
  }

  // Play the fuse tick for a mine about to explode.
  playFuse() {
    playSfx("fuse");
  }

  // Resume the AudioContext (required by browsers after a user interaction).
  resume() {
    audioBus.resume();
  }

  // Procedural voices schedule short-lived nodes that stop themselves, so there
  // is nothing to unload — kept for API parity with the old Howler manager.
  clear() {}
}
