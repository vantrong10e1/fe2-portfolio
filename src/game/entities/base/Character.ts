/**
 * Character - Extends Entity with RPG stat management and visual feedback.
 *
 * Overhead bars are positioned well above the sprite to avoid overlap.
 * Player shows HP + MP overhead. Enemies show only HP (maxMp=0 skips MP).
 */
import Phaser from 'phaser';
import type { CharacterStats, Direction } from '../../../types/game.types';
import { GameEvent } from '../../../types/game.types';
import { Entity } from './Entity';
import EventBus from '../../EventBus';
import { HP_COLOR, MP_COLOR, INVINCIBILITY_DURATION } from '../../utils/Constants';

const BAR_WIDTH = 40;
const BAR_HEIGHT = 4;
const BAR_GAP = 2;
/** Vertical offset above the sprite top — large enough to avoid overlap */
const BAR_OFFSET_Y = -20;

export abstract class Character extends Entity {
  public stats: CharacterStats;

  /** Whether to draw floating bars above the sprite */
  public showOverheadBars: boolean = true;

  public isPlayer: boolean = false;
  public shield: number = 0;
  public maxShield: number = 0;

  private hpBar: Phaser.GameObjects.Graphics;
  private mpBar: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    texture: string,
    stats: CharacterStats,
    invincibilityDuration: number = INVINCIBILITY_DURATION,
  ) {
    super(scene, x, y, texture, stats.maxHp, invincibilityDuration);
    this.stats = { ...stats };
    this.maxHp = this.stats.maxHp;
    this.currentHp = this.stats.currentHp;
    this.hpBar = scene.add.graphics().setDepth(200);
    this.mpBar = scene.add.graphics().setDepth(200);
  }

  // ── HP management ──────────────────────────────────────────────────

  healHp(amount: number): void {
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    this.stats.currentHp = this.currentHp;
    if (this.isPlayer) {
      EventBus.emit(GameEvent.HP_CHANGED, {
        current: this.currentHp,
        max: this.maxHp,
      });
    }
  }

  // ── MP Management ──────────────────────────────────────────────────

  spendMp(amount: number): boolean {
    if (this.stats.currentMp < amount) return false;
    this.stats.currentMp = Math.max(0, this.stats.currentMp - amount);
    if (this.isPlayer) {
      EventBus.emit(GameEvent.MP_CHANGED, {
        current: this.stats.currentMp,
        max: this.stats.maxMp,
      });
    }
    return true;
  }

  restoreMp(amount: number): void {
    this.stats.currentMp = Math.min(this.stats.maxMp, this.stats.currentMp + amount);
    if (this.isPlayer) {
      EventBus.emit(GameEvent.MP_CHANGED, {
        current: this.stats.currentMp,
        max: this.stats.maxMp,
      });
    }
  }

  // ── Damage override ────────────────────────────────────────────────

  override takeDamage(amount: number): number {
    if (this.isInvincible || this.isDead) return 0;

    let remaining = Math.max(0, amount);
    
    // Shield depletion
    if (this.maxShield > 0 && this.shield > 0) {
      if (remaining <= this.shield) {
        this.shield -= remaining;
        remaining = 0;
      } else {
        remaining -= this.shield;
        this.shield = 0;
      }
    }

    if (remaining > 0) {
      this.currentHp = Math.max(0, this.currentHp - remaining);
    }
    this.stats.currentHp = this.currentHp;

    this.onDamaged(amount); // Keep visual tint feedback with original amount

    if (this.currentHp <= 0) {
      this.die();
    } else {
      this.startInvincibility();
    }

    return remaining;
  }

  protected onDamaged(amount: number): void {
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      if (!this.isDead) this.clearTint();
    });

    if (this.isPlayer) {
      EventBus.emit(GameEvent.HP_CHANGED, {
        current: this.currentHp,
        max: this.maxHp,
      });
    }

    void amount;
  }

  override die(): void {
    this.showOverheadBars = false;
    this.hpBar.clear();
    this.mpBar.clear();
    super.die();
  }

  // ── Animation Helper ───────────────────────────────────────────────

  public playAnim(key: string, ignoreIfPlaying = true): boolean {
    if (!this.scene.anims.exists(key)) return false;
    this.play(key, ignoreIfPlaying);
    return true;
  }

  // ── Overhead Status Bars ───────────────────────────────────────────

  private drawStatusBars(): void {
    this.hpBar.clear();
    this.mpBar.clear();

    if (!this.showOverheadBars) return;

    const bx = this.x - BAR_WIDTH / 2;
    // Position bars well above the sprite's top edge
    const spriteTop = this.y - this.displayHeight / 2;
    let currentY = spriteTop + BAR_OFFSET_Y;

    // ── HP Bar ───────────────────────────────────────────────────
    // Background
    this.hpBar.fillStyle(0x000000, 0.65);
    this.hpBar.fillRoundedRect(bx - 1, currentY - 1, BAR_WIDTH + 2, BAR_HEIGHT + 2, 2);
    // Fill
    const hpPct = Math.max(0, this.currentHp / this.maxHp);
    if (hpPct > 0) {
      this.hpBar.fillStyle(HP_COLOR, 1);
      this.hpBar.fillRoundedRect(bx, currentY, BAR_WIDTH * hpPct, BAR_HEIGHT, 2);
    }

    currentY += BAR_HEIGHT + BAR_GAP;

    // ── MP Bar (only if this character has MP) ───────────────────
    if (this.stats.maxMp > 0) {
      this.mpBar.fillStyle(0x000000, 0.65);
      this.mpBar.fillRoundedRect(bx - 1, currentY - 1, BAR_WIDTH + 2, BAR_HEIGHT + 2, 2);
      const mpPct = Math.max(0, this.stats.currentMp / this.stats.maxMp);
      if (mpPct > 0) {
        this.mpBar.fillStyle(MP_COLOR, 1);
        this.mpBar.fillRoundedRect(bx, currentY, BAR_WIDTH * mpPct, BAR_HEIGHT, 2);
      }
      currentY += BAR_HEIGHT + BAR_GAP;
    }

    // ── Shield Bar (only if this character has shield) ───────────
    if (this.maxShield > 0) {
      this.mpBar.fillStyle(0x000000, 0.65);
      this.mpBar.fillRoundedRect(bx - 1, currentY - 1, BAR_WIDTH + 2, BAR_HEIGHT + 2, 2);
      const shieldPct = Math.max(0, this.shield / this.maxShield);
      if (shieldPct > 0) {
        this.mpBar.fillStyle(0xf1c40f, 1); // Yellow shield color
        this.mpBar.fillRoundedRect(bx, currentY, BAR_WIDTH * shieldPct, BAR_HEIGHT, 2);
      }
      currentY += BAR_HEIGHT + BAR_GAP;
    }
  }

  // ── Facing helper ──────────────────────────────────────────────────

  public applyFacing(dir: Direction): void {
    this.facing = dir;
    this.setFlipX(dir === ('left' as Direction));
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.drawStatusBars();

    if (this.isInvincible) {
      this.setAlpha(Math.sin(time * 0.02) > 0 ? 0.4 : 1);
    }
  }

  destroy(fromScene?: boolean): void {
    this.hpBar.destroy();
    this.mpBar.destroy();
    super.destroy(fromScene);
  }
}
