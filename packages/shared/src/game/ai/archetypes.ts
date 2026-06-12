import type { Size } from "../types.js";

// The v2 bot personality table. Every behavioural difference between bot kinds
// is DATA in this file — the brain (PR2) reads these numbers and contains no
// per-kind branches, so a new kind is a new row (+ a level spawn cell), not new
// code. Kinds map to the same level cells / colors as the legacy system
// (11→bot1 … 14→bot4); the Wii Play Tanks! roster is the tuning reference.

export type AIBotKind = "bot1" | "bot2" | "bot3" | "bot4" | "bot5" | "bot6";

// Player-chassis overrides applied in the AIBot constructor. These mirror the
// legacy BOT_CONFIGS chassis values kind-for-kind so a v2 bot *shoots the same
// bullets* as its legacy counterpart — only the brain differs.
export interface ArchetypeChassis {
  canMove: boolean;
  mvtspeed: number; // px/s
  shoot_speed: number; // bullet px/s
  shoot_max_bounce: number; // bullet dies ON this wall contact ⇒ usable banks = this − 1
  bullet_type: number;
  bullet_size: Size;
  max_bulletcount: number;
  max_minecount: number;
}

// Brain tuning. Units: ticks are 60 Hz fixed steps, angles rad, distances px.
export interface ArchetypeAI {
  thinkPeriod: number; // ticks between full decision passes (staggered per bot)
  turretSlewRadS: number; // turret rotation speed, rad/s
  cooldownTicks: number; // min ticks between shots
  reactionTicks: number; // min ticks a firing solution must be held before firing
  aimTolRad: number; // max |turret − solution| angle to release a shot
  leadFactor: number; // 0 = aim at current pos, 1 = full intercept lead
  aimSigmaRad: number; // gaussian aim error, sampled once per shot
  maxPlanBounces: number; // wall bounces the planner may use (≤ shoot_max_bounce − 1)
  fanRays: number; // exact bounce rays per think for multi-bounce discovery
  unfoldBudget: number; // max analytic 1-bounce mirror candidates validated per think
  minQuality: number; // base shot-quality gate
  // How much each bullet already in flight raises the bar. Interacts with
  // max_bulletcount: keep minQuality + (max-1)*qualityPerBullet under the
  // ~1.15 quality ceiling or the last shots become unreachable.
  qualityPerBullet: number;
  bandMinPx: number; // preferred engagement range band (movers; 0/0 = unused)
  bandMaxPx: number;
  dodgeSkill: number; // 0..1 scales bullet-threat urgency (0 = never dodges)
  threatHorizonS: number; // how far ahead (s) bullet CPA threats are projected
  bounceAwareDodge: boolean; // also dodge the post-ricochet continuation of bullets
  minesEnabled: boolean; // stationary kinds must keep this false (5 s fuse, 90 px blast)
  mineCooldownTicks: number;
  chokeP: number; // probability of planting at a chokepoint on the target's path
  fleeDropP: number; // probability of dropping a mine while fleeing a pursuer
  breachEnabled: boolean; // may mine type-2 walls open when no path to the target exists
  idleScanRadS: number; // turret sweep speed with no target/solution
}

export interface Archetype {
  chassis: ArchetypeChassis;
  ai: ArchetypeAI;
}

