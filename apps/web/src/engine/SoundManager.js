/**
 * SoundManager - Handles audio playback for game sounds using Howler.js
 * Provides reliable cross-browser audio support
 */
import { Howl, Howler } from "howler";

export class SoundManager {
  constructor() {
    // Preload all sounds
    this.sounds = {
      tir: new Howl({
        src: ["ressources/sounds/tir.mp3"],
        volume: 0.5,
        pool: 10, // Allow 10 simultaneous instances
      }),
      kill: new Howl({
        src: ["ressources/sounds/kill.mp3"],
        volume: 0.6,
        pool: 10,
      }),
      explose: new Howl({
        src: ["ressources/sounds/eplose.mp3"],
        volume: 0.7,
        pool: 10,
      }),
      fuse: new Howl({
        src: ["ressources/sounds/fuse.mp3"],
        volume: 0.4,
        pool: 10,
      }),
      plant: new Howl({
        src: ["ressources/sounds/plant.mp3"],
        volume: 0.5,
        pool: 10,
      }),
      ricochet: new Howl({
        src: ["ressources/sounds/ricochet.mp3"],
        volume: 0.4,
        pool: 10,
      }),
    };

    this.contextResumed = false;
  }

  // Play a sound with optional rate variation for variety
  _play(soundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      const id = sound.play();
      // Add slight pitch variation for more natural sound
      sound.rate(0.9 + Math.random() * 0.2, id);
    }
  }

  // Play sounds based on game events
  playSounds(soundEvents) {
    if (!soundEvents) return;

    if (soundEvents.shoot) {
      this._play("tir");
    }
    if (soundEvents.kill) {
      this._play("kill");
    }
    if (soundEvents.explose) {
      this._play("explose");
    }
    if (soundEvents.plant) {
      this._play("plant");
    }
    if (soundEvents.ricochet) {
      this._play("ricochet");
    }
  }

  // Play fuse sound for mines about to explode
  playFuse() {
    this._play("fuse");
  }

  // Resume AudioContext (required by browsers after user interaction)
  resume() {
    if (!this.contextResumed) {
      // Howler.ctx is the global AudioContext
      if (Howler.ctx && Howler.ctx.state === "suspended") {
        Howler.ctx.resume().then(() => {
          console.log("AudioContext resumed");
          this.contextResumed = true;
        });
      } else {
        this.contextResumed = true;
      }
    }
  }

  // Stop all sounds and unload
  clear() {
    this.sounds.tir.unload();
    this.sounds.kill.unload();
    this.sounds.explose.unload();
    this.sounds.fuse.unload();
    this.sounds.plant.unload();
    this.sounds.ricochet.unload();
  }
}
