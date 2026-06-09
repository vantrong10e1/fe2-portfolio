/**
 * Player - The playable character entity.
 *
 * Features:
 * - Mouse left click: attack (sword melee / gun shoot)
 * - 1/2: switch weapons
 * - R: reload gun
 * - Q/E/F: skills with cooldowns
 * - Shift: dash
 * - B: inventory toggle
 * - Lifesteal on melee hits
 * - EXP/Level system
 * - No overhead HP bars (HUD-only)
 */
import Phaser from 'phaser';
import { EntityState, GameEvent } from '../../../types/game.types';
import type { CharacterStats } from '../../../types/game.types';
import { Character } from '../base/Character';
import { StateMachine } from '../../ai/StateMachine';
import type { IState } from '../../ai/StateMachine';
import { PlayerController } from './PlayerController';
import { WeaponSystem } from '../../systems/WeaponSystem';
import { SkillSystem } from '../../systems/SkillSystem';
import EventBus from '../../EventBus';
import { AudioManager } from '../../managers/AudioManager';
import {
  PLAYER_SPEED,
  PLAYER_JUMP,
  PLAYER_DASH_SPEED,
  PLAYER_DASH_DURATION,
  PLAYER_INITIAL_STATS,
  INVINCIBILITY_DURATION,
  SWORD_LIFESTEAL_PERCENT,
  EXP_BASE,
  EXP_EXPONENT,
  LEVEL_HP_BONUS,
  LEVEL_MP_BONUS,
  LEVEL_ATK_BONUS,
  LEVEL_DEF_BONUS,
  DASH_COOLDOWN_SWORD,
  DASH_COOLDOWN_GUN,
} from '../../utils/Constants';

export class Player extends Character {
  public controller: PlayerController;
  public weaponSystem: WeaponSystem;
  public skillSystem: SkillSystem;

  // Pending skill casting
  public _pendingSkill: string | null = null;

  // Attack cooldown
  private lastAttackTime: number = 0;

  // Dash cooldown
  public lastDashTime: number = -1000;

  public canDash(): boolean {
    let cd = this.weaponSystem.isMelee() ? DASH_COOLDOWN_SWORD : DASH_COOLDOWN_GUN;
    if (this.level >= 10) cd *= 0.6;
    return this.scene.time.now - this.lastDashTime >= cd;
  }

  /** Get current dash cooldown based on weapon type */
  public getDashCooldown(): number {
    let cd = this.weaponSystem.isMelee() ? DASH_COOLDOWN_SWORD : DASH_COOLDOWN_GUN;
    if (this.level >= 10) cd *= 0.6;
    return cd;
  }

  public triggerDash(): void {
    this.lastDashTime = this.scene.time.now;
  }

  // Mana regeneration timer
  private manaRegenTimer: number = 0;

  // EXP / Level
  public level: number = 1;
  public currentExp: number = 0;
  public expToNext: number;
  public skillDamageBonus: number = 0;

  // Inventory open state
  public inventoryOpen: boolean = false;

  // Double stats buff state
  private originalStatsBeforeBuff: { attack: number; defense: number; moveSpeed: number } | null = null;
  private buffTimerEvent: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const stats: CharacterStats = { ...PLAYER_INITIAL_STATS };
    super(scene, x, y, 'player', stats, INVINCIBILITY_DURATION);

    this.isPlayer = true;

    // Overhead HP/MP bars are enabled (positioned high above sprite)
    this.showOverheadBars = true;

    // Physics body
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setSize(24, 40);
    body.setOffset(4, 8);

    // Input controller
    this.controller = new PlayerController(scene);

    // Weapon system
    this.weaponSystem = new WeaponSystem('basic_sword');

    // Skill system
    this.skillSystem = new SkillSystem();

    // EXP
    this.expToNext = this.calcExpToNext(this.level);

    // Build state machine
    this.stateMachine = new StateMachine<Player>(this) as unknown as StateMachine<import('../base/Entity').Entity>;
    const sm = this.stateMachine as unknown as StateMachine<Player>;

    sm.addState(new IdleState());
    sm.addState(new RunState());
    sm.addState(new JumpState());
    sm.addState(new FallState());
    sm.addState(new AttackState());
    sm.addState(new DashState());
    sm.addState(new TakeDamageState());
    sm.addState(new DeathState());

