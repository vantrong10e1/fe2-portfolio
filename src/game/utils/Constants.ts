/**
 * Constants - Central repository of game-wide magic numbers.
 */

// ── World ──────────────────────────────────────────────────────────────
export const TILE_SIZE = 32;
export const GRAVITY = 800;
export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 720;

// ── Player Defaults ────────────────────────────────────────────────────
export const PLAYER_SPEED = 260;
export const PLAYER_JUMP = -600;
export const PLAYER_DASH_SPEED = 400;
export const PLAYER_DASH_DURATION = 200;
export const PLAYER_ATTACK_DURATION = 300;
export const INVINCIBILITY_DURATION = 1000;

// ── Lifesteal ──────────────────────────────────────────────────────────
/** Percentage of melee damage healed back (0.1 = 10%) */
export const SWORD_LIFESTEAL_PERCENT = 0.1;

// ── Gun / Ranged ───────────────────────────────────────────────────────
export const BULLET_SPEED = 600;
export const BULLET_DAMAGE = 10;
export const BULLET_LIFETIME = 2000;
export const BULLET_MAX_RANGE = 750;
export const GUN_MAGAZINE_SIZE = 10;
export const GUN_CRITICAL_CHANCE = 0.4;
export const GUN_RELOAD_TIME = 1200;

// ── Skills ─────────────────────────────────────────────────────────────
export const SKILL_FIREBALL_DAMAGE = 40;
export const SKILL_FIREBALL_SPEED = 350;
export const SKILL_FIREBALL_MP_COST = 15;
export const SKILL_FIREBALL_COOLDOWN = 3000;

export const SKILL_SLOW_RADIUS = 180;
export const SKILL_SLOW_DURATION = 4000;
export const SKILL_SLOW_FACTOR = 0.3;
export const SKILL_SLOW_MP_COST = 20;
export const SKILL_SLOW_COOLDOWN = 8000;

export const SKILL_ULTIMATE_DAMAGE = 80;
export const SKILL_ULTIMATE_RADIUS = 250;
export const SKILL_ULTIMATE_MP_COST = 40;
export const SKILL_ULTIMATE_COOLDOWN = 20000;

export const SKILL_STUN_BLAST_DAMAGE = 20;
export const SKILL_STUN_BLAST_RADIUS = 120;
export const SKILL_STUN_BLAST_STUN_DURATION = 1500;
export const SKILL_STUN_BLAST_MP_COST = 10;
export const SKILL_STUN_BLAST_COOLDOWN = 5000;

// ── Dash ───────────────────────────────────────────────────────────────
export const DASH_COOLDOWN_SWORD = 1000;
export const DASH_COOLDOWN_GUN = 750;

// ── EXP / Leveling ─────────────────────────────────────────────────────
/** Base EXP required for level 2 */
export const EXP_BASE = 50;
/** EXP multiplier per level: required = EXP_BASE * level^EXP_EXPONENT */
export const EXP_EXPONENT = 1.4;
/** Stat increase per level */
export const LEVEL_HP_BONUS = 12;
export const LEVEL_MP_BONUS = 5;
export const LEVEL_ATK_BONUS = 3;
export const LEVEL_DEF_BONUS = 1;

// ── UI Colours ─────────────────────────────────────────────────────────
export const HP_COLOR = 0xe74c3c;
export const MP_COLOR = 0x3498db;
export const EXP_COLOR = 0xf39c12;

// ── Player Initial Stats ───────────────────────────────────────────────
export const PLAYER_INITIAL_STATS = {
  maxHp: 100,
  currentHp: 100,
  maxMp: 100,
  currentMp: 100,
  attack: 15,
  defense: 5,
  moveSpeed: PLAYER_SPEED,
  jumpForce: PLAYER_JUMP,
  criticalRate: 0.1,
  criticalDamage: 1.5,
} as const;

// ── Enemy Defaults ─────────────────────────────────────────────────────
export const ENEMY_SLIME_STATS = {
  maxHp: 30,
  currentHp: 30,
  maxMp: 0,
  currentMp: 0,
  attack: 8,
  defense: 2,
  moveSpeed: 60,
  jumpForce: 0,
  criticalRate: 0,
  criticalDamage: 1,
};

export const SLIME_DETECTION_RANGE = 150;
export const SLIME_ATTACK_RANGE = 30;
export const SLIME_PATROL_RANGE = 100;
export const SLIME_EXP_REWARD = 15;
export const SLIME_GOLD_REWARD = 5;
export const SLIME_SCORE_VALUE = 5;

export const ENEMY_GOBLIN_STATS = {
  maxHp: 100,
  currentHp: 100,
  maxMp: 0,
  currentMp: 0,
  attack: 16,
  defense: 6,
  moveSpeed: 80,
  jumpForce: 0,
  criticalRate: 0.1,
  criticalDamage: 1.5,
};

export const GOBLIN_DETECTION_RANGE = 200;
export const GOBLIN_ATTACK_RANGE = 40;
export const GOBLIN_PATROL_RANGE = 120;
export const GOBLIN_EXP_REWARD = 50;
export const GOBLIN_GOLD_REWARD = 20;
export const GOBLIN_SHIELD = 100;
export const GOBLIN_SCORE_VALUE = 15;
/** Goblin chase speed multiplier (faster when chasing) */
export const GOBLIN_CHASE_SPEED_MULT = 1.4;

export const ENEMY_BAT_STATS = {
  maxHp: 20,
  currentHp: 20,
  maxMp: 0,
  currentMp: 0,
  attack: 6,
  defense: 1,
  moveSpeed: 100,
  jumpForce: 0,
  criticalRate: 0.05,
  criticalDamage: 1.3,
};

export const BAT_DETECTION_RANGE = 200;
export const BAT_ATTACK_RANGE = 25;
export const BAT_PATROL_RANGE = 80;
export const BAT_EXP_REWARD = 10;
export const BAT_GOLD_REWARD = 3;
export const BAT_SCORE_VALUE = 3;

export const ENEMY_ATTACK_COOLDOWN = 1500;

/** Max distance from spawn before enemy leashes back */
export const ENEMY_LEASH_RANGE = 400;
