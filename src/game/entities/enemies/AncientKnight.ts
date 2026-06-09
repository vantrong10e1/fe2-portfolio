/**
 * AncientKnight — Boss enemy with phase-based AI, cinematic intro,
 * warning systems, phase transition phases, and dynamic music integration.
 */
import Phaser from 'phaser';
import { EntityState, GameEvent } from '../../../types/game.types';
import type { CharacterStats } from '../../../types/game.types';
import { EnemyCategory, EnemyType } from '../../../types/enemy.types';
import type { EnemyConfig } from '../../../types/enemy.types';
import { Enemy } from './Enemy';
import { Goblin } from './Goblin';
import { StateMachine } from '../../ai/StateMachine';
import type { IState } from '../../ai/StateMachine';
import EventBus from '../../EventBus';
import { AudioManager } from '../../managers/AudioManager';

// ── Boss Constants ─────────────────────────────────────────────────────

const BOSS_STATS: CharacterStats = {
  maxHp: 6000,
  currentHp: 6000,
  maxMp: 0,
  currentMp: 0,
  attack: 300,
  defense: 8,
  moveSpeed: 40,
  jumpForce: -650,
  criticalRate: 0.1,
  criticalDamage: 1.5,
};

const BOSS_CONFIG: EnemyConfig = {
  type: EnemyType.ANCIENT_KNIGHT,
  category: EnemyCategory.BOSS,
  name: 'Hiệp Sĩ Cổ Đại',
  stats: BOSS_STATS,
  detectionRange: 500,
  attackRange: 255,
  patrolRange: 120,
  expReward: 200,
  goldReward: 100,
  scoreValue: 500,
  hitbox: {
    width: 32,
    height: 48,
    offsetX: 0,
    offsetY: 0,
  },
};

// Phase thresholds (fraction of maxHp)
const PHASE_2_THRESHOLD = 0.6;
const PHASE_3_THRESHOLD = 0.3;

// Attack timings per phase
const PHASE_ATTACK_COOLDOWNS = [1200, 800, 500]; // ms
const PHASE_SPEEDS = [40, 60, 85]; // px/s
const PHASE_DAMAGE_MULT = [1.0, 1.3, 1.5];
const RAGE_COOLDOWN_MULT = 0.8;
const NORMAL_MINION_SPAWN_INTERVAL = 5000;
const RAGE_MINION_SPAWN_INTERVAL = 2000;

export class AncientKnight extends Enemy {
  /** Current boss phase (0, 1, 2) */
  public currentPhase: number = 0;

  /** Whether the boss is active (entered combat) */
  public bossActive: boolean = false;

  /** Charge attack tracking */
  private chargeTimer: number = 0;
  private chargeInterval: number = 6000; // ms between charges

  /** Slam attack tracking */
  private slamTimer: number = 0;
  private slamInterval: number = 4000;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player', BOSS_CONFIG);
    this.isBoss = true;

    // Override physics size for boss (larger)
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(36, 48);
    body.setOffset(0, 0);

    // Visual: scale up and tint red
    this.setScale(1.8);
    this.setTint(0xff4444);

    // Override state machine with boss-specific states
    this.stateMachine = new StateMachine<Enemy>(this) as unknown as StateMachine<import('../base/Entity').Entity>;
    const sm = this.stateMachine as unknown as StateMachine<AncientKnight>;

    sm.addState(new BossIdleState());
    sm.addState(new BossPatrolState());
    sm.addState(new BossChaseState());
    sm.addState(new BossAttackState());
    sm.addState(new BossChargeState());
    sm.addState(new BossSlamState());
    sm.addState(new BossTakeDamageState());
    sm.addState(new BossDeathState());
    sm.addState(new BossIntroState());
    sm.addState(new BossPhaseTransitionState());

