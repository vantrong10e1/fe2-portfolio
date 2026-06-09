/**
 * WeaponSystem — Manages sword/gun, ammo, hitboxes, and projectiles.
 *
 * Weapons are data-driven. The system supports melee (sword) and ranged (gun).
 * Gun has a magazine (10/10 default) with infinite reload.
 * No reserve ammo — reload always refills to full.
 */
import Phaser from 'phaser';
import { GameEvent } from '../../types/game.types';
import EventBus from '../EventBus';
import { AudioManager } from '../managers/AudioManager';
import {
  GUN_MAGAZINE_SIZE,
  GUN_CRITICAL_CHANCE,
  GUN_RELOAD_TIME,
  BULLET_SPEED,
  BULLET_LIFETIME,
  BULLET_MAX_RANGE,
} from '../utils/Constants';

// ── Weapon Types ───────────────────────────────────────────────────────

export type WeaponType = 'melee' | 'ranged';

export interface WeaponDef {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  attackSpeed: number;
  knockback: number;
  criticalChance: number;
  maxRange: number;
  // Melee-specific
  hitboxWidth: number;
  hitboxHeight: number;
  hitboxOffsetX: number;
  hitboxOffsetY: number;
  // Ranged-specific
  magazineSize: number;
  reloadTime: number;
  bulletSpeed: number;
  bulletLifetime: number;
}

// ── Weapons Registry ───────────────────────────────────────────────────

export const WEAPONS: Record<string, WeaponDef> = {
  basic_sword: {
    id: 'basic_sword',
    name: 'Iron Sword',
    type: 'melee',
    damage: 15,
    attackSpeed: 2.5,
    knockback: 200,
    criticalChance: 0,    // Uses player stats criticalRate
    maxRange: 0,          // Melee — no range limit
    hitboxWidth: 55,
    hitboxHeight: 36,
    hitboxOffsetX: 42,
    hitboxOffsetY: 0,
    magazineSize: 0,
    reloadTime: 0,
    bulletSpeed: 0,
    bulletLifetime: 0,
  },
  basic_gun: {
    id: 'basic_gun',
    name: 'Flintlock Pistol',
    type: 'ranged',
    damage: 10,
    attackSpeed: 3.0,
    knockback: 80,
    criticalChance: GUN_CRITICAL_CHANCE,  // 40% crit
    maxRange: BULLET_MAX_RANGE,           // Bullet destroyed after this distance
    hitboxWidth: 0,
    hitboxHeight: 0,
    hitboxOffsetX: 0,
    hitboxOffsetY: 0,
    magazineSize: GUN_MAGAZINE_SIZE,
    reloadTime: GUN_RELOAD_TIME,
    bulletSpeed: BULLET_SPEED,
    bulletLifetime: BULLET_LIFETIME,
  },
};

// ── WeaponSystem Class ─────────────────────────────────────────────────

export class WeaponSystem {
  private equipped: WeaponDef;

  // Melee hitbox
  private hitbox: Phaser.GameObjects.Rectangle | null = null;

  // Ammo state (for ranged weapons) — no reserve, infinite reload
  private currentMagazine: number;
  private isReloading: boolean = false;
  private reloadTimer: Phaser.Time.TimerEvent | null = null;
  private magazines: Map<string, number> = new Map();

  constructor(defaultWeaponId: string = 'basic_sword') {
    const weapon = WEAPONS[defaultWeaponId];
    if (!weapon) throw new Error(`Unknown weapon: "${defaultWeaponId}"`);
    this.equipped = { ...weapon };
    this.currentMagazine = weapon.magazineSize;
  }

  // ── Equip / Switch ─────────────────────────────────────────────────

  equip(weaponId: string, level: number = 1): boolean {
    const weapon = WEAPONS[weaponId];
    if (!weapon) return false;
    if (this.equipped.id === weaponId) return false;

    // Save current ammo state before switching
    if (this.equipped.type === 'ranged') {
      this.magazines.set(this.equipped.id, this.currentMagazine);
    }

    // Cancel any ongoing reload
    this.reloadTimer?.destroy();
    this.reloadTimer = null;
    this.isReloading = false;

    // Destroy lingering melee hitbox
    this.destroyHitbox();

    this.equipped = { ...weapon };
    this.updateStatsForLevel(level);

    // Restore or initialize ammo state for new weapon
    if (weapon.type === 'ranged') {
      if (this.magazines.has(weaponId)) {
        this.currentMagazine = this.magazines.get(weaponId)!;
      } else {
        this.currentMagazine = this.equipped.magazineSize; // Use the potentially updated magazine size
      }
    }

    EventBus.emit(GameEvent.WEAPON_SWITCHED, {
      id: this.equipped.id,
      name: this.equipped.name,
      type: this.equipped.type,
    });

    if (this.equipped.type === 'ranged') {
      EventBus.emit(GameEvent.AMMO_CHANGED, {
        magazine: this.currentMagazine,
        maxMagazine: this.equipped.magazineSize,
      });
    }

    return true;
  }

  getEquipped(): WeaponDef { return this.equipped; }
  isRanged(): boolean { return this.equipped.type === 'ranged'; }
  isMelee(): boolean { return this.equipped.type === 'melee'; }

  // ── Melee Hitbox ───────────────────────────────────────────────────

