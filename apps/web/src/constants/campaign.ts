// Campaign run rules, shared by GameContext (the run state machine) and
// GameCanvas (the between-level screen) so the logic can't drift.
export const STARTING_LIVES: number = 3;
export const LIFE_EVERY: number = 5; // gain a life after clearing every Nth level