    sm.setState(EntityState.IDLE);
  }

  // ── Phase Management ──────────────────────────────────────────────

  private checkPhaseTransition(): void {
    const hpPct = this.currentHp / this.maxHp;

    let newPhase = 0;
    if (hpPct <= PHASE_3_THRESHOLD) {
      newPhase = 2;
    } else if (hpPct <= PHASE_2_THRESHOLD) {
      newPhase = 1;
    }

    if (newPhase > this.currentPhase) {
      this.currentPhase = newPhase;
      this.attackCooldown = this.getPhaseAttackCooldown();
      this.stats.moveSpeed = PHASE_SPEEDS[newPhase];
      this.stats.defense = newPhase === 2 ? Math.floor(BOSS_STATS.defense * 0.5) : BOSS_STATS.defense;

      // Transition to phase transition state
      bossSm(this).setState('boss-transition' as EntityState);
    }
  }

  getPhaseSpeedMult(): number {
    return PHASE_SPEEDS[this.currentPhase] / PHASE_SPEEDS[0];
  }

  getPhaseDamageMult(): number {
    return PHASE_DAMAGE_MULT[this.currentPhase];
  }

  getPhaseAttackCooldown(): number {
    const cooldown = PHASE_ATTACK_COOLDOWNS[this.currentPhase];
    return this.currentPhase === 2 ? cooldown * RAGE_COOLDOWN_MULT : cooldown;
  }

  // ── Override damage to emit boss HP ─────────────────────────────

  protected onDamaged(amount: number): void {
    super.onDamaged(amount);

    if (!this.bossActive) {
      // Transition to intro state only if not already in intro state
      const sm = bossSm(this);
      if (sm.currentStateName !== ('boss-intro' as EntityState)) {
        sm.setState('boss-intro' as EntityState);
      }
      return;
    }

    this.checkPhaseTransition();

    // Emit boss HP bar update
    EventBus.emit(GameEvent.BOSS_HP_CHANGED, {
      name: this.config.name,
      current: this.currentHp,
      max: this.maxHp,
      visible: true,
    });
  }

  protected onDeath(): void {
    // Remove Boss Buff from all other monsters
    const aliveEnemies = (this.scene as any).spawnSystem?.getAliveEnemies() || [];
    for (const enemy of aliveEnemies) {
      if (enemy && enemy !== this) {
        enemy.removeBossBuff();
      }
    }

    // Hide boss HP bar
    EventBus.emit(GameEvent.BOSS_HP_CHANGED, {
      name: this.config.name,
      current: 0,
      max: this.maxHp,
      visible: false,
    });

    super.onDeath();
  }

  // ── Update for charge/slam timers ──────────────────────────────

  private trailTimer: number = 0;
  private spawnMinionsTimer: number = 0;

  private spawnEliteMinions(): void {
    if (!this.scene || !this.active || this.isDead || !this.playerRef) return;

    // Safety cap: don't spawn if there are already too many active enemies (prevent crash/lag)
    const group = (this.scene as any).enemiesGroup;
    const activeEnemyCount = (this.scene as any).spawnSystem?.getAliveEnemies().length ?? group?.getLength() ?? 0;
    if (activeEnemyCount >= 20) return;

    const groundY = this.scene.physics.world.bounds.height - 32 - 48; // Spawn on ground Y

    for (let i = 0; i < 5; i++) {
      const offsetX = Phaser.Math.Between(-150, 150);
      const sx = Phaser.Math.Clamp(this.x + offsetX, 100, this.scene.physics.world.bounds.width - 100);
      
      const minion = new Goblin(this.scene, sx, groundY);
      minion.playerRef = this.playerRef;
      minion.spawnPointId = 'spawn-boss-minions';

      // Make interactive for target frame selection
      minion.setInteractive({ useHandCursor: true });
      minion.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) {
          EventBus.emit('enemy-selected', minion);
        }
      });

      // Add to physics group and configure collider
      if (group) {
        group.add(minion);
      }
      const platforms = (this.scene as any).platforms;
      if (platforms) {
        this.scene.physics.add.collider(minion, platforms);
      }

      // Play spawn effect (black cloud)
      if ((this.scene as any).effectsSystem) {
        (this.scene as any).effectsSystem.enemySpawn(sx, groundY);
      }
    }
  }

  updateEntity(dt: number): void {
    // Keep boss within world boundaries to prevent tunneling out of bounds when hit by knockbacks like "Bộc Phá" (Ultimate)
    if (this.scene && this.scene.physics && this.scene.physics.world) {
      const worldWidth = this.scene.physics.world.bounds.width;
      const halfWidth = this.body ? this.body.width / 2 : 16;
      const minX = halfWidth;
      const maxX = worldWidth - halfWidth;
      if (this.x < minX) {
        this.setX(minX);
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) body.setVelocityX(0);
      } else if (this.x > maxX) {
        this.setX(maxX);
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) body.setVelocityX(0);
      }
    }

    if (this.bossActive && this.currentHp > 0) {
      this.chargeTimer += dt;
      this.slamTimer += dt;
      this.spawnMinionsTimer += dt;

      const spawnInterval = this.currentPhase === 2 ? RAGE_MINION_SPAWN_INTERVAL : NORMAL_MINION_SPAWN_INTERVAL;
      if (this.spawnMinionsTimer >= spawnInterval) {
        this.spawnMinionsTimer = 0;
        this.spawnEliteMinions();
      }

      // Scan all active enemies in the group and apply proximity buff
      const group = (this.scene as any).enemiesGroup;
      if (group) {
        const activeEnemies = group.getChildren() as Enemy[];
        for (const enemy of activeEnemies) {
          if (enemy && enemy !== this && enemy.active && enemy.currentHp > 0) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (dist <= 200) {
              enemy.applyBossBuff();
            } else {
              enemy.removeBossBuff();
            }
          }
        }
      }

      // Rage trail for Phase 3
      if (this.currentPhase === 2) {
        this.trailTimer += dt;
        if (this.trailTimer >= 80) {
          this.trailTimer = 0;
          if ((this.scene as any).effectsSystem) {
            (this.scene as any).effectsSystem.bossRageTrail(this.x, this.y);
          }
        }
      }
    }
  }

  canCharge(): boolean {
    const interval = this.currentPhase === 2 ? this.chargeInterval * RAGE_COOLDOWN_MULT : this.chargeInterval;
    return this.currentPhase >= 1 && this.chargeTimer >= interval;
  }

  resetChargeTimer(): void {
    this.chargeTimer = 0;
  }

  canSlam(): boolean {
    const interval = this.currentPhase === 2 ? this.slamInterval * RAGE_COOLDOWN_MULT : this.slamInterval;
    return this.currentPhase >= 2 && this.slamTimer >= interval;
  }

  resetSlamTimer(): void {
    this.slamTimer = 0;
  }

  setInvincible(val: boolean): void {
    this.isInvincible = val;
  }

  destroy(fromScene?: boolean): void {
    if (this.scene) {
      const aliveEnemies = (this.scene as any).spawnSystem?.getAliveEnemies() || [];
      for (const enemy of aliveEnemies) {
        if (enemy && enemy !== this) {
          enemy.removeBossBuff();
        }
      }
    }
    super.destroy(fromScene);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Boss States
// ═══════════════════════════════════════════════════════════════════════

const bossSm = (e: AncientKnight) => e['stateMachine'] as unknown as StateMachine<AncientKnight>;

// ── Idle ──────────────────────────────────────────────────────────────
class BossIdleState implements IState<AncientKnight> {
  readonly name = EntityState.IDLE;
  enter(b: AncientKnight): void {
    b.setVelocityX(0);
    b.playAnim('player-idle', true);
  }
  update(b: AncientKnight, _dt: number): void {
    if (b.canDetectPlayer()) {
      bossSm(b).setState('boss-intro' as EntityState);
    } else {
      bossSm(b).setState(EntityState.PATROL);
    }
  }
  exit(_b: AncientKnight): void { }
}

// ── Patrol ───────────────────────────────────────────────────────────
class BossPatrolState implements IState<AncientKnight> {
  readonly name = EntityState.PATROL;
  enter(b: AncientKnight): void {
    b.playAnim('player-run', true);
  }
  update(b: AncientKnight, _dt: number): void {
    if (b.canDetectPlayer()) {
      bossSm(b).setState('boss-intro' as EntityState);
      return;
    }
    // Patrol slowly around spawn
    const speed = 30;
    b.setVelocityX(speed * b.patrolDirection);
    b.applyFacing((b.patrolDirection > 0 ? 'right' : 'left') as import('../../../types/game.types').Direction);

    if (Math.abs(b.x - b.spawnX) > b.config.patrolRange) {
      b.patrolDirection *= -1;
      bossSm(b).setState(EntityState.IDLE);
    }
  }
  exit(_b: AncientKnight): void { }
}

// ── Cinematic Intro ──────────────────────────────────────────────────
class BossIntroState implements IState<AncientKnight> {
  readonly name = 'boss-intro' as EntityState;
  enter(b: AncientKnight): void {
    b.setVelocityX(0);
    b.setVelocityY(0);
    b.playAnim('player-idle', true);
    b.setTint(0xff8888);

    // Pause physics world and freeze other updates
    b.scene.physics.world.pause();
    const gameScene = b.scene as any;
    gameScene.bossIntroActive = true;

    // Pause player animation
    if (b.playerRef && b.playerRef.anims) {
      b.playerRef.anims.pause();
    }

    // Pause other enemies animations
    if (gameScene.spawnSystem) {
      for (const enemy of gameScene.spawnSystem.getAliveEnemies()) {
        if (enemy !== b && enemy.anims) {
          enemy.anims.pause();
        }
      }
    }

    // Disable player inputs
    if (b.playerRef && (b.playerRef as any).controller) {
      b.playerRef.setVelocityX(0);
      (b.playerRef as any).controller.locked = true;
    }

    // Camera pan & zoom to the boss
    const cam = b.scene.cameras.main;
    cam.stopFollow();
    cam.pan(b.x, b.y, 1000, 'Cubic.easeInOut');
    cam.zoomTo(1.4, 1000, 'Cubic.easeInOut');

    // Trigger UI intro display in React overlay
    EventBus.emit('boss-intro-start', {
      name: b.config.name,
      title: 'Kẻ Gác Hư Không',
    });

    // Roar blast visual and camera shake
    b.scene.time.delayedCall(1000, () => {
      if (!b.active || b.isDead) return;
      AudioManager.getInstance().playSFX('boss-skill');
      cam.shake(600, 0.012);
      b.setTint(0xff2222);

      if ((b.scene as any).effectsSystem) {
        (b.scene as any).effectsSystem.bossIntroShockwave(b.x, b.y);
      }
    });

    // End intro, return camera and player control
    b.scene.time.delayedCall(2500, () => {
      if (!b.active || b.isDead) return;
      b.setTint(0xff4444);

      if (b.playerRef && (b.playerRef as any).controller) {
        (b.playerRef as any).controller.locked = false;
      }

      cam.pan(b.playerRef!.x, b.playerRef!.y, 800, 'Cubic.easeOut');
      cam.zoomTo(1.0, 800, 'Cubic.easeOut');

      b.scene.time.delayedCall(800, () => {
        if (!b.active || b.isDead) return;
        cam.startFollow(b.playerRef!, true, 0.1, 0.1);

        // Resume physics world and normal updates
        b.scene.physics.world.resume();
        gameScene.bossIntroActive = false;

        // Resume other entities animations
        const enemies = gameScene.spawnSystem?.getAliveEnemies() || [];
        for (const enemy of enemies) {
          if (enemy !== b && enemy.active && enemy.anims) {
            enemy.anims.resume();
          }
        }
        if (b.playerRef && b.playerRef.anims) {
          b.playerRef.anims.resume();
        }

        // Start fight
        b.bossActive = true;
        AudioManager.getInstance().playBgm('boss');
        
        EventBus.emit(GameEvent.BOSS_HP_CHANGED, {
          name: b.config.name,
          current: b.currentHp,
          max: b.maxHp,
          visible: true,
        });
        bossSm(b).setState(EntityState.CHASE);
      });
    });
  }
  update(_b: AncientKnight, _dt: number): void { }
  exit(_b: AncientKnight): void { }
}

// ── Chase ────────────────────────────────────────────────────────────
class BossChaseState implements IState<AncientKnight> {
  readonly name = EntityState.CHASE;
  enter(b: AncientKnight): void {
    b.playAnim('player-run', true);
  }
  update(b: AncientKnight, _dt: number): void {
    if (!b.playerRef) return;

    // Check for special attacks first
    if (b.canCharge() && b.distanceToPlayer() > b.config.attackRange && b.distanceToPlayer() < 450) {
      bossSm(b).setState('boss-charge' as EntityState);
      return;
    }
    if (b.canSlam() && b.distanceToPlayer() <= b.config.attackRange + 20) {
      bossSm(b).setState('boss-slam' as EntityState);
      return;
    }

    if (b.canAttackPlayer() && b.canAttack(b.scene.time.now)) {
      bossSm(b).setState(EntityState.ATTACK);
      return;
    }

    // Chase player
    const dir = b.directionToPlayer();
    const speed = PHASE_SPEEDS[b.currentPhase] * 1.2;
    b.setVelocityX(speed * dir);
    b.applyFacing((dir > 0 ? 'right' : 'left') as import('../../../types/game.types').Direction);

    // Jump if player is high above or if blocked by a wall/platform
    const body = b.body as Phaser.Physics.Arcade.Body;
    if (body && body.blocked.down) {
      const isPlayerAbove = b.playerRef.y < b.y - 50;
      const isWallBlocked = body.blocked.left || body.blocked.right;
      if (isPlayerAbove || isWallBlocked) {
        b.setVelocityY(b.stats.jumpForce);
        b.playAnim('player-jump', true);
      }
    }
  }
  exit(_b: AncientKnight): void { }
}

// ── Normal Attack ────────────────────────────────────────────────────
class BossAttackState implements IState<AncientKnight> {
  readonly name = EntityState.ATTACK;
  enter(b: AncientKnight): void {
    b.setVelocityX(0);
    b.lastAttackTime = b.scene.time.now;
    b.playAnim('player-attack', true);

    // Deal damage after short wind-up
    b.scene.time.delayedCall(300, () => {
      if (!b.active || b.isDead || !b.playerRef) return;
      if (b.distanceToPlayer() <= b.config.attackRange + 15) {
        const damage = Math.floor(b.stats.attack * b.getPhaseDamageMult());
        EventBus.emit('boss-attack-hit', {
          damage,
          x: b.x,
          y: b.y,
          direction: b.directionToPlayer(),
        });
      }
    });

    // Return to chase
    b.scene.time.delayedCall(b.getPhaseAttackCooldown(), () => {
      if (!b.active || b.isDead) return;
      if (bossSm(b).currentStateName === EntityState.ATTACK) {
        bossSm(b).setState(EntityState.CHASE);
      }
    });
  }
  update(_b: AncientKnight, _dt: number): void { }
  exit(_b: AncientKnight): void { }
}

// ── Charge Attack (Phase 2+) ─────────────────────────────────────────
class BossChargeState implements IState<AncientKnight> {
  readonly name = 'boss-charge' as EntityState;
  enter(b: AncientKnight): void {
    b.resetChargeTimer();
    b.setVelocityX(0);
    b.playAnim('player-idle', true);
    b.setTint(0xffaa00);
    AudioManager.getInstance().playSFX('boss-skill');

    const dir = b.directionToPlayer();

    if ((b.scene as any).effectsSystem) {
      (b.scene as any).effectsSystem.bossSkillWarningCharge(b.x, b.y, dir, 450);
      (b.scene as any).effectsSystem.bossSkillWarningIcon(b.x, b.y, 400);
    }

    // Charge after windup
    b.scene.time.delayedCall(400, () => {
      if (!b.active || b.isDead) return;
      b.playAnim('player-dash', true);
      b.setVelocityX(360 * dir); // increased velocity for longer range
      b.setTint(0xff2222);

      // End charge after duration
      b.scene.time.delayedCall(800, () => { // increased duration for longer range
        if (!b.active || b.isDead) return;
        b.setTint(0xff4444);

        // Damage in path
        if (b.playerRef && b.distanceToPlayer() <= 270) {
          const damage = Math.floor(b.stats.attack * 1.5 * b.getPhaseDamageMult());
          EventBus.emit('boss-attack-hit', {
            damage,
            x: b.x,
            y: b.y,
            direction: b.directionToPlayer(),
          });
        }

        if (bossSm(b).currentStateName === ('boss-charge' as EntityState)) {
          bossSm(b).setState(EntityState.CHASE);
        }
      });
    });
  }
  update(_b: AncientKnight, _dt: number): void { }
  exit(b: AncientKnight): void {
    b.setTint(0xff4444);
  }
}

// ── Slam Attack (Phase 3) ────────────────────────────────────────────
class BossSlamState implements IState<AncientKnight> {
  readonly name = 'boss-slam' as EntityState;
  enter(b: AncientKnight): void {
    b.resetSlamTimer();
    b.setVelocityX(0);
    b.playAnim('player-attack', true);
    AudioManager.getInstance().playSFX('boss-skill');

    // Jump up
    b.setVelocityY(-250);
    b.setTint(0xff2222);

    if ((b.scene as any).effectsSystem) {
      const groundY = b.scene.physics.world.bounds.height - 48;
      (b.scene as any).effectsSystem.bossSkillWarningSlam(b.x, groundY, 295);
      (b.scene as any).effectsSystem.bossSkillWarningIcon(b.x, b.y, 500);
    }

    // Slam down after delay
    b.scene.time.delayedCall(500, () => {
      if (!b.active || b.isDead) return;
      b.setVelocityY(400);

      // AOE damage on landing (delayed)
      b.scene.time.delayedCall(300, () => {
        if (!b.active || b.isDead) return;
        b.setTint(0xff4444);

        if (b.playerRef && b.distanceToPlayer() <= 290) {
          const damage = Math.floor(b.stats.attack * 2.0 * b.getPhaseDamageMult());
          EventBus.emit('boss-attack-hit', {
            damage,
            x: b.x,
            y: b.y,
            direction: 0,
          });
        }

        // Camera shake on slam impact
        const cam = b.scene.cameras.main;
        cam.shake(200, 0.008);

        if (bossSm(b).currentStateName === ('boss-slam' as EntityState)) {
          bossSm(b).setState(EntityState.CHASE);
        }
      });
    });
  }
  update(_b: AncientKnight, _dt: number): void { }
  exit(b: AncientKnight): void {
    b.setTint(0xff4444);
  }
}

// ── Phase Transition Power Up State ─────────────────────────────────
class BossPhaseTransitionState implements IState<AncientKnight> {
  readonly name = 'boss-transition' as EntityState;
  enter(b: AncientKnight): void {
    b.setVelocityX(0);
    b.setVelocityY(0);
    b.playAnim('player-hurt', true);
    b.setTint(0xffaa00);
    
    // Briefly invulnerable during power up
    b.setInvincible(true);

    // Update dynamic BGM phase
    AudioManager.getInstance().setBossPhase(b.currentPhase);

    // VFX & shake
    b.scene.cameras.main.flash(450, 255, 68, 0);
    b.scene.cameras.main.shake(1200, 0.012);

    // Trigger UI notification in React HUD
    EventBus.emit('boss-phase-transition', {
      phase: b.currentPhase + 1,
      name: b.config.name,
    });

    if ((b.scene as any).effectsSystem) {
      (b.scene as any).effectsSystem.bossPhaseBlast(b.x, b.y);
    }

    // Color flash loop
    let colorIndex = 0;
    const colors = [0xff0000, 0xffaa00, 0xffff00, 0xff3333];
    const colorTimer = b.scene.time.addEvent({
      delay: 100,
      callback: () => {
        if (!b.active || b.isDead) return;
        b.setTint(colors[colorIndex % colors.length]);
        colorIndex++;
      },
      loop: true
    });

    b.scene.time.delayedCall(1600, () => {
      colorTimer.remove();
      if (!b.active || b.isDead) return;
      b.setInvincible(false);
      b.setTint(b.currentPhase === 2 ? 0xff0000 : 0xff4444);

      if (bossSm(b).currentStateName === ('boss-transition' as EntityState)) {
        bossSm(b).setState(EntityState.CHASE);
      }
    });
  }
  update(_b: AncientKnight, _dt: number): void { }
  exit(_b: AncientKnight): void { }
}

// ── Take Damage ──────────────────────────────────────────────────────
class BossTakeDamageState implements IState<AncientKnight> {
  readonly name = EntityState.TAKE_DAMAGE;
  enter(b: AncientKnight): void {
    b.playAnim('player-hurt', true);
    // Boss recovers faster than normal enemies
    b.scene.time.delayedCall(200, () => {
      if (!b.active || b.isDead) return;
      if (bossSm(b).currentStateName === EntityState.TAKE_DAMAGE) {
        bossSm(b).setState(EntityState.CHASE);
      }
    });
  }
  update(_b: AncientKnight, _dt: number): void { }
  exit(_b: AncientKnight): void { }
}

// ── Death ────────────────────────────────────────────────────────────
class BossDeathState implements IState<AncientKnight> {
  readonly name = EntityState.DEATH;
  enter(b: AncientKnight): void {
    b.setVelocityX(0);
    b.setVelocityY(0);

    // Disable physics body immediately to prevent any post-death collisions or damage
    const body = b.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setAllowGravity(false);
      body.setEnable(false);
      body.setVelocity(0, 0);
    }

    b.playAnim('player-hurt', true);
    AudioManager.getInstance().playSFX('boss-death');

    // Trigger visual explosions around the boss body
    for (let i = 0; i < 6; i++) {
      b.scene.time.delayedCall(i * 180, () => {
        if (!b || !b.active || !b.scene) return;
        const ex = b.x + Phaser.Math.Between(-30, 30);
        const ey = b.y + Phaser.Math.Between(-40, 20);
        if ((b.scene as any).effectsSystem) {
          (b.scene as any).effectsSystem.criticalHitExplosion(ex, ey);
        }
        b.scene.cameras.main.shake(100, 0.005);
      });
    }

    // Final death blast
    b.scene.time.delayedCall(1100, () => {
      if (!b || !b.active || !b.scene) return;
      if ((b.scene as any).effectsSystem) {
        (b.scene as any).effectsSystem.bossDeath(b.x, b.y);
      }
    });

    // Dramatic death: flash and fade
    b.scene.tweens.add({
      targets: b,
      alpha: 0,
      scaleX: 2.5,
      scaleY: 2.5,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        if (b && b.active) {
          b.destroy();
        }
      },
    });

    // Camera shake on death
    b.scene.cameras.main.shake(500, 0.01);
  }
  update(_b: AncientKnight, _dt: number): void { }
  exit(_b: AncientKnight): void { }
}
