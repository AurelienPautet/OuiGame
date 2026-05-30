/**
 * Minimal web-local ambient types for howler.js — the package ships no bundled
 * .d.ts and @types/howler is not installed. This declares only the slice
 * SoundManager touches (Howl instances + the global Howler AudioContext).
 */
declare module "howler" {
  export interface HowlOptions {
    src: string[];
    volume?: number;
    pool?: number;
    loop?: boolean;
    autoplay?: boolean;
    [key: string]: unknown;
  }

  export class Howl {
    constructor(options: HowlOptions);
    play(spriteOrId?: string | number): number;
    rate(rate: number, id?: number): this;
    volume(volume?: number, id?: number): number | this;
    stop(id?: number): this;
    unload(): void;
  }

  export const Howler: {
    ctx: AudioContext | null;
    [key: string]: unknown;
  };
}
