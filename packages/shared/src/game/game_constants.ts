// Single source of truth for gameplay literals that BOTH the simulation and
// the v2 bot AI's world model depend on. Keep this module dependency-free
// (a leaf): Room/Player/Mine import it, and so does ai/constants.ts — a shared
// import is what guarantees a rebalance here changes the game AND the bots'
// predictions together instead of silently desynchronizing them.

// Tank chassis box (Player.size).
export const TANK_SIZE = 45;

// Bullets spawn this far (plus the bullet's own size) from the tank centre
// along the aim ray (Player.endofbarrel).
export const BARREL_LENGTH = 30;

// Mines: fixed fuse in 60 Hz ticks (Room.timetoeplode), blast radius in px
// (Room.mines_explsion_radius), and the visual/trigger disc radius (Mine.radius
// — bullets detonate a mine by touching this circle).
export const MINE_FUSE_TICKS = 300;
export const MINE_EXPLOSION_RADIUS = 90;
export const MINE_TRIGGER_RADIUS = 15;
