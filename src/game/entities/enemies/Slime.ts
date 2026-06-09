/**
 * Slime — Small enemy with simple patrol/chase/melee behaviour.
 *
 * Stats and tuning values come from Constants.ts.
 * Uses the 'enemy-slime' placeholder texture (green square).
 */
import Phaser from 'phaser';
import { EnemyCategory, EnemyType } from '../../../types/enemy.types';
import type { EnemyConfig } from '../../../types/enemy.types';
import { Enemy } from './Enemy';
import {
  ENEMY_SLIME_STATS,
  SLIME_DETECTION_RANGE,
  SLIME_ATTACK_RANGE,
  SLIME_PATROL_RANGE,
  SLIME_EXP_REWARD,
  SLIME_GOLD_REWARD,
  SLIME_SCORE_VALUE,
} from '../../utils/Constants';

/** Static config for all Slime instances */
const SLIME_CONFIG: EnemyConfig = {
  type: EnemyType.SLIME,
  category: EnemyCategory.SMALL,
  name: 'Green Slime',
  stats: { ...ENEMY_SLIME_STATS },
  detectionRange: SLIME_DETECTION_RANGE,
  attackRange: SLIME_ATTACK_RANGE,
  patrolRange: SLIME_PATROL_RANGE,
  expReward: SLIME_EXP_REWARD,
  goldReward: SLIME_GOLD_REWARD,
  scoreValue: SLIME_SCORE_VALUE,
  hitbox: {
    offsetX: 4,
    offsetY: 4,
    width: 24,
    height: 24,
  },
};

export class Slime extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy-slime', SLIME_CONFIG);
  }
}
