// Public surface of the v2 bot AI. Hosts and tests import from here (or via
// @ouigame/shared/game which re-exports this); the brain internals stay
// private to the ai/ directory.
export { AIBot } from "./AIBot.js";
export {
  ARCHETYPES,
  type AIBotKind,
  type Archetype,
  type ArchetypeAI,
  type ArchetypeChassis,
} from "./archetypes.js";
export { Rng, fnv1a } from "./rng.js";
export { STATE, type AIState } from "./brain.js";
