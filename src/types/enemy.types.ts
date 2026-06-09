/**
 * Enemy type definitions
 */
import type { CharacterStats, HitboxConfig } from './game.types';
import type { EntityState } from './game.types';

/** Enemy categories */
export enum EnemyCategory {
  SMALL = 'small',
  ELITE = 'elite',
  BOSS = 'boss',
}

/** Enemy types */
export enum EnemyType {
  // Small enemies
  SLIME = 'slime',
  BAT = 'bat',
  GOBLIN = 'goblin',
  // Elite enemies
  ORC_WARRIOR = 'orc_warrior',
  DARK_KNIGHT = 'dark_knight',
  // Bosses
  ANCIENT_KNIGHT = 'ancient_knight',
  DEMON_LORD = 'demon_lord',
}

/** Enemy configuration */
export interface EnemyConfig {
  type: EnemyType;
  category: EnemyCategory;
  name: string;
  stats: CharacterStats;
  detectionRange: number;
  attackRange: number;
  patrolRange: number;
  expReward: number;
  goldReward: number;
  scoreValue: number;
  hitbox: HitboxConfig;
  drops?: EnemyDrop[];
}

/** Enemy loot drop definition */
export interface EnemyDrop {
  itemId: string;
  chance: number; // 0-1
  minQuantity: number;
  maxQuantity: number;
}

/** Boss phase configuration */
export interface BossPhase {
  phaseNumber: number;
  hpThreshold: number; // percentage (e.g., 0.5 = 50%)
  attackPatterns: BossAttackPattern[];
  moveSpeed: number;
  attackSpeed: number;
}

/** Boss attack pattern */
export interface BossAttackPattern {
  name: string;
  damage: number;
  cooldown: number;
  range: number;
  duration: number;
  animationKey: string;
}

/** Boss configuration extends enemy config */
export interface BossConfig extends EnemyConfig {
  phases: BossPhase[];
  introDialogue?: string;
}