// Initial tuning (refined against the PR3 capability sims). Roles:
//   bot1 (blue)   stationary ricochet sentry — forgiving: slow turret, partial lead
//   bot2 (green)  aggressive presser — closes to mid range, strafes, light mines
//   bot3 (orange) kiting sniper — 600 px/s direct shots, strong dodge, full-ish lead
//   bot4 (red)    stationary ricochet master — fast turret, full lead, deadly precise
//   bot5 (yellow) miner — no gun at all; fast, mine-obsessed area denial (Wii yellow)
//   bot6 (purple) hunter — fast closer with 5 bullets + mines, corners the player
export const ARCHETYPES: Record<AIBotKind, Archetype> = {
  bot1: {
    chassis: {
      canMove: false,
      mvtspeed: 180,
      shoot_speed: 300,
      shoot_max_bounce: 3,
      bullet_type: 1,
      bullet_size: { w: 15, h: 15 },
      max_bulletcount: 3,
      max_minecount: 0,
    },
    ai: {
      thinkPeriod: 10,
      turretSlewRadS: 1.6,
      cooldownTicks: 120,
      reactionTicks: 18,
      aimTolRad: 0.08,
      leadFactor: 0.35,
      aimSigmaRad: 0.05,
      maxPlanBounces: 2,
      fanRays: 6,
      unfoldBudget: 6,
      // Sentries take low-priority long shots (300 px/s across a big map
      // lives on the distance-floor side of the quality formula).
      minQuality: 0.15,
      qualityPerBullet: 0.25,
      bandMinPx: 0,
      bandMaxPx: 0,
      dodgeSkill: 0,
      threatHorizonS: 0,
      bounceAwareDodge: false,
      minesEnabled: false,
      mineCooldownTicks: 0,
      chokeP: 0,
      fleeDropP: 0,
      breachEnabled: false,
      idleScanRadS: 0.6,
    },
  },
  bot2: {
    chassis: {
      canMove: true,
      mvtspeed: 180,
      shoot_speed: 300,
      shoot_max_bounce: 3,
      bullet_type: 1,
      bullet_size: { w: 15, h: 15 },
      max_bulletcount: 3,
      max_minecount: 2,
    },
    ai: {
      thinkPeriod: 6,
      turretSlewRadS: 2.4,
      cooldownTicks: 45,
      reactionTicks: 10,
      aimTolRad: 0.1,
      leadFactor: 0.55,
      aimSigmaRad: 0.06,
      maxPlanBounces: 1,
      fanRays: 0,
      unfoldBudget: 4,
      minQuality: 0.2,
      qualityPerBullet: 0.25,
      bandMinPx: 170,
      bandMaxPx: 320,
      dodgeSkill: 0.5,
      threatHorizonS: 0.7,
      bounceAwareDodge: false,
      minesEnabled: true,
      mineCooldownTicks: 600,
      chokeP: 0.1,
      fleeDropP: 0.2,
      breachEnabled: false,
      idleScanRadS: 0.8,
    },
  },
  bot3: {
    chassis: {
      canMove: true,
      mvtspeed: 180,
      shoot_speed: 600,
      shoot_max_bounce: 1,
      bullet_type: 2,
      bullet_size: { w: 15, h: 15 },
      max_bulletcount: 3,
      max_minecount: 2,
    },
    ai: {
      thinkPeriod: 6,
      turretSlewRadS: 3.2,
      cooldownTicks: 70,
      reactionTicks: 8,
      aimTolRad: 0.05,
      leadFactor: 0.9,
      aimSigmaRad: 0.025,
      maxPlanBounces: 0,
      fanRays: 0,
      unfoldBudget: 0,
      minQuality: 0.45,
      qualityPerBullet: 0.25,
      bandMinPx: 330,
      bandMaxPx: 520,
      dodgeSkill: 0.95,
      threatHorizonS: 0.9,
      bounceAwareDodge: true,
      minesEnabled: true,
      mineCooldownTicks: 450,
      chokeP: 0.2,
      fleeDropP: 0.35,
      breachEnabled: true,
      idleScanRadS: 0.8,
    },
  },
  bot4: {
    chassis: {
      canMove: false,
      mvtspeed: 180,
      shoot_speed: 600,
      shoot_max_bounce: 3,
      bullet_type: 2,
      bullet_size: { w: 20, h: 20 },
      max_bulletcount: 3,
      max_minecount: 0,
    },
    ai: {
      thinkPeriod: 6,
      turretSlewRadS: 4.5,
      cooldownTicks: 55,
      reactionTicks: 5,
      aimTolRad: 0.03,
      leadFactor: 1.0,
      aimSigmaRad: 0.012,
      maxPlanBounces: 2,
      fanRays: 10,
      unfoldBudget: 10,
      minQuality: 0.35,
      qualityPerBullet: 0.25,
      bandMinPx: 0,
      bandMaxPx: 0,
      dodgeSkill: 0,
      threatHorizonS: 0,
      bounceAwareDodge: false,
      minesEnabled: false,
      mineCooldownTicks: 0,
      chokeP: 0,
      fleeDropP: 0,
      breachEnabled: false,
      idleScanRadS: 0.6,
    },
  },
  bot5: {
    chassis: {
      canMove: true,
      mvtspeed: 200, // slightly faster than players: hard to corner
      shoot_speed: 300,
      shoot_max_bounce: 3,
      bullet_type: 1,
      bullet_size: { w: 15, h: 15 },
      max_bulletcount: 0, // NO gun — the fire gate (bulletcount < max) never opens
      max_minecount: 4,
    },
    ai: {
      thinkPeriod: 8,
      turretSlewRadS: 2.0,
      cooldownTicks: 0,
      reactionTicks: 0,
      aimTolRad: 0,
      leadFactor: 0,
      aimSigmaRad: 0,
      maxPlanBounces: 0,
      fanRays: 0,
      unfoldBudget: 0,
      minQuality: 1,
      qualityPerBullet: 0,
      // Keeps a respectful middle distance while it seeds the arena.
      bandMinPx: 250,
      bandMaxPx: 450,
      dodgeSkill: 0.15, // Wii yellow mostly ignores bullets...
      threatHorizonS: 0.5,
      bounceAwareDodge: false,
      minesEnabled: true, // ...but lives for mines
      mineCooldownTicks: 240,
      chokeP: 0.6,
      fleeDropP: 0.5,
      breachEnabled: true,
      idleScanRadS: 0.8,
    },
  },
  bot6: {
    chassis: {
      canMove: true,
      mvtspeed: 210, // the fastest thing on the field
      shoot_speed: 300,
      shoot_max_bounce: 3,
      bullet_type: 1,
      bullet_size: { w: 15, h: 15 },
      max_bulletcount: 5, // player-grade magazine — sustained crossfire
      max_minecount: 2,
    },
    ai: {
      thinkPeriod: 6,
      turretSlewRadS: 3.0,
      cooldownTicks: 40,
      reactionTicks: 7,
      aimTolRad: 0.06,
      leadFactor: 0.85,
      aimSigmaRad: 0.03,
      maxPlanBounces: 1,
      fanRays: 4,
      unfoldBudget: 6,
      minQuality: 0.2,
      qualityPerBullet: 0.15,
      bandMinPx: 120, // corners the player at knife range
      bandMaxPx: 260,
      dodgeSkill: 0.7,
      threatHorizonS: 0.8,
      bounceAwareDodge: true,
      minesEnabled: true,
      mineCooldownTicks: 500,
      chokeP: 0.15,
      fleeDropP: 0.25,
      breachEnabled: false,
      idleScanRadS: 0.9,
    },
  },
};
