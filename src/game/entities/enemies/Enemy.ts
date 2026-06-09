/**
 * Enemy — Base class for all enemy entities.
 *
 * Architecture Decision:
 * Follows the same Entity → Character hierarchy as Player but with
 * AI-driven states (Patrol, Chase, Attack) instead of input-driven ones.
 * Each Enemy holds a reference to the player for detection/chasing and
 * uses configurable ranges from EnemyConfig.  The state machine pattern
 * mirrors Player.ts for consistency.
 */
import Phaser from 'phaser';
import { EntityState, GameEvent } from '../../../types/game.types';
import type { Direction } from '../../../types/game.types';
import type { EnemyConfig } from '../../../types/enemy.types';
import { Character } from '../base/Character';
import { StateMachine } from '../../ai/StateMachine';
import type { IState } from '../../ai/StateMachine';
import EventBus from '../../EventBus';
import { AudioManager } from '../../managers/AudioManager';
import { ENEMY_ATTACK_COOLDOWN, ENEMY_LEASH_RANGE } from '../../utils/Constants';

export class Enemy extends Character {
  // ── Configuration ─────────────────────────────────────────────────
  public readonly config: EnemyConfig;

  // ── Player reference (set externally by SpawnSystem / GameScene) ──
  public playerRef: Phaser.Physics.Arcade.Sprite | null = null;

  // ── Spawn tracking ────────────────────────────────────────────────
  public spawnPointId: string = '';
  public spawnX: number;
  public spawnY: number;

  // ── Attack state ──────────────────────────────────────────────────
  public lastAttackTime: number = 0;
  public attackCooldown: number;

  // ── Patrol state ──────────────────────────────────────────────────
  public patrolDirection: number = 1; // 1 = right, -1 = left

