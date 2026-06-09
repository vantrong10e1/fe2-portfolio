/**
 * SkillSystem — Manages Q/E/F skills with cooldowns and MP costs.
 *
 * Q = Fireball (projectile)
 * E = Slow Field (AoE slow enemies)
 * F = Ultimate (AoE damage burst)
 */
import Phaser from 'phaser';
import { GameEvent } from '../../types/game.types';
import EventBus from '../EventBus';
import {
  SKILL_FIREBALL_DAMAGE, SKILL_FIREBALL_SPEED,
  SKILL_FIREBALL_MP_COST, SKILL_FIREBALL_COOLDOWN,
  SKILL_SLOW_RADIUS, SKILL_SLOW_DURATION,
  SKILL_SLOW_FACTOR, SKILL_SLOW_MP_COST, SKILL_SLOW_COOLDOWN,
  SKILL_ULTIMATE_DAMAGE, SKILL_ULTIMATE_RADIUS,
  SKILL_ULTIMATE_MP_COST, SKILL_ULTIMATE_COOLDOWN,
  SKILL_STUN_BLAST_DAMAGE, SKILL_STUN_BLAST_RADIUS,
  SKILL_STUN_BLAST_STUN_DURATION, SKILL_STUN_BLAST_MP_COST,
  SKILL_STUN_BLAST_COOLDOWN,
} from '../utils/Constants';

export interface SkillDef {
  id: string;
  name: string;
  key: string;
  mpCost: number;
  cooldown: number;
  damage: number;
}

export const SKILLS: Record<string, SkillDef> = {
  fireball: {
    id: 'fireball', name: 'Fireball', key: 'Q',
    mpCost: SKILL_FIREBALL_MP_COST, cooldown: SKILL_FIREBALL_COOLDOWN,
    damage: SKILL_FIREBALL_DAMAGE,
  },
  slow: {
    id: 'slow', name: 'Frost Nova', key: 'E',
    mpCost: SKILL_SLOW_MP_COST, cooldown: SKILL_SLOW_COOLDOWN,
    damage: 0,
  },
  ultimate: {
    id: 'ultimate', name: 'Shadow Burst', key: 'F',
    mpCost: SKILL_ULTIMATE_MP_COST, cooldown: SKILL_ULTIMATE_COOLDOWN,
    damage: SKILL_ULTIMATE_DAMAGE,
  },
  stun_blast: {
    id: 'stun_blast', name: 'Stun Blast', key: 'Q',
    mpCost: SKILL_STUN_BLAST_MP_COST, cooldown: SKILL_STUN_BLAST_COOLDOWN,
    damage: SKILL_STUN_BLAST_DAMAGE,
  },
};

export class SkillSystem {
  /** Skill ID → last use timestamp */
  private cooldownTimers: Map<string, number> = new Map();

  constructor() {
    // Initialize all cooldowns as ready (use negative value to ensure ready immediately at game start)
    for (const id of Object.keys(SKILLS)) {
      this.cooldownTimers.set(id, -999999);
    }
  }

  /** Whether the skill can be cast right now */
  canUse(skillId: string, currentMp: number, now: number, playerLevel: number = 1): boolean {
    const skill = SKILLS[skillId];
    if (!skill) return false;
    if (currentMp < skill.mpCost) return false;
    const lastUsed = this.cooldownTimers.get(skillId) ?? 0;
    let cd = skill.cooldown;
    if (playerLevel >= 10) {
      if (skillId === 'ultimate') {
        cd = 30000;
      } else {
        cd = skill.cooldown * 0.6;
      }
    }
    return now - lastUsed >= cd;
  }

  /** Mark a skill as used. Returns the SkillDef or null if not usable. */
  use(skillId: string, currentMp: number, now: number, playerLevel: number = 1): SkillDef | null {
    if (!this.canUse(skillId, currentMp, now, playerLevel)) return null;
    this.cooldownTimers.set(skillId, now);
    const skill = SKILLS[skillId]!;
    EventBus.emit(GameEvent.SKILL_USED, { id: skillId, name: skill.name });
    return skill;
  }

  /** Get remaining cooldown in ms (0 = ready) */
  getRemainingCooldown(skillId: string, now: number, playerLevel: number = 1): number {
    const skill = SKILLS[skillId];
    if (!skill) return 0;
    const lastUsed = this.cooldownTimers.get(skillId) ?? 0;
    let cd = skill.cooldown;
    if (playerLevel >= 10) {
      if (skillId === 'ultimate') {
        cd = 30000;
      } else {
        cd = skill.cooldown * 0.6;
      }
    }
    const remaining = cd - (now - lastUsed);
    return Math.max(0, remaining);
  }