    sm.setState(EntityState.IDLE);

    // Emit initial HP/MP to sync HUD on game start/restart
    EventBus.emit(GameEvent.HP_CHANGED, { current: this.currentHp, max: this.maxHp });
    EventBus.emit(GameEvent.MP_CHANGED, { current: this.stats.currentMp, max: this.stats.maxMp });

    // Emit initial weapon state
    EventBus.emit(GameEvent.WEAPON_SWITCHED, {
      id: this.weaponSystem.getEquipped().id,
      name: this.weaponSystem.getEquipped().name,
      type: this.weaponSystem.getEquipped().type,
    });

    // Listen for enemy kills → gain EXP
    EventBus.on(GameEvent.ENEMY_KILLED, this.onEnemyKilled, this);

    // Sync inventory status from UI/ESC triggers
    EventBus.on(GameEvent.INVENTORY_TOGGLE, this.onInventoryToggle, this);
  }

  public grievousWoundsTimer: number = 0;

  applyGrievousWounds(durationMs: number): void {
    const wasActive = this.grievousWoundsTimer > 0;
    this.grievousWoundsTimer = durationMs;

    if (!wasActive && this.scene) {
      // Floating notification text above player
      const woundText = this.scene.add.text(this.x, this.y - 70, '💔 VẾT THƯƠNG SÂU (-40% Hút Máu)!', {
        fontSize: '11px', color: '#ff3333', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(100);

      this.scene.tweens.add({
        targets: woundText,
        y: this.y - 120,
        alpha: 0,
        duration: 2000,
        onComplete: () => woundText.destroy(),
      });
    }
  }

  updateEntity(_dt: number): void {
    // State machine drives all behaviour
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.isDead) return;

    // Handle grievous wounds timer ticks
    if (this.grievousWoundsTimer > 0) {
      this.grievousWoundsTimer -= delta;
      if (this.grievousWoundsTimer <= 0) {
        this.grievousWoundsTimer = 0;
      }
    }

    // Regenerate 1% max Hp and 1% max Mp every 5s (5000ms)
    this.manaRegenTimer += delta;
    if (this.manaRegenTimer >= 5000) {
      this.manaRegenTimer -= 5000;
      
      const hpHeal = Math.max(1, Math.floor(this.maxHp * 0.01));
      this.healHp(hpHeal);

      const mpHeal = Math.max(1, Math.floor(this.stats.maxMp * 0.01));
      this.restoreMp(mpHeal);
    }

    if (this.level >= 10) {
      if (this.scaleX !== 1.25) {
        this.setScale(1.25);
        this.y -= 10; // nudge player up to prevent clipping into the floor
      }
      const body = this.body as Phaser.Physics.Arcade.Body;
      if (body && (body.width !== 30 || body.height !== 50)) {
        body.setSize(24, 40);
        body.setOffset(4, 8);
      }
      if (!this.originalStatsBeforeBuff) {
        this.setTint(0xffd700);
      } else {
        this.setTint(0xff3333);
      }

      // Emit rising golden particles (premium visual aura)
      if (Math.random() < 0.25 && this.scene && this.scene.add) {
        const px = this.x + Phaser.Math.Between(-12, 12);
        const py = this.y + Phaser.Math.Between(-24, 20);
        const size = Phaser.Math.Between(2, 4);
        const spark = this.scene.add.circle(px, py, size, 0xffd700, 0.85).setDepth(this.depth - 1);
        this.scene.tweens.add({
          targets: spark,
          y: py - Phaser.Math.Between(30, 60),
          alpha: 0,
          scale: 0.1,
          duration: Phaser.Math.Between(600, 1000),
          onComplete: () => spark.destroy(),
        });
      }
    }
  }

  // ── Damage override ────────────────────────────────────────────────

  protected onDamaged(amount: number): void {
    super.onDamaged(amount);
    const sm = this.stateMachine as unknown as StateMachine<Player>;
    sm.setState(EntityState.TAKE_DAMAGE);
  }

  protected onDeath(): void {
    const sm = this.stateMachine as unknown as StateMachine<Player>;
    sm.setState(EntityState.DEATH);
    EventBus.emit(GameEvent.PLAYER_DIED);
    EventBus.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled, this);
  }

  // ── Weapon ─────────────────────────────────────────────────────────

  createAttackHitbox(): void {
    if (this.weaponSystem.isMelee()) {
      const angle = (this as any)._attackAngle !== undefined ? (this as any)._attackAngle : (this.facing === 'right' ? 0 : Math.PI);
      this.weaponSystem.createAttackHitbox(this.scene, this.x, this.y, angle);
    }
  }

  destroyAttackHitbox(): void {
    this.weaponSystem.destroyHitbox();
  }

  getAttackHitbox(): Phaser.GameObjects.Rectangle | null {
    return this.weaponSystem.getHitbox();
  }

  canAttack(): boolean {
    if (this.weaponSystem.isRanged()) {
      return !this.weaponSystem.getIsReloading()
        && this.weaponSystem.canShoot()
        && this.scene.time.now - this.lastAttackTime >= this.weaponSystem.getAttackCooldown();
    }
    return this.scene.time.now - this.lastAttackTime >= this.weaponSystem.getAttackCooldown();
  }

  markAttack(): void {
    this.lastAttackTime = this.scene.time.now;
  }

  getWeaponSystem(): WeaponSystem { return this.weaponSystem; }
  getSkillSystem(): SkillSystem { return this.skillSystem; }

  // ── Lifesteal ──────────────────────────────────────────────────────

  applyLifesteal(damageDealt: number, targetIsBoss: boolean = false): void {
    if (!this.weaponSystem.isMelee()) return;
    const lifestealPercent = this.level >= 9 ? 0.3 : 0.1;
    let heal = Math.floor(damageDealt * lifestealPercent);
    if (targetIsBoss) {
      heal = Math.floor(heal * 0.7); // 30% lifesteal resistance (leaves 70%)
    }
    if (this.grievousWoundsTimer > 0) {
      heal = Math.floor(heal * 0.6); // 40% grievous wounds reduction (leaves 60%)
    }
    if (heal > 0) {
      this.healHp(heal);
    }
  }

  // ── EXP / Level ────────────────────────────────────────────────────

  public calcExpToNext(level: number): number {
    return Math.floor(EXP_BASE * Math.pow(level, EXP_EXPONENT));
  }

  private onEnemyKilled(data: { exp: number }): void {
    this.gainExp(data.exp);
  }

  private onInventoryToggle(data: { open: boolean }): void {
    this.inventoryOpen = data.open;
  }

  gainExp(amount: number): void {
    if (this.level >= 10) {
      this.level = 10;
      this.currentExp = 0;
      EventBus.emit(GameEvent.EXP_CHANGED, {
        current: 0,
        toNext: this.expToNext,
        level: 10,
      });
      return;
    }

    this.currentExp += amount;

    while (this.currentExp >= this.expToNext) {
      this.currentExp -= this.expToNext;
      this.levelUp();
      if (this.level >= 10) {
        this.level = 10;
        this.currentExp = 0;
        break;
      }
    }

    EventBus.emit(GameEvent.EXP_CHANGED, {
      current: this.currentExp,
      toNext: this.expToNext,
      level: this.level,
    });
  }

  private levelUp(): void {
    this.level++;
    this.expToNext = this.calcExpToNext(this.level);

    if (this.level <= 4) {
      // Levels 2, 3, 4: Basic stats increase strongly, moveSpeed +5, skillDamageBonus +10
      const atkBonus = 8;
      const defBonus = 2;
      const hpBonus = 40;
      const mpBonus = 15;

      this.stats.maxHp += hpBonus;
      this.stats.maxMp += mpBonus;
      this.stats.moveSpeed += 5;
      this.skillDamageBonus += 10;

      if (this.originalStatsBeforeBuff) {
        this.originalStatsBeforeBuff.attack += atkBonus;
        this.originalStatsBeforeBuff.defense += defBonus;
        this.originalStatsBeforeBuff.moveSpeed += 5;
        this.stats.attack = this.originalStatsBeforeBuff.attack * 2;
        this.stats.defense = this.originalStatsBeforeBuff.defense * 2;
      } else {
        this.stats.attack += atkBonus;
        this.stats.defense += defBonus;
      }
    } else if (this.level === 5) {
      // Level 5: stats x1.5, jumpForce increases
      this.stats.maxHp = Math.floor(this.stats.maxHp * 1.5);
      this.stats.maxMp = Math.floor(this.stats.maxMp * 1.5);
      this.stats.attack = Math.floor(this.stats.attack * 1.5);
      this.stats.defense = Math.floor(this.stats.defense * 1.5);
      this.stats.moveSpeed = Math.floor(this.stats.moveSpeed * 1.5);
      this.stats.jumpForce = -750; // Jump higher

      if (this.originalStatsBeforeBuff) {
        this.originalStatsBeforeBuff.attack = Math.floor(this.originalStatsBeforeBuff.attack * 1.5);
        this.originalStatsBeforeBuff.defense = Math.floor(this.originalStatsBeforeBuff.defense * 1.5);
        this.originalStatsBeforeBuff.moveSpeed = Math.floor(this.originalStatsBeforeBuff.moveSpeed * 1.5);
      }
    } else if (this.level === 10) {
      // Level 10: All stats increase strongly
      const atkBonus = 50;
      const defBonus = 20;
      const hpBonus = 300;
      const mpBonus = 100;

      this.stats.maxHp += hpBonus;
      this.stats.maxMp += mpBonus;

      if (this.originalStatsBeforeBuff) {
        this.originalStatsBeforeBuff.attack += atkBonus;
        this.originalStatsBeforeBuff.defense += defBonus;
        this.stats.attack = this.originalStatsBeforeBuff.attack * 2;
        this.stats.defense = this.originalStatsBeforeBuff.defense * 2;
      } else {
        this.stats.attack += atkBonus;
        this.stats.defense += defBonus;
      }
    } else {
      // Levels 6, 7, 8, 9
      const atkBonus = LEVEL_ATK_BONUS;
      const defBonus = LEVEL_DEF_BONUS;
      this.stats.maxHp += LEVEL_HP_BONUS;
      this.stats.maxMp += LEVEL_MP_BONUS;

      if (this.originalStatsBeforeBuff) {
        this.originalStatsBeforeBuff.attack += atkBonus;
        this.originalStatsBeforeBuff.defense += defBonus;
        this.stats.attack = this.originalStatsBeforeBuff.attack * 2;
        this.stats.defense = this.originalStatsBeforeBuff.defense * 2;
      } else {
        this.stats.attack += atkBonus;
        this.stats.defense += defBonus;
      }
    }

    // Refresh weapon stats on level up
    if (this.weaponSystem && typeof (this.weaponSystem as any).updateStatsForLevel === 'function') {
      (this.weaponSystem as any).updateStatsForLevel(this.level);
    }

    // Heal to full on level up
    this.currentHp = this.stats.maxHp;
    this.stats.currentHp = this.stats.maxHp;
    this.maxHp = this.stats.maxHp;
    this.stats.currentMp = this.stats.maxMp;

    EventBus.emit(GameEvent.LEVEL_UP, { level: this.level });
    EventBus.emit(GameEvent.HP_CHANGED, { current: this.currentHp, max: this.maxHp });
    EventBus.emit(GameEvent.MP_CHANGED, { current: this.stats.currentMp, max: this.stats.maxMp });
  }

  public activateDoubleStatsBuff(durationMs: number): void {
    if (this.buffTimerEvent) {
      this.buffTimerEvent.destroy();
      this.buffTimerEvent = null;
    }

    if (!this.originalStatsBeforeBuff) {
      this.originalStatsBeforeBuff = {
        attack: this.stats.attack,
        defense: this.stats.defense,
        moveSpeed: this.stats.moveSpeed,
      };
      this.stats.attack = this.originalStatsBeforeBuff.attack * 2;
      this.stats.defense = this.originalStatsBeforeBuff.defense * 2;
      this.stats.moveSpeed = this.originalStatsBeforeBuff.moveSpeed * 2;
    } else {
      this.stats.attack = this.originalStatsBeforeBuff.attack * 2;
      this.stats.defense = this.originalStatsBeforeBuff.defense * 2;
      this.stats.moveSpeed = this.originalStatsBeforeBuff.moveSpeed * 2;
    }

    // Floating notification text above player
    const buffText = this.scene.add.text(this.x, this.y - 50, '🔥 X2 CHỈ SỐ CƠ BẢN (5s)!', {
      fontSize: '14px', color: '#ff3d00', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(100);

    this.scene.tweens.add({
      targets: buffText,
      y: this.y - 100,
      alpha: 0,
      duration: 2000,
      onComplete: () => buffText.destroy(),
    });

    // Flash/color player to indicate buff
    this.setTint(0xff3333);

    this.buffTimerEvent = this.scene.time.delayedCall(durationMs, () => {
      this.deactivateDoubleStatsBuff();
    });
  }

  public deactivateDoubleStatsBuff(): void {
    if (this.originalStatsBeforeBuff) {
      this.stats.attack = this.originalStatsBeforeBuff.attack;
      this.stats.defense = this.originalStatsBeforeBuff.defense;
      this.stats.moveSpeed = this.originalStatsBeforeBuff.moveSpeed;
      this.originalStatsBeforeBuff = null;
    }
    this.clearTint();
    if (this.buffTimerEvent) {
      this.buffTimerEvent.destroy();
      this.buffTimerEvent = null;
    }
  }

  // ── Weapon switching (called from states) ──────────────────────────

  handleWeaponSwitch(input: import('./PlayerController').PlayerInput): void {
    if (input.weapon1) {
      if (this.weaponSystem.equip('basic_sword', this.level)) {
        AudioManager.getInstance().playSFX('ui-click');
        const gameScene = this.scene as any;
        if (gameScene.inventorySystem) {
          gameScene.inventorySystem.setEquippedWeapon('iron_sword');
        }
      }
    }
    if (input.weapon2) {
      if (this.weaponSystem.equip('basic_gun', this.level)) {
        AudioManager.getInstance().playSFX('ui-click');
        const gameScene = this.scene as any;
        if (gameScene.inventorySystem) {
          gameScene.inventorySystem.setEquippedWeapon('flintlock_pistol');
        }
      }
    }
    if (input.reload) this.weaponSystem.startReload(this.scene);
    if (input.inventoryToggle) {
      this.inventoryOpen = !this.inventoryOpen;
      AudioManager.getInstance().playSFX('inventory');
      EventBus.emit(GameEvent.INVENTORY_TOGGLE, { open: this.inventoryOpen });
    }
    if (input.tabToggle) {
      AudioManager.getInstance().playSFX('ui-click');
      EventBus.emit(GameEvent.TAB_TOGGLE);
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  destroy(fromScene?: boolean): void {
    EventBus.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled, this);
    EventBus.off(GameEvent.INVENTORY_TOGGLE, this.onInventoryToggle, this);
    if (this.controller) {
      this.controller.destroy();
    }
    super.destroy(fromScene);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Player States
// ═══════════════════════════════════════════════════════════════════════

const sm = (p: Player) => (p as unknown as { stateMachine: StateMachine<Player> }).stateMachine;

// Common input handling for all mobile states
function handleCommonInput(p: Player): boolean {
  const input = p.controller.getInput();

  // Weapon switching / reload / inventory always available
  p.handleWeaponSwitch(input);

  // Skills (can be used from any non-locked state)
  if (input.skillQ || input.skillE || input.skillF) {
    // Q maps to weapon-dependent skill
    const qSkill = p.weaponSystem.isMelee() ? 'fireball' : 'stun_blast';
    (p as unknown as { _pendingSkill: string | null })._pendingSkill =
      input.skillQ ? qSkill : input.skillE ? 'slow' : 'ultimate';
  }

  if (input.attack && p.canAttack()) {
    sm(p).setState(EntityState.ATTACK);
    return true;
  }
  if (input.dash && p.canDash()) {
    p.triggerDash();
    sm(p).setState(EntityState.DASH);
    return true;
  }
  return false;
}

// ── Idle ──────────────────────────────────────────────────────────────
class IdleState implements IState<Player> {
  readonly name = EntityState.IDLE;

  enter(p: Player): void {
    p.setVelocityX(0);
    p.playAnim('player-idle', true);
  }

  update(p: Player, _dt: number): void {
    const input = p.controller.getInput();
    p.handleWeaponSwitch(input);

    if (input.skillQ || input.skillE || input.skillF) {
      const qSkill = p.weaponSystem.isMelee() ? 'fireball' : 'stun_blast';
      (p as unknown as { _pendingSkill: string | null })._pendingSkill =
        input.skillQ ? qSkill : input.skillE ? 'slow' : 'ultimate';
    }

    if (input.attack && p.canAttack()) { sm(p).setState(EntityState.ATTACK); return; }
    if (input.dash && p.canDash()) { p.triggerDash(); sm(p).setState(EntityState.DASH); return; }
    if (input.jump && (p.body as Phaser.Physics.Arcade.Body).blocked.down) {
      sm(p).setState(EntityState.JUMP); return;
    }
    if (input.left || input.right) {
      sm(p).setState(EntityState.RUN); return;
    }
    if (!(p.body as Phaser.Physics.Arcade.Body).blocked.down) {
      sm(p).setState(EntityState.FALL);
    }
  }

  exit(_p: Player): void { }
}

// ── Run ──────────────────────────────────────────────────────────────
class RunState implements IState<Player> {
  readonly name = EntityState.RUN;

  enter(p: Player): void { p.playAnim('player-run', true); }

  update(p: Player, _dt: number): void {
    const input = p.controller.getInput();
    p.handleWeaponSwitch(input);

    if (input.skillQ || input.skillE || input.skillF) {
      const qSkill = p.weaponSystem.isMelee() ? 'fireball' : 'stun_blast';
      (p as unknown as { _pendingSkill: string | null })._pendingSkill =
        input.skillQ ? qSkill : input.skillE ? 'slow' : 'ultimate';
    }

    if (input.attack && p.canAttack()) { sm(p).setState(EntityState.ATTACK); return; }
    if (input.dash && p.canDash()) { p.triggerDash(); sm(p).setState(EntityState.DASH); return; }
    if (input.jump && (p.body as Phaser.Physics.Arcade.Body).blocked.down) {
      sm(p).setState(EntityState.JUMP); return;
    }

    if (input.left) {
      p.setVelocityX(-p.stats.moveSpeed);
      p.applyFacing('left' as import('../../../types/game.types').Direction);
    } else if (input.right) {
      p.setVelocityX(p.stats.moveSpeed);
      p.applyFacing('right' as import('../../../types/game.types').Direction);
    } else {
      sm(p).setState(EntityState.IDLE); return;
    }

    if (!(p.body as Phaser.Physics.Arcade.Body).blocked.down) {
      sm(p).setState(EntityState.FALL);
    }
  }

  exit(_p: Player): void { }
}

// ── Jump ──────────────────────────────────────────────────────────────
class JumpState implements IState<Player> {
  readonly name = EntityState.JUMP;

  enter(p: Player): void {
    p.setVelocityY(p.stats.jumpForce);
    p.playAnim('player-jump', true);
  }

  update(p: Player, _dt: number): void {
    const input = p.controller.getInput();
    p.handleWeaponSwitch(input);

    if (input.left) {
      p.setVelocityX(-p.stats.moveSpeed);
      p.applyFacing('left' as import('../../../types/game.types').Direction);
    } else if (input.right) {
      p.setVelocityX(p.stats.moveSpeed);
      p.applyFacing('right' as import('../../../types/game.types').Direction);
    } else {
      p.setVelocityX(0);
    }

    // Skills queueable while airborne
    if (input.skillQ || input.skillE || input.skillF) {
      const qSkill = p.weaponSystem.isMelee() ? 'fireball' : 'stun_blast';
      (p as unknown as { _pendingSkill: string | null })._pendingSkill =
        input.skillQ ? qSkill : input.skillE ? 'slow' : 'ultimate';
    }

    if (input.attack && p.canAttack()) { sm(p).setState(EntityState.ATTACK); return; }
    if (input.dash && p.canDash()) { p.triggerDash(); sm(p).setState(EntityState.DASH); return; }

    if ((p.body as Phaser.Physics.Arcade.Body).velocity.y > 0) {
      sm(p).setState(EntityState.FALL);
    }
  }

  exit(_p: Player): void { }
}

// ── Fall ──────────────────────────────────────────────────────────────
class FallState implements IState<Player> {
  readonly name = EntityState.FALL;

  enter(p: Player): void { p.playAnim('player-fall', true); }

  update(p: Player, _dt: number): void {
    const input = p.controller.getInput();
    p.handleWeaponSwitch(input);

    if (input.left) {
      p.setVelocityX(-p.stats.moveSpeed);
      p.applyFacing('left' as import('../../../types/game.types').Direction);
    } else if (input.right) {
      p.setVelocityX(p.stats.moveSpeed);
      p.applyFacing('right' as import('../../../types/game.types').Direction);
    } else {
      p.setVelocityX(0);
    }

    // Skills queueable while airborne
    if (input.skillQ || input.skillE || input.skillF) {
      const qSkill = p.weaponSystem.isMelee() ? 'fireball' : 'stun_blast';
      (p as unknown as { _pendingSkill: string | null })._pendingSkill =
        input.skillQ ? qSkill : input.skillE ? 'slow' : 'ultimate';
    }

    if (input.attack && p.canAttack()) { sm(p).setState(EntityState.ATTACK); return; }
    if (input.dash && p.canDash()) { p.triggerDash(); sm(p).setState(EntityState.DASH); return; }

    if ((p.body as Phaser.Physics.Arcade.Body).blocked.down) {
      sm(p).setState(EntityState.IDLE);
    }
  }

  exit(_p: Player): void { }
}

// ── Attack ────────────────────────────────────────────────────────────
class AttackState implements IState<Player> {
  readonly name = EntityState.ATTACK;
  /** Whether entering from an airborne state */
  private wasAirborne: boolean = false;

  enter(p: Player): void {
    // Do NOT reset velocityX — preserve momentum for combat freedom
    const body = p.body as Phaser.Physics.Arcade.Body;
    this.wasAirborne = !body.blocked.down;

    p.markAttack();

    // Calculate angle to pointer
    const pointer = p.scene.input.activePointer;
    const angle = Phaser.Math.Angle.Between(p.x, p.y, pointer.worldX, pointer.worldY);
    (p as any)._attackAngle = angle;

    // Flip character towards cursor
    p.applyFacing((pointer.worldX < p.x ? 'left' : 'right') as any);

    if (p.weaponSystem.isMelee()) {
      AudioManager.getInstance().playSFX('sword-attack');
      p.playAnim('player-attack', true);
      p.createAttackHitbox();
      // GameScene reads this flag to spawn slash VFX
      (p as unknown as { _swingSlash: boolean })._swingSlash = true;
      const duration = p.weaponSystem.getAttackCooldown();
      p.scene.time.delayedCall(duration, () => {
        if (sm(p).currentStateName === EntityState.ATTACK) {
          this.transitionOut(p);
        }
      });
    } else {
      // Ranged: fire bullet (handled by GameScene via event)
      if (p.weaponSystem.consumeAmmo()) {
        AudioManager.getInstance().playSFX('gun-shot');
        p.playAnim('player-attack', true);
        // GameScene reads this flag to spawn bullet
        (p as unknown as { _firedBullet: boolean })._firedBullet = true;
      }
      // Return quickly — gun attacks are fast
      p.scene.time.delayedCall(200, () => {
        if (sm(p).currentStateName === EntityState.ATTACK) {
          this.transitionOut(p);
        }
      });
    }
  }

  update(p: Player, _dt: number): void {
    // Combat Freedom: allow movement during attack animation
    const input = p.controller.getInput();
    p.handleWeaponSwitch(input);

    // Skills queueable during attack
    if (input.skillQ || input.skillE || input.skillF) {
      const qSkill = p.weaponSystem.isMelee() ? 'fireball' : 'stun_blast';
      (p as unknown as { _pendingSkill: string | null })._pendingSkill =
        input.skillQ ? qSkill : input.skillE ? 'slow' : 'ultimate';
    }

    // Allow horizontal movement
    if (input.left) {
      p.setVelocityX(-p.stats.moveSpeed);
      p.applyFacing('left' as import('../../../types/game.types').Direction);
    } else if (input.right) {
      p.setVelocityX(p.stats.moveSpeed);
      p.applyFacing('right' as import('../../../types/game.types').Direction);
    } else if ((p.body as Phaser.Physics.Arcade.Body).blocked.down) {
      // Only decelerate on ground — let air momentum persist
      p.setVelocityX(0);
    }

    // Allow jump during attack if grounded
    if (input.jump && (p.body as Phaser.Physics.Arcade.Body).blocked.down) {
      p.setVelocityY(p.stats.jumpForce);
    }

    // Dash always available
    if (input.dash && p.canDash()) {
      p.triggerDash();
      sm(p).setState(EntityState.DASH);
    }
  }

  exit(p: Player): void {
    p.destroyAttackHitbox();
  }

  /** Transition to the appropriate state after attack ends */
  private transitionOut(p: Player): void {
    const body = p.body as Phaser.Physics.Arcade.Body;
    const input = p.controller.getInput();

    if (!body.blocked.down) {
      // Airborne → Fall
      sm(p).setState(EntityState.FALL);
    } else if (input.left || input.right) {
      // Moving → Run
      sm(p).setState(EntityState.RUN);
    } else {
      sm(p).setState(EntityState.IDLE);
    }
  }
}

// ── Dash ──────────────────────────────────────────────────────────────
class DashState implements IState<Player> {
  readonly name = EntityState.DASH;

  enter(p: Player): void {
    const dir = p.facing === ('left' as string) ? -1 : 1;
    p.setVelocityX(PLAYER_DASH_SPEED * dir);
    p.setVelocityY(0);
    p.playAnim('player-dash', true);
    AudioManager.getInstance().playSFX('dash');

    if (p.level >= 9) {
      p.isInvincible = true;
      p.scene.time.delayedCall(1000, () => {
        p.isInvincible = false;
        p.setAlpha(1);
      });
      // Invisibility if gun form
      if (p.weaponSystem.isRanged()) {
        p.setAlpha(0.15); // Semi-transparent for feedback
      }
    } else {
      p.isInvincible = true;
    }

    p.scene.time.delayedCall(PLAYER_DASH_DURATION, () => {
      if (sm(p).currentStateName === EntityState.DASH) {
        sm(p).setState(EntityState.IDLE);
      }
    });
  }

  update(p: Player, _dt: number): void {
    const now = p.scene.time.now;
    const lastTrail = p.getData('_lastTrailTime') as number || 0;
    if (now - lastTrail >= 30) {
      p.setData('_lastTrailTime', now);
      if ((p.scene as any).effectsSystem) {
        (p.scene as any).effectsSystem.dashTrail(p);
      }
    }
  }

  exit(p: Player): void {
    if (p.level < 9) {
      p.isInvincible = false;
    }
  }
}

// ── TakeDamage ────────────────────────────────────────────────────────
class TakeDamageState implements IState<Player> {
  readonly name = EntityState.TAKE_DAMAGE;

  enter(p: Player): void {
    p.setVelocityX(0);
    p.playAnim('player-hurt', true);

    p.scene.time.delayedCall(300, () => {
      if (sm(p).currentStateName === EntityState.TAKE_DAMAGE) {
        sm(p).setState(EntityState.IDLE);
      }
    });
  }

  update(_p: Player, _dt: number): void { }
  exit(_p: Player): void { }
}

// ── Death ─────────────────────────────────────────────────────────────
class DeathState implements IState<Player> {
  readonly name = EntityState.DEATH;

  enter(p: Player): void {
    p.setVelocityX(0);
    p.setVelocityY(0);
    (p.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (p.body as Phaser.Physics.Arcade.Body).enable = false;
    p.showOverheadBars = false;
    p.playAnim('player-death', true);
    AudioManager.getInstance().playSFX('enemy-death');

    // Create 15 smoke particles drifting up
    for (let i = 0; i < 15; i++) {
      const px = p.x + Phaser.Math.Between(-16, 16);
      const py = p.y + Phaser.Math.Between(-24, 24);
      const radius = Phaser.Math.Between(6, 12);

      const smoke = p.scene.add.circle(px, py, radius, 0xdddddd, 0.65);
      smoke.setDepth(p.depth - 1);

      p.scene.tweens.add({
        targets: smoke,
        x: px + Phaser.Math.Between(-30, 30),
        y: py - Phaser.Math.Between(100, 180),
        alpha: 0,
        scale: 1.6,
        duration: Phaser.Math.Between(900, 1600),
        ease: 'Cubic.easeOut',
        onComplete: () => smoke.destroy()
      });
    }

    // Tween player upward and fade out
    p.scene.tweens.add({
      targets: p,
      y: p.y - 120,
      alpha: 0,
      duration: 1000,
      ease: 'Cubic.easeIn',
    });
  }

  update(_p: Player, _dt: number): void { }
  exit(_p: Player): void { }
}
