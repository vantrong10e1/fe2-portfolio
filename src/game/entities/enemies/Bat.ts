/**
 * Bat — Fast-flying small enemy with swooping attack.
 *
 * Uses the 'enemy-bat' placeholder texture (purple square).
 * Bat has no gravity — it hovers at spawn Y and swoops toward the player.
 */
import Phaser from 'phaser';
import { EnemyCategory, EnemyType } from '../../../types/enemy.types';
import type { EnemyConfig } from '../../../types/enemy.types';
import { Enemy } from './Enemy';
import {
  ENEMY_BAT_STATS,
  BAT_DETECTION_RANGE,
  BAT_ATTACK_RANGE,
  BAT_PATROL_RANGE,
  BAT_EXP_REWARD,
  BAT_GOLD_REWARD,
  BAT_SCORE_VALUE,
} from '../../utils/Constants';

const BAT_CONFIG: EnemyConfig = {
  type: EnemyType.BAT,
  category: EnemyCategory.SMALL,
  name: 'Shadow Bat',
  stats: { ...ENEMY_BAT_STATS },
  detectionRange: BAT_DETECTION_RANGE,
  attackRange: BAT_ATTACK_RANGE,
  patrolRange: BAT_PATROL_RANGE,
  expReward: BAT_EXP_REWARD,
  goldReward: BAT_GOLD_REWARD,
  scoreValue: BAT_SCORE_VALUE,
  hitbox: {
    offsetX: 2,
    offsetY: 2,
    width: 20,
    height: 20,
  },
};

export class Bat extends Enemy {
  /** Bat ignores gravity — hovers in the air */
  public readonly isFlying: boolean = true;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy-bat', BAT_CONFIG);

    // Disable gravity for flying
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
  }
}
