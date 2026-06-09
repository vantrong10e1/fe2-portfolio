/**
 * Entity - Abstract base class for all game entities (players, enemies, NPCs).
 *
 * Architecture Decision:
 * Extends Phaser.Physics.Arcade.Sprite to get free physics integration
 * while adding shared concerns: health, damage/invincibility, facing
 * direction, and state-machine wiring.  Concrete entities override
 * `updateEntity()` rather than Phaser's built-in `update()` to keep
 * the super-call chain clean.
 */
import Phaser from 'phaser';
import type { Direction } from '../../../types/game.types';
import { StateMachine } from '../../ai/StateMachine';
import { INVINCIBILITY_DURATION } from '../../utils/Constants';

export abstract class Entity extends Phaser.Physics.Arcade.Sprite {
  // ── Health ─────────────────────────────────────────────────────────
  public currentHp: number;
  public maxHp: number;

  // ── Facing ─────────────────────────────────────────────────────────
  public facing: Direction;

  // ── State Machine ──────────────────────────────────────────────────
  protected stateMachine: StateMachine<Entity>;

  // ── Invincibility ──────────────────────────────────────────────────
  public isInvincible = false;
  protected invincibilityTimer: Phaser.Time.TimerEvent | null = null;
  protected invincibilityDuration: number;

  // ── Alive flag ─────────────────────────────────────────────────────
  public isDead = false;
  public isBoss = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    maxHp: number,
    invincibilityDuration: number = INVINCIBILITY_DURATION,
  ) {
    super(scene, x, y, texture);

    // Add to scene & physics world
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Health initialisation
    this.maxHp = maxHp;
    this.currentHp = maxHp;

    // Default facing
    this.facing = 'right' as Direction;

    // Invincibility window length
    this.invincibilityDuration = invincibilityDuration;

    // State machine (concrete subclass registers states)
    this.stateMachine = new StateMachine<Entity>(this);
  }

  // ── Damage / Death ─────────────────────────────────────────────────

  /**
   * Apply damage to this entity.
   * Respects invincibility frames and triggers death when HP ≤ 0.
   * @returns actual damage dealt (0 if invincible)
   */
  takeDamage(amount: number): number {
    if (this.isInvincible || this.isDead) return 0;

    const dealt = Math.max(0, amount);
    this.currentHp = Math.max(0, this.currentHp - dealt);

    this.onDamaged(dealt);

    if (this.currentHp <= 0) {
      this.die();
    } else {
      this.startInvincibility();
    }

    return dealt;
  }

  /** Begin the invincibility window after a hit */
  protected startInvincibility(): void {
    this.isInvincible = true;

    // Clean up any existing timer
    this.invincibilityTimer?.destroy();

    this.invincibilityTimer = this.scene.time.delayedCall(
      this.invincibilityDuration,
      () => {
        this.isInvincible = false;
        this.setAlpha(1);
      },
    );
  }

  /** Called when the entity is reduced to 0 HP */
  protected die(): void {
    this.isDead = true;
    this.onDeath();
  }

  // ── Hooks for subclasses ───────────────────────────────────────────

  /** Override to react to incoming damage (flash, sound, etc.) */
  protected onDamaged(_amount: number): void {
    // intentionally empty – subclasses override
  }

  /** Override to play death animation, emit events, etc. */
  protected onDeath(): void {
    // intentionally empty – subclasses override
  }

  // ── Update ─────────────────────────────────────────────────────────

  /**
   * Subclasses implement their per-frame logic here.
   * Called automatically by the scene's update loop.
   */
  abstract updateEntity(dt: number): void;

  /**
   * Phaser lifecycle – delegates to the state machine + subclass hook.
   * Scenes should call `entity.updateEntity(dt)` or rely on the
   * scene's update list.
   */
  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    if ((this.scene as any).isPaused) return;
    if ((this.scene as any).bossIntroActive && !this.isBoss) return;

    if (this.isDead) return;

    this.stateMachine.update(delta);
    this.updateEntity(delta);
  }
}
