import { useEffect } from "react";
import { useGame } from "../contexts";
import {
  startMenuMusic,
  startGameMusic,
  stopMusic,
  unlockAudioOnGesture,
} from "../audio";

/**
 * Drives the adaptive soundtrack from React state: the calm menu/UI loop on the
 * menus, the in-game loop while a round is playing (the GameEngine feeds it the
 * intensity). Renders nothing.
 *
 * Music only becomes audible after the first user gesture unlocks the
 * AudioContext (browser autoplay policy) and honours the "Music" setting via
 * the shared bus.
 */
export function MusicController() {
  const { isPlaying } = useGame();

  useEffect(() => {
    if (isPlaying) startGameMusic();
    else startMenuMusic();
  }, [isPlaying]);

  // Unlock the AudioContext on the first user gesture anywhere on the page, so
  // the menu music (which emits no click sound of its own) starts as soon as
  // the user interacts — not only once they hit a sound-emitting control.
  useEffect(() => unlockAudioOnGesture(), []);

  // Stop the loop when the app unmounts.
  useEffect(() => () => stopMusic(), []);

  return null;
}