  // ── Subclass flags ────────────────────────────────────────────────
  /** If true, enemy ignores gravity and hovers (Bat) */
  public readonly isFlying: boolean = false;
  /** Chase speed multiplier (e.g. Goblin runs faster when chasing) */
  public readonly chaseSpeedMult: number = 1.0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    config: EnemyConfig,
  ) {
    super(scene, x, y, texture, { ...config.stats }, 300); // 300ms invincibility

    this.config = config;
    this.spawnX = x;
    this.spawnY = y;
    this.attackCooldown = ENEMY_ATTACK_COOLDOWN;

    // Physics body
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setSize(config.hitbox.width, config.hitbox.height);
    body.setOffset(config.hitbox.offsetX, config.hitbox.offsetY);

    // Build state machine
    this.stateMachine = new StateMachine<Enemy>(this) as unknown as StateMachine<import('../base/Entity').Entity>;
    const sm = this.stateMachine as unknown as StateMachine<Enemy>;

    sm.addState(new EnemyIdleState());
    sm.addState(new EnemyPatrolState());
    sm.addState(new EnemyChaseState());
    sm.addState(new EnemyAttackState());
    sm.addState(new EnemyTakeDamageState());
    sm.addState(new EnemyDeathState());

    sm.setState(EntityState.PATROL);
  }

  // ── Entity hook ────────────────────────────────────────────────────

  // ── Boss Buff properties ──────────────────────────────────────────
  public isBossBuffed: boolean = false;
  private originalStats: { attack: number; moveSpeed: number; maxHp: number } | null = null;

  applyBossBuff(): void {
    if (this.isBossBuffed) return;
    this.isBossBuffed = true;
    this.originalStats = {
      attack: this.stats.attack,
      moveSpeed: this.stats.moveSpeed,
      maxHp: this.stats.maxHp,
    };

    // Increase HP, speed, and attack damage by 2x (x2)
    this.stats.attack = Math.round(this.originalStats.attack * 2.0);
    this.stats.moveSpeed = Math.round(this.originalStats.moveSpeed * 2.0);
    
    const oldMaxHp = this.stats.maxHp;
    this.stats.maxHp = Math.round(this.originalStats.maxHp * 2.0);
    this.maxHp = this.stats.maxHp;

    // Heal them by the difference so their current HP increases accordingly
    const hpDiff = this.stats.maxHp - oldMaxHp;
    this.currentHp += hpDiff;
    this.stats.currentHp = this.currentHp;

    // Tint red/orange for visual feedback
    this.setTint(0xff6666);
  }

  removeBossBuff(): void {
    if (!this.isBossBuffed || !this.originalStats) return;
    this.isBossBuffed = false;

    // Restore original stats
    this.stats.attack = this.originalStats.attack;
    this.stats.moveSpeed = this.originalStats.moveSpeed;
    this.stats.maxHp = this.originalStats.maxHp;
    this.maxHp = this.stats.maxHp;

    // Clamp current HP to the restored max HP
    this.currentHp = Math.min(this.currentHp, this.maxHp);
    this.stats.currentHp = this.currentHp;

    this.clearTint();
    this.originalStats = null;
  }

  // ── Entity hook ────────────────────────────────────────────────────

  updateEntity(_dt: number): void {
    // State machine drives all behaviour via preUpdate
  }

  // ── Detection helpers ─────────────────────────────────────────────

  /** Distance to the player (Infinity if no player ref) */
  distanceToPlayer(): number {
    if (!this.playerRef) return Infinity;
    return Phaser.Math.Distance.Between(
      this.x, this.y,
      this.playerRef.x, this.playerRef.y,
    );
  }

  /** Whether the player is within detection range */
  canDetectPlayer(): boolean {
    return this.distanceToPlayer() <= this.config.detectionRange;
  }

  /** Whether the player is within attack range */
  canAttackPlayer(): boolean {
    return this.distanceToPlayer() <= this.config.attackRange;
  }

  /** Whether the attack cooldown has elapsed */
  canAttack(time: number): boolean {
    return time - this.lastAttackTime >= this.attackCooldown;
  }

  /** Direction toward the player (-1 left, 1 right) */
  directionToPlayer(): number {
    if (!this.playerRef) return this.patrolDirection;
    return this.playerRef.x < this.x ? -1 : 1;
  }

  // ── Damage overrides ──────────────────────────────────────────────

  protected onDamaged(amount: number): void {
    super.onDamaged(amount);
    AudioManager.getInstance().playSFX('enemy-hit');
    const sm = this.stateMachine as unknown as StateMachine<Enemy>;
    // Only interrupt if not already dying
    if (sm.currentStateName !== EntityState.DEATH) {
      sm.setState(EntityState.TAKE_DAMAGE);
    }
  }

  protected onDeath(): void {
    this.removeBossBuff();
    const sm = this.stateMachine as unknown as StateMachine<Enemy>;
    sm.setState(EntityState.DEATH);

    EventBus.emit(GameEvent.ENEMY_KILLED, {
      type: this.config.type,
      exp: this.config.expReward * 10,
      gold: this.config.goldReward,
      score: this.config.scoreValue,
      x: this.x,
      y: this.y,
    });
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  destroy(fromScene?: boolean): void {
    this.removeBossBuff();
    this.playerRef = null;
    super.destroy(fromScene);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Enemy States
// ═══════════════════════════════════════════════════════════════════════

/** Helper to access the typed state machine */
const esm = (e: Enemy) =>
  (e as unknown as { stateMachine: StateMachine<Enemy> }).stateMachine;

// ── Idle ──────────────────────────────────────────────────────────────

class EnemyIdleState implements IState<Enemy> {
  readonly name = EntityState.IDLE;
  private idleTimer = 0;

  enter(e: Enemy): void {
    e.setVelocityX(0);
    e.playAnim(`${e.config.type}-idle`, true);
    this.idleTimer = 0;
  }

  update(e: Enemy, dt: number): void {
    // Check for player detection
    if (e.canDetectPlayer()) {
      esm(e).setState(EntityState.CHASE);
      return;
    }

    // After brief idle, start patrolling
    this.idleTimer += dt;
    if (this.idleTimer >= 1000) {
      esm(e).setState(EntityState.PATROL);
    }
  }

  exit(_e: Enemy): void { /* noop */ }
}

// ── Patrol ───────────────────────────────────────────────────────────

class EnemyPatrolState implements IState<Enemy> {
  readonly name = EntityState.PATROL;
  private patrolTimer = 0;

  enter(e: Enemy): void {
    e.playAnim(`${e.config.type}-walk`, true);
    this.patrolTimer = 0;
  }

  update(e: Enemy, dt: number): void {
    // Check for player detection
    if (e.canDetectPlayer()) {
      esm(e).setState(EntityState.CHASE);
      return;
    }

    // Move in patrol direction
    e.setVelocityX(e.stats.moveSpeed * e.patrolDirection);
    e.applyFacing((e.patrolDirection > 0 ? 'right' : 'left') as Direction);

    // Flying enemies: hover smoothly using velocity to avoid physics jitter and clipping
    if (e.isFlying) {
      this.patrolTimer += dt;
      const targetY = e.spawnY + Math.sin(this.patrolTimer * 0.003) * 15;
      const dy = targetY - e.y;
      e.setVelocityY(dy * 4);
    }

    // Reverse at patrol boundary
    const distFromSpawn = e.x - e.spawnX;
    if (Math.abs(distFromSpawn) >= e.config.patrolRange) {
      e.patrolDirection *= -1;
    }

    // Reverse if hitting a wall
    const body = e.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.left || body.blocked.right) {
      e.patrolDirection *= -1;
    }
  }

  exit(e: Enemy): void {
    e.setVelocityX(0);
  }
}

// ── Chase ────────────────────────────────────────────────────────────

class EnemyChaseState implements IState<Enemy> {
  readonly name = EntityState.CHASE;

  enter(e: Enemy): void {
    e.playAnim(`${e.config.type}-walk`, true);
  }

  update(e: Enemy, _dt: number): void {
    // Leash: if too far from spawn, give up and return
    const distFromSpawn = Math.abs(e.x - e.spawnX);
    if (distFromSpawn > ENEMY_LEASH_RANGE) {
      esm(e).setState(EntityState.PATROL);
      return;
    }

    // Lost sight of player
    if (!e.canDetectPlayer()) {
      esm(e).setState(EntityState.PATROL);
      return;
    }

    // In attack range
    if (e.canAttackPlayer()) {
      const now = e.scene.time.now;
      if (e.canAttack(now)) {
        esm(e).setState(EntityState.ATTACK);
        return;
      }
      // Wait for cooldown — stop moving
      e.setVelocityX(0);
      return;
    }

    // Move toward player (with chase speed multiplier)
    const dir = e.directionToPlayer();
    const chaseSpeed = e.stats.moveSpeed * e.chaseSpeedMult;
    e.setVelocityX(chaseSpeed * dir);
    e.applyFacing((dir > 0 ? 'right' : 'left') as Direction);

    // Flying enemies: track player Y loosely
    if (e.isFlying && e.playerRef) {
      const targetY = e.playerRef.y - 20; // hover slightly above player
      const dy = targetY - e.y;
      e.setVelocityY(dy * 2); // smooth tracking
    }
  }

  exit(e: Enemy): void {
    e.setVelocityX(0);
    if (e.isFlying) e.setVelocityY(0);
  }
}

// ── Attack ───────────────────────────────────────────────────────────

class EnemyAttackState implements IState<Enemy> {
  readonly name = EntityState.ATTACK;

  enter(e: Enemy): void {
    e.setVelocityX(0);
    e.playAnim(`${e.config.type}-attack`, true);
    e.lastAttackTime = e.scene.time.now;

    // Deal damage to player if in range
    if (e.playerRef && e.canAttackPlayer()) {
      const player = e.playerRef as import('../base/Entity').Entity;
      player.takeDamage(e.stats.attack);
    }

    // Return to Chase/Idle after attack duration
    e.scene.time.delayedCall(500, () => {
      if (esm(e).currentStateName === EntityState.ATTACK) {
        if (e.canDetectPlayer()) {
          esm(e).setState(EntityState.CHASE);
        } else {
          esm(e).setState(EntityState.PATROL);
        }
      }
    });
  }

  update(_e: Enemy, _dt: number): void {
    // Locked during attack
  }

  exit(_e: Enemy): void { /* noop */ }
}

// ── TakeDamage ───────────────────────────────────────────────────────

class EnemyTakeDamageState implements IState<Enemy> {
  readonly name = EntityState.TAKE_DAMAGE;

  enter(e: Enemy): void {
    e.setVelocityX(0);
    e.playAnim(`${e.config.type}-hurt`, true);

    // Brief stun then resume
    e.scene.time.delayedCall(300, () => {
      if (esm(e).currentStateName === EntityState.TAKE_DAMAGE) {
        if (e.canDetectPlayer()) {
          esm(e).setState(EntityState.CHASE);
        } else {
          esm(e).setState(EntityState.PATROL);
        }
      }
    });
  }

  update(_e: Enemy, _dt: number): void {
    // Stunned
  }

  exit(_e: Enemy): void { /* noop */ }
}

// ── Death ────────────────────────────────────────────────────────────

class EnemyDeathState implements IState<Enemy> {
  readonly name = EntityState.DEATH;

  enter(e: Enemy): void {
    e.setVelocityX(0);
    e.setVelocityY(0);
    const body = e.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setEnable(false); // no more collisions
    e.playAnim(`${e.config.type}-death`, true);

    if ((e.scene as any).effectsSystem) {
      (e.scene as any).effectsSystem.enemyDeath(e.x, e.y);
    }

    AudioManager.getInstance().playSFX('enemy-death');

    // Fade out and destroy after delay
    e.scene.tweens.add({
      targets: e,
      alpha: 0,
      duration: 600,
      delay: 300,
      onComplete: () => {
        const spawnSystem = (e.scene as any).spawnSystem;
        if (spawnSystem && typeof spawnSystem.recycleEnemy === 'function') {
          spawnSystem.onEnemyDeath(e, e.scene.time.now);
          spawnSystem.recycleEnemy(e);
        } else {
          e.destroy();
        }
      },
    });
  }

  update(_e: Enemy, _dt: number): void {
    // Dead
  }

  exit(_e: Enemy): void { /* noop */ }
}
