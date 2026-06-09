/**
 * Goblin — Elite enemy with shield, faster chase speed, and dodge ability.
 *
 * Uses the 'enemy-goblin' placeholder texture (orange square).
 * Has a chase speed multiplier so it moves faster when pursuing the player.
 */
import Phaser from 'phaser';
import { EnemyCategory, EnemyType } from '../../../types/enemy.types';
import type { EnemyConfig } from '../../../types/enemy.types';
import { Enemy } from './Enemy';
import {
  ENEMY_GOBLIN_STATS,
  GOBLIN_DETECTION_RANGE,
  GOBLIN_ATTACK_RANGE,
  GOBLIN_PATROL_RANGE,
  GOBLIN_EXP_REWARD,
  GOBLIN_GOLD_REWARD,
  GOBLIN_SHIELD,
  GOBLIN_CHASE_SPEED_MULT,
  GOBLIN_SCORE_VALUE,
} from '../../utils/Constants';

const GOBLIN_CONFIG: EnemyConfig = {
  type: EnemyType.GOBLIN,
  category: EnemyCategory.ELITE,
  name: 'Goblin Elite',
  stats: { ...ENEMY_GOBLIN_STATS },
  detectionRange: GOBLIN_DETECTION_RANGE,
  attackRange: GOBLIN_ATTACK_RANGE,
  patrolRange: GOBLIN_PATROL_RANGE,
  expReward: GOBLIN_EXP_REWARD,
  goldReward: GOBLIN_GOLD_REWARD,
  scoreValue: GOBLIN_SCORE_VALUE,
  hitbox: {
    offsetX: 2,
    offsetY: 2,
    width: 24,
    height: 32,
  },
};

export class Goblin extends Enemy {
  /** Chase speed multiplier — Goblin moves faster when chasing */
  public readonly chaseSpeedMult: number = GOBLIN_CHASE_SPEED_MULT;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy-goblin', GOBLIN_CONFIG);
    this.maxShield = GOBLIN_SHIELD;
    this.shield = GOBLIN_SHIELD;
  }
}