  /** Get cooldown progress 0..1 (1 = ready, 0 = just used) */
  getCooldownProgress(skillId: string, now: number, playerLevel: number = 1): number {
    const skill = SKILLS[skillId];
    if (!skill) return 1;
    const remaining = this.getRemainingCooldown(skillId, now, playerLevel);
    let cd = skill.cooldown;
    if (playerLevel >= 10) {
      if (skillId === 'ultimate') {
        cd = 30000;
      } else {
        cd = skill.cooldown * 0.6;
      }
    }
    if (cd === 0) return 1;
    return 1 - remaining / cd;
  }

  // ── Skill Effect Helpers (called by GameScene) ─────────────────────

  /** Create a fireball projectile. Returns the sprite for collision wiring. */
  static createFireball(
    scene: Phaser.Scene, x: number, y: number, facingRight: boolean,
  ): Phaser.GameObjects.Rectangle {
    const dir = facingRight ? 1 : -1;
    const fb = scene.add.rectangle(x + 20 * dir, y, 16, 16, 0xff6600, 1);
    scene.physics.add.existing(fb);
    const body = fb.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityX(SKILL_FIREBALL_SPEED * dir);

    return fb;
  }

  /** Create a slow field visual + logic. Returns list of slowed enemies. */
  static createSlowField(
    scene: Phaser.Scene, x: number, y: number,
    enemies: Phaser.Physics.Arcade.Sprite[],
  ): void {
    const player = (scene as any).player;
    const isLevel10 = player && player.level >= 10;
    const isLevel9 = player && player.level >= 9;
    const radius = isLevel10 ? 400 : (isLevel9 ? 300 : SKILL_SLOW_RADIUS);
    const slowFactor = isLevel10 ? 0.1 : (isLevel9 ? 0.1 : SKILL_SLOW_FACTOR); // 0.1 means speed is 10% (slowed by 90%)
    const duration = isLevel10 ? 5000 : (isLevel9 ? 5000 : SKILL_SLOW_DURATION);

    // Register active slow field
    const activeField = { x, y, radius, level: player ? player.level : 1 };
    if ((scene as any).activeSlowFields) {
      (scene as any).activeSlowFields.push(activeField);
    }

    // Visual: expanding circle
    const circle = scene.add.circle(x, y, radius, 0x00bfff, 0.2);
    circle.setDepth(5);

    // Border
    const border = scene.add.graphics().setDepth(5);
    border.lineStyle(2, 0x00bfff, 0.6);
    border.strokeCircle(x, y, radius);

    // Apply slow to enemies in range
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist <= radius) {
        const e = enemy as any;
        e.skillSlowActive = true;
        e.skillSlowFactor = slowFactor;

        // Restore after duration
        scene.time.delayedCall(duration, () => {
          if (enemy.active) {
            e.skillSlowActive = false;
            e.skillSlowFactor = 1.0;
          }
        });
      }
    }

    // Clean up active field after duration
    scene.time.delayedCall(duration, () => {
      if ((scene as any).activeSlowFields) {
        const idx = (scene as any).activeSlowFields.indexOf(activeField);
        if (idx !== -1) {
          (scene as any).activeSlowFields.splice(idx, 1);
        }
      }
    });

    // Level 9+: Heal player 20 HP and 20 MP per second inside slow field (duration is 5s, so 5 ticks)
    if (isLevel9 && player) {
      scene.time.addEvent({
        delay: 1000,
        repeat: 4, // 5 ticks total: 1s, 2s, 3s, 4s, 5s
        callback: () => {
          if (player.active && !player.isDead) {
            const dist = Phaser.Math.Distance.Between(x, y, player.x, player.y);
            if (dist <= radius) {
              player.healHp(20);
              player.restoreMp(20);
              if (scene.cameras && scene.cameras.main) {
                // Flash green numbers or show heal particles
                if ((scene as any).effectsSystem) {
                  (scene as any).effectsSystem.itemPickup(player.x, player.y);
                }
              }
            }
          }
        }
      });
    }

    // Fade out visual
    scene.tweens.add({
      targets: circle,
      alpha: 0,
      duration: duration,
      onComplete: () => { circle.destroy(); border.destroy(); },
    });
  }

  /** Create ultimate AoE burst. Returns list of enemies hit. */
  static createUltimateBurst(
    scene: Phaser.Scene, x: number, y: number,
    enemies: Phaser.Physics.Arcade.Sprite[],
  ): Phaser.Physics.Arcade.Sprite[] {
    const hit: Phaser.Physics.Arcade.Sprite[] = [];
    const player = (scene as any).player;
    const isLevel10 = player && player.level >= 10;
    const isLevel9 = player && player.level >= 9;
    const radius = isLevel10 ? 400 : (isLevel9 ? 400 : SKILL_ULTIMATE_RADIUS);

    // Visual: expanding shockwave
    const ring = scene.add.circle(x, y, 10, 0x9900ff, 0.5).setDepth(10);
    scene.tweens.add({
      targets: ring,
      radius: radius,
      alpha: 0,
      duration: 500,
      onComplete: () => ring.destroy(),
    });

    // Screen flash
    scene.cameras.main.flash(200, 150, 0, 255, false);

    // Damage enemies in range
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist <= radius) {
        hit.push(enemy);
      }
    }

    return hit;
  }

  /** Create a Stun Blast AoE (Gun Q). Returns list of stunned enemies. */
  static createStunBlast(
    scene: Phaser.Scene, x: number, y: number,
    enemies: Phaser.Physics.Arcade.Sprite[],
  ): Phaser.Physics.Arcade.Sprite[] {
    const hit: Phaser.Physics.Arcade.Sprite[] = [];
    const player = (scene as any).player;
    const isLevel9 = player && player.level >= 9;

    // Visual: expanding white ring
    const ring = scene.add.circle(x, y, 10, 0xeeeeff, 0.6).setDepth(10);
    scene.tweens.add({
      targets: ring,
      radius: SKILL_STUN_BLAST_RADIUS,
      alpha: 0,
      duration: 350,
      onComplete: () => ring.destroy(),
    });

    // Shockwave line
    const shockGfx = scene.add.graphics().setDepth(10);
    shockGfx.lineStyle(3, 0xaaccff, 0.8);
    shockGfx.strokeCircle(x, y, SKILL_STUN_BLAST_RADIUS * 0.6);
    scene.tweens.add({
      targets: shockGfx,
      alpha: 0,
      duration: 400,
      onComplete: () => shockGfx.destroy(),
    });

    // Camera flash
    scene.cameras.main.flash(150, 200, 220, 255, false);

    // Stun / Slow enemies in range
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist <= SKILL_STUN_BLAST_RADIUS) {
        hit.push(enemy);

        const isFacingRight = player ? player.facing === 'right' : true;
        const isTargetInFront = player ? (isFacingRight ? (enemy.x >= player.x) : (enemy.x <= player.x)) : true;

        if (isLevel9) {
          if (isTargetInFront) {
            // Stun: freeze velocity and speed
            const body = enemy.body as Phaser.Physics.Arcade.Body;
            if (body) {
              body.setVelocity(0, 0);
            }
            const origSpeed = (enemy as unknown as { stats: { moveSpeed: number } }).stats.moveSpeed;
            (enemy as unknown as { stats: { moveSpeed: number } }).stats.moveSpeed = 0;
            enemy.setTint(0xddddff);

            // Stun indicator circle
            const stunIcon = scene.add.circle(enemy.x, enemy.y - 25, 6, 0xffff00, 0.8).setDepth(52);
            scene.tweens.add({
              targets: stunIcon,
              y: enemy.y - 35,
              alpha: 0,
              duration: 2000,
              onComplete: () => stunIcon.destroy(),
            });

            // Restore after stun duration (2s)
            scene.time.delayedCall(2000, () => {
              if (enemy.active) {
                (enemy as unknown as { stats: { moveSpeed: number } }).stats.moveSpeed = origSpeed;
                enemy.clearTint();
              }
            });
          } else {
            // Behind: Slow by 40% (retain 60% speed)
            const origSpeed = (enemy as unknown as { stats: { moveSpeed: number } }).stats.moveSpeed;
            (enemy as unknown as { stats: { moveSpeed: number } }).stats.moveSpeed = origSpeed * 0.6;
            enemy.setTint(0x8888ff);

            // Restore after duration (2s)
            scene.time.delayedCall(2000, () => {
              if (enemy.active) {
                (enemy as unknown as { stats: { moveSpeed: number } }).stats.moveSpeed = origSpeed;
                enemy.clearTint();
              }
            });
          }
        } else {
          // Normal stun: freeze velocity and speed for 1.5s
          const body = enemy.body as Phaser.Physics.Arcade.Body;
          if (body) {
            body.setVelocity(0, 0);
          }
          const origSpeed = (enemy as unknown as { stats: { moveSpeed: number } }).stats.moveSpeed;
          (enemy as unknown as { stats: { moveSpeed: number } }).stats.moveSpeed = 0;
          enemy.setTint(0xddddff);

          // Stun indicator circle
          const stunIcon = scene.add.circle(enemy.x, enemy.y - 25, 6, 0xffff00, 0.8).setDepth(52);
          scene.tweens.add({
            targets: stunIcon,
            y: enemy.y - 35,
            alpha: 0,
            duration: SKILL_STUN_BLAST_STUN_DURATION,
            onComplete: () => stunIcon.destroy(),
          });

          // Restore after stun duration (1.5s)
          scene.time.delayedCall(SKILL_STUN_BLAST_STUN_DURATION, () => {
            if (enemy.active) {
              (enemy as unknown as { stats: { moveSpeed: number } }).stats.moveSpeed = origSpeed;
              enemy.clearTint();
            }
          });
        }
      }
    }

    return hit;
  }
}