  createAttackHitbox(
    scene: Phaser.Scene, x: number, y: number, angle: number,
  ): Phaser.GameObjects.Rectangle | null {
    if (this.equipped.type !== 'melee') return null;
    this.destroyHitbox();

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const offsetDistance = this.equipped.hitboxOffsetX;
    const hbX = x + offsetDistance * cos;
    const hbY = y + this.equipped.hitboxOffsetY + offsetDistance * sin;

    // Check if the attack is mostly vertical or horizontal
    const isMostlyVertical = Math.abs(sin) > Math.abs(cos);
    const width = isMostlyVertical ? this.equipped.hitboxHeight : this.equipped.hitboxWidth;
    const height = isMostlyVertical ? this.equipped.hitboxWidth : this.equipped.hitboxHeight;

    this.hitbox = scene.add.rectangle(
      hbX, hbY,
      width, height,
      0xff0000, 0,
    );
    scene.physics.add.existing(this.hitbox);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    return this.hitbox;
  }

  destroyHitbox(): void {
    if (this.hitbox) {
      this.hitbox.destroy();
      this.hitbox = null;
    }
  }

  getHitbox(): Phaser.GameObjects.Rectangle | null { return this.hitbox; }

  // ── Ranged / Ammo ──────────────────────────────────────────────────

  getCurrentMagazine(): number { return this.currentMagazine; }
  setCurrentMagazine(ammo: number): void {
    this.currentMagazine = ammo;
    EventBus.emit(GameEvent.AMMO_CHANGED, {
      magazine: this.currentMagazine,
      maxMagazine: this.equipped.magazineSize,
    });
  }

  canShoot(): boolean {
    return this.equipped.type === 'ranged'
      && this.currentMagazine > 0
      && !this.isReloading;
  }

  /** Consume one round from the magazine. Returns true if fired. */
  consumeAmmo(): boolean {
    if (!this.canShoot()) return false;
    this.currentMagazine--;
    EventBus.emit(GameEvent.AMMO_CHANGED, {
      magazine: this.currentMagazine,
      maxMagazine: this.equipped.magazineSize,
    });
    return true;
  }

  /** Start reload. Infinite ammo — always refills magazine to full. */
  startReload(scene: Phaser.Scene): boolean {
    if (this.equipped.type !== 'ranged') return false;
    if (this.isReloading) return false;
    if (this.currentMagazine >= this.equipped.magazineSize) return false;

    this.isReloading = true;
    AudioManager.getInstance().playSFX('reload');
    EventBus.emit(GameEvent.RELOAD_START);

    this.reloadTimer = scene.time.delayedCall(this.equipped.reloadTime, () => {
      this.currentMagazine = this.equipped.magazineSize;
      this.isReloading = false;
      EventBus.emit(GameEvent.RELOAD_END);
      EventBus.emit(GameEvent.AMMO_CHANGED, {
        magazine: this.currentMagazine,
        maxMagazine: this.equipped.magazineSize,
      });
    });

    return true;
  }

  getIsReloading(): boolean { return this.isReloading; }
  getMagazine(): number { return this.currentMagazine; }

  // ── Computed Values ────────────────────────────────────────────────

  getAttackCooldown(): number { return 1000 / this.equipped.attackSpeed; }
  getDamage(): number { return this.equipped.damage; }
  getKnockback(): number { return this.equipped.knockback; }
  getBulletSpeed(): number { return this.equipped.bulletSpeed; }
  getBulletLifetime(): number { return this.equipped.bulletLifetime; }
  getCriticalChance(): number { return this.equipped.criticalChance; }
  getMaxRange(): number { return this.equipped.maxRange; }

  // ── Dynamic Level Upgrades ──────────────────────────────────────────

  updateStatsForLevel(level: number): void {
    const baseDef = WEAPONS[this.equipped.id];
    if (!baseDef) return;

    // Reset stats to baseline before scaling
    this.equipped.hitboxWidth = baseDef.hitboxWidth;
    this.equipped.hitboxOffsetX = baseDef.hitboxOffsetX;
    this.equipped.maxRange = baseDef.maxRange;
    this.equipped.magazineSize = baseDef.magazineSize;
    this.equipped.reloadTime = baseDef.reloadTime;
    this.equipped.criticalChance = baseDef.criticalChance;

    // Level 5+: Melee hitbox chém xa hơn, súng bắn xa hơn
    if (level >= 5) {
      if (this.equipped.id === 'basic_sword') {
        this.equipped.hitboxWidth = 85;      // Melee chém rộng hơn
        this.equipped.hitboxOffsetX = 65;     // Melee chém xa hơn
      } else if (this.equipped.id === 'basic_gun') {
        this.equipped.maxRange = 750;         // Súng bắn xa cố định 750px
      }
    }

    // Level 8+: Súng tăng lượng đạn 10 -> 20, nạp đạn nhanh
    if (level >= 8) {
      if (this.equipped.id === 'basic_gun') {
        this.equipped.magazineSize = 20;
        this.equipped.reloadTime = 600;       // Nạp đạn nhanh (600ms thay vì 1200ms)
      }
    }

    // Level 9+: Súng có 60% chí mạng
    if (level >= 9) {
      if (this.equipped.id === 'basic_gun') {
        this.equipped.criticalChance = 0.6;   // 60% crit
      }
    }
  }

  /** Clean up any pending timers */
  destroy(): void {
    this.reloadTimer?.destroy();
    this.reloadTimer = null;
    this.destroyHitbox();
  }
}
