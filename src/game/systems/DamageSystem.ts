/**
 * DamageSystem — Handles damage calculation, knockback, and visual feedback
 * 
 * Calculates final damage based on attacker stats, defender stats,
 * critical hits, and defense reduction.
 */
import Phaser from 'phaser';
import type { CharacterStats } from '../../types/game.types';
import { useSettingsStore } from '../../stores/settingsStore';

export interface DamageResult {
  rawDamage: number;
  finalDamage: number;
  isCritical: boolean;
  knockbackForce: number;
}

export class DamageSystem {
  /**
   * Calculate damage from attacker to defender.
   * @param weaponCritChance  If > 0, overrides attacker's base criticalRate (e.g. gun's 40%).
   */
  static calculateDamage(
    attackerStats: CharacterStats,
    defenderStats: CharacterStats,
    weaponDamage: number,
    weaponKnockback: number,
    weaponCritChance: number = 0,
    defenderIsBoss: boolean = false,
  ): DamageResult {
    // Base damage = attack + weapon damage
    const rawDamage = attackerStats.attack + weaponDamage;

    // Critical hit check — weapon crit overrides player base crit when > 0
    // If weaponCritChance is explicitly -1, it disables critical hits (0% chance)
    const effectiveCritRate = weaponCritChance === -1
      ? 0
      : (weaponCritChance > 0 ? weaponCritChance : attackerStats.criticalRate);
    const isCritical = Math.random() < effectiveCritRate;
    const critMultiplier = isCritical ? attackerStats.criticalDamage : 1.0;

    // Defense reduction (minimum 1 damage)
    const reduced = rawDamage * critMultiplier - defenderStats.defense;
    let finalDamage = Math.max(1, Math.round(reduced));

    // Reduce critical damage by 50% if defender is boss
    if (isCritical && defenderIsBoss) {
      finalDamage = Math.max(1, Math.round(finalDamage * 0.5));
    }

    return {
      rawDamage,
      finalDamage,
      isCritical,
      knockbackForce: weaponKnockback,
    };
  }

  /**
   * Apply knockback to a physics body
   */
  static applyKnockback(
    target: Phaser.Physics.Arcade.Sprite,
    fromX: number,
    force: number,
    verticalForce: number = -100,
  ): void {
    const body = target.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    const direction = target.x > fromX ? 1 : -1;
    body.setVelocity(force * direction, verticalForce);
  }

  /**
   * Create floating damage number
   */
  static showDamageNumber(
    scene: Phaser.Scene,
    x: number,
    y: number,
    damage: number,
    isCritical: boolean,
  ): void {
    const settings = useSettingsStore.getState();
    if (!settings.showDamageNumber) return;

    const actualCrit = settings.showCriticalEffect ? isCritical : false;
    const fontSize = actualCrit ? '22px' : '13px';
    const color = actualCrit ? '#ff9900' : '#e0e0e0';
    const text = actualCrit ? `🔥 ${damage}!` : `${damage}`;

    const offsetX = Phaser.Math.Between(-12, 12);
    const dmgText = scene.add.text(x + offsetX, y - 20, text, {
      fontSize,
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: actualCrit ? 4 : 3,
      shadow: actualCrit ? { color: '#ff3300', blur: 4, stroke: true, fill: true } : undefined
    }).setOrigin(0.5).setDepth(100);

    if (actualCrit) {
      scene.tweens.add({
        targets: dmgText,
        scale: { from: 1.8, to: 1 },
        duration: 250,
        ease: 'Back.easeOut',
      });
      // Bouncing trajectory left/right for critical hits
      const dirX = Math.random() < 0.5 ? -40 : 40;
      scene.tweens.add({
        targets: dmgText,
        x: dmgText.x + dirX,
        y: y - 75,
        alpha: 0,
        duration: 1000,
        ease: 'Cubic.easeOut',
        onComplete: () => dmgText.destroy(),
      });
    } else {
      // Float straight up
      scene.tweens.add({
        targets: dmgText,
        y: y - 55,
        alpha: 0,
        duration: 700,
        ease: 'Power1',
        onComplete: () => dmgText.destroy(),
      });
    }
  }
}
