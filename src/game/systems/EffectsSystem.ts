/**
 * EffectsSystem — Centralised visual-effects factory.
 *
 * All combat VFX (slash arcs, bullet trails, impact explosions, hit particles)
 * are created through this system so they share the same lifecycle:
 *   1.  Create a lightweight Phaser Graphics / Rectangle / Circle.
 *   2.  Tween it (move, fade, scale).
 *   3.  Auto-destroy via onComplete.
 *
 * No persistent references are kept — every effect is fire-and-forget.
 */
import Phaser from 'phaser';

export class EffectsSystem {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SWORD EFFECTS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Animated slash arc that sweeps in front of the player.
   * Uses a Graphics object with an arc path + glow tween.
   */
  slashArc(x: number, y: number, angle: number, playerLevel: number = 1): void {
    const g = this.scene.add.graphics().setDepth(50);
    const cx = x + 10 * Math.cos(angle);
    const cy = y + 10 * Math.sin(angle);

    g.setPosition(cx, cy);
    g.setRotation(angle);

    const radius = playerLevel >= 5 ? 100 : 70;
    const startAngle = -80;
    const endAngle = 80;

    // Draw initial slash arc - BRIGHTER
    g.lineStyle(3, 0xffffff, 1.0);
    g.beginPath();
    g.arc(0, 0, radius, Phaser.Math.DegToRad(startAngle), Phaser.Math.DegToRad(endAngle), false);
    g.strokePath();

    // Inner bright glow - LARGER
    g.lineStyle(4, 0x88ddff, 0.8);
    g.beginPath();
    g.arc(0, 0, radius - 3, Phaser.Math.DegToRad(startAngle), Phaser.Math.DegToRad(endAngle), false);
    g.strokePath();

    // Second layer for depth
    g.lineStyle(2, 0x44ccff, 0.6);
    g.beginPath();
    g.arc(0, 0, radius - 8, Phaser.Math.DegToRad(startAngle), Phaser.Math.DegToRad(endAngle), false);
    g.strokePath();

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.3,
      duration: 250,
      ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });

    // Spark particles - MORE AND BRIGHTER
    for (let i = 0; i < 12; i++) {
      const sparkAngle = angle + Phaser.Math.DegToRad(Phaser.Math.Between(startAngle, endAngle));
      const px = cx + Math.cos(sparkAngle) * (radius + 10);
      const py = cy + Math.sin(sparkAngle) * (radius + 10);
      const sparkColor = Phaser.Math.RND.pick([0xffffff, 0x88ddff, 0xaaeeee]);
      const spark = this.scene.add.circle(px, py, Phaser.Math.Between(2, 4), sparkColor, 1.0).setDepth(51);
      this.scene.tweens.add({
        targets: spark,
        x: px + Phaser.Math.Between(-25, 25) * Math.cos(angle),
        y: py + Phaser.Math.Between(-20, 20) * Math.sin(angle),
        alpha: 0,
        scale: 0.1,
        duration: Phaser.Math.Between(200, 400),
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  /**
   * Hit sparks when sword connects with an enemy.
   */
  swordHitSparks(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const color = Phaser.Math.RND.pick([0xffffff, 0xffdd44, 0xff8800]);
      const r = Phaser.Math.Between(2, 4);
      const spark = this.scene.add.circle(x, y, r, color, 0.9).setDepth(50);

      this.scene.tweens.add({
        targets: spark,
        x: x + Phaser.Math.Between(-30, 30),
        y: y + Phaser.Math.Between(-30, 10),
        alpha: 0,
        scale: 0.1,
        duration: Phaser.Math.Between(200, 400),
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // GUN EFFECTS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Muzzle flash when gun fires.
   */
  muzzleFlash(x: number, y: number, angle: number): void {
    const flashX = x + 24 * Math.cos(angle);
    const flashY = y + 24 * Math.sin(angle);

    // Core flash
    const flash = this.scene.add.circle(flashX, flashY, 8, 0xffff88, 0.95).setDepth(50);
    // Outer glow
    const glow = this.scene.add.circle(flashX, flashY, 14, 0xffaa00, 0.4).setDepth(49);

    this.scene.tweens.add({
      targets: [flash, glow],
      alpha: 0,
      scale: 1.5,
      duration: 100,
      ease: 'Power2',
      onComplete: () => { flash.destroy(); glow.destroy(); },
    });
  }

  /**
   * Bullet trail — small fading dots behind the bullet every frame.
   * Call this in update() on each active bullet.
   */
  bulletTrailDot(x: number, y: number): void {
    const dot = this.scene.add.circle(
      x + Phaser.Math.Between(-1, 1),
      y + Phaser.Math.Between(-1, 1),
      Phaser.Math.Between(1, 2),
      0xffff66, 0.6,
    ).setDepth(40);

    this.scene.tweens.add({
      targets: dot,
      alpha: 0,
      scale: 0.3,
      duration: 180,
      ease: 'Linear',
      onComplete: () => dot.destroy(),
    });
  }

  /**
   * Bullet impact explosion when bullet hits an enemy or wall.
   */
  bulletImpact(x: number, y: number): void {
    // Flash
    const flash = this.scene.add.circle(x, y, 10, 0xffaa00, 0.9).setDepth(50);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 150,
      ease: 'Power2',
      onComplete: () => flash.destroy(),
    });

    // Debris particles
    for (let i = 0; i < 4; i++) {
      const color = Phaser.Math.RND.pick([0xffcc00, 0xff8800, 0xffffaa]);
      const size = Phaser.Math.Between(2, 4);
      const p = this.scene.add.rectangle(x, y, size, size, color, 0.8).setDepth(50);

      this.scene.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-25, 25),
        y: y + Phaser.Math.Between(-25, 15),
        alpha: 0,
        rotation: Phaser.Math.Between(-3, 3),
        duration: Phaser.Math.Between(200, 350),
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // GENERIC EFFECTS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Generic hit flash on a sprite (white tint flicker).
   */
  hitFlash(target: Phaser.GameObjects.Sprite): void {
    if (!target.active) return;
    target.setTint(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (target.active) target.clearTint();
    });
  }

  /**
   * Spawns a critical hit blast with gold/red circles and radiating star particles.
   */
  criticalHitExplosion(x: number, y: number): void {
    // Ring shockwave
    const ring = this.scene.add.graphics().setDepth(50);
    ring.lineStyle(2.5, 0xff3300, 0.95);
    ring.strokeCircle(x, y, 6);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 5.5,
      scaleY: 5.5,
      alpha: 0,
      duration: 250,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    // Expanding star sparks
    for (let i = 0; i < 8; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.FloatBetween(40, 80);
      const size = Phaser.Math.Between(3, 5);
      const color = Phaser.Math.RND.pick([0xffcc00, 0xff5500, 0xffffff]);
      const p = this.scene.add.circle(x, y, size, color, 0.9).setDepth(51);

      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.1,
        duration: 350,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  /**
   * Spawns fading ghost images of the player sprite tinted neon-green/cyan.
   */
  dashTrail(player: Phaser.GameObjects.Sprite): void {
    if (!player.active) return;
    const trail = this.scene.add.sprite(player.x, player.y, player.texture.key, player.anims.currentFrame?.frame.name)
      .setOrigin(player.originX, player.originY)
      .setScale(player.scaleX, player.scaleY)
      .setAlpha(0.6)
      .setDepth(player.depth - 1)
      .setTint(0x00e676);

    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 300,
      onComplete: () => trail.destroy(),
    });
  }

  /**
   * Fireball trailing flame particles.
   */
  fireballTrail(x: number, y: number): void {
    const r = Phaser.Math.Between(3, 6);
    const color = Phaser.Math.RND.pick([0xff5500, 0xffaa00, 0xff2200]);
    const dot = this.scene.add.circle(
      x + Phaser.Math.Between(-8, 8),
      y + Phaser.Math.Between(-8, 8),
      r,
      color,
      0.7
    ).setDepth(45);

    this.scene.tweens.add({
      targets: dot,
      x: dot.x - Phaser.Math.Between(10, 20),
      y: dot.y + Phaser.Math.Between(-10, 10),
      alpha: 0,
      scale: 0.2,
      duration: 250,
      onComplete: () => dot.destroy(),
    });
  }

  /**
   * Fireball explosion on target impact.
   */
  fireballExplosion(x: number, y: number): void {
    // Large core blast
    const blast = this.scene.add.circle(x, y, 22, 0xffaa00, 0.95).setDepth(50);
    this.scene.tweens.add({
      targets: blast,
      scale: 2.2,
      alpha: 0,
      duration: 350,
      ease: 'Quad.easeOut',
      onComplete: () => blast.destroy(),
    });

    // Ring shockwave
    const ring = this.scene.add.graphics().setDepth(50);
    ring.lineStyle(3, 0xff3300, 0.8);
    ring.strokeCircle(x, y, 12);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 4,
      scaleY: 4,
      alpha: 0,
      duration: 300,
      onComplete: () => ring.destroy(),
    });

    // Drifting embers
    for (let i = 0; i < 12; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(50, 120);
      const r = Phaser.Math.Between(2, 5);
      const color = Phaser.Math.RND.pick([0xffcc00, 0xff5500, 0xff2200]);
      const ember = this.scene.add.circle(x, y, r, color, 0.85).setDepth(51);

      this.scene.tweens.add({
        targets: ember,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed - Phaser.Math.Between(10, 30),
        alpha: 0,
        scale: 0.1,
        duration: Phaser.Math.Between(400, 600),
        onComplete: () => ember.destroy(),
      });
    }
  }

  /**
   * Enemy death particles: dark dust and soul sparks.
   */
  enemyDeath(x: number, y: number): void {
    // 15 grey smoke particles that drift upwards and fade out (dissipate into smoke)
    for (let i = 0; i < 15; i++) {
      const dx = Phaser.Math.Between(-20, 20);
      const dy = Phaser.Math.Between(-30, 10);
      const r = Phaser.Math.Between(8, 16);
      const smoke = this.scene.add.circle(x + dx, y + dy, r, 0x555555, 0.7).setDepth(35);

      this.scene.tweens.add({
        targets: smoke,
        x: smoke.x + Phaser.Math.Between(-30, 30),
        y: y + dy - Phaser.Math.Between(60, 120),
        scale: { from: 1.0, to: 1.8 },
        alpha: 0,
        duration: Phaser.Math.Between(800, 1500),
        ease: 'Cubic.easeOut',
        onComplete: () => smoke.destroy(),
      });
    }

    // Fading soul spark floating up
    const spark = this.scene.add.text(x, y - 10, '✨', { fontSize: '13px' })
      .setOrigin(0.5)
      .setDepth(36)
      .setAlpha(0.9);

    this.scene.tweens.add({
      targets: spark,
      y: y - 80,
      alpha: 0,
      scale: 1.4,
      duration: 1200,
      ease: 'Sine.easeOut',
      onComplete: () => spark.destroy(),
    });
  }

  /**
   * Boss death: screen flash, rotating gold light beams, and massive smoke rings.
   */
  bossDeath(x: number, y: number): void {
    // Screen flash
    const flash = this.scene.add.graphics().setDepth(200);
    flash.fillStyle(0xffffff, 1);
    flash.fillRect(0, 0, this.scene.cameras.main.width, this.scene.cameras.main.height);
    flash.setScrollFactor(0);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy(),
    });

    // Massive gold light beams radiating
    const beamCount = 8;
    const beams: Phaser.GameObjects.Line[] = [];
    for (let i = 0; i < beamCount; i++) {
      const angle = (i * 360) / beamCount;
      const rad = Phaser.Math.DegToRad(angle);
      const line = this.scene.add.line(x, y, 0, 0, Math.cos(rad) * 150, Math.sin(rad) * 150, 0xf1c40f, 0.7)
        .setOrigin(0, 0)
        .setDepth(150);
      beams.push(line);

      this.scene.tweens.add({
        targets: line,
        alpha: 0,
        angle: angle + 90,
        scaleX: 2.0,
        scaleY: 2.0,
        duration: 1500,
        ease: 'Cubic.easeOut',
        onComplete: () => line.destroy(),
      });
    }

    // Huge dark smoke rings puffing out
    for (let i = 0; i < 20; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(30, 150);
      const r = Phaser.Math.Between(15, 30);
      const smoke = this.scene.add.circle(x, y, r, 0x111115, 0.8).setDepth(140);

      this.scene.tweens.add({
        targets: smoke,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed - Phaser.Math.Between(20, 50),
        alpha: 0,
        scale: 1.8,
        duration: Phaser.Math.Between(1200, 2000),
        onComplete: () => smoke.destroy(),
      });
    }
  }

  /**
   * Item pickup sparkle particles floating upwards.
   */
  itemPickup(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const color = Phaser.Math.RND.pick([0xf1c40f, 0x4fc3f7, 0xffffff]);
      const spark = this.scene.add.text(
        x + Phaser.Math.Between(-15, 15),
        y + Phaser.Math.Between(-10, 10),
        '✨',
        { fontSize: '11px', color: '#' + color.toString(16) }
      ).setOrigin(0.5).setDepth(80);

      this.scene.tweens.add({
        targets: spark,
        y: y - Phaser.Math.Between(40, 80),
        x: spark.x + Phaser.Math.Between(-15, 15),
        alpha: 0,
        scale: 1.3,
        duration: Phaser.Math.Between(600, 900),
        onComplete: () => spark.destroy(),
      });
    }
  }

  /**
   * Portal glow/dark mist when enemies spawn.
   */
  enemySpawn(x: number, y: number): void {
    // 12 large black/dark-grey smoke circles that drift outward and fade (black cloud)
    for (let i = 0; i < 12; i++) {
      const px = x + Phaser.Math.Between(-15, 15);
      const py = y + Phaser.Math.Between(-20, 10);
      const r = Phaser.Math.Between(15, 25);
      const cloud = this.scene.add.circle(px, py, r, 0x111111, 0.8).setDepth(4);

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(10, 40);

      this.scene.tweens.add({
        targets: cloud,
        x: px + Math.cos(angle) * speed,
        y: py + Math.sin(angle) * speed - Phaser.Math.Between(10, 25),
        scale: 1.5,
        alpha: 0,
        duration: Phaser.Math.Between(800, 1400),
        ease: 'Cubic.easeOut',
        onComplete: () => cloud.destroy(),
      });
    }

    // Expanding purple portal ring
    const portal = this.scene.add.graphics().setDepth(5);
    portal.fillStyle(0x333333, 0.3);
    portal.fillCircle(x, y, 20);
    portal.lineStyle(1.5, 0x222222, 0.6);
    portal.strokeCircle(x, y, 20);

    this.scene.tweens.add({
      targets: portal,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 600,
      onComplete: () => portal.destroy(),
    });
  }

  /**
   * Flashing red rectangular warning overlay indicating charge path.
   */
  bossSkillWarningCharge(x: number, y: number, dir: number, range: number): void {
    const width = range;
    const height = 40;
    const rectX = dir > 0 ? x : x - width;
    const rectY = y - height / 2;

    const warning = this.scene.add.graphics().setDepth(4);
    warning.fillStyle(0xff0000, 0.2);
    warning.fillRect(rectX, rectY, width, height);
    warning.lineStyle(2, 0xff0000, 0.6);
    warning.strokeRect(rectX, rectY, width, height);

    this.scene.tweens.add({
      targets: warning,
      alpha: 0.1,
      yoyo: true,
      repeat: 3,
      duration: 100,
      onComplete: () => warning.destroy(),
    });
  }

  /**
   * Flashing red circular warning overlay showing slam impact zone.
   */
  bossSkillWarningSlam(x: number, y: number, radius: number): void {
    const warning = this.scene.add.graphics().setDepth(4);
    warning.fillStyle(0xff0000, 0.25);
    warning.fillCircle(x, y, radius);
    warning.lineStyle(2, 0xff0000, 0.7);
    warning.strokeCircle(x, y, radius);

    this.scene.tweens.add({
      targets: warning,
      alpha: 0.1,
      yoyo: true,
      repeat: 4,
      duration: 100,
      onComplete: () => warning.destroy(),
    });
  }

  /**
   * Spawns expanding shockwaves when boss roars.
   */
  bossIntroShockwave(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const ring = this.scene.add.graphics().setDepth(10);
      ring.lineStyle(4, 0xff3333, 0.8);
      ring.strokeCircle(x, y, 10);

      this.scene.tweens.add({
        targets: ring,
        scaleX: 20,
        scaleY: 20,
        alpha: 0,
        duration: 800 + i * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
  }

  /**
   * Spawns expanding fiery blast and radiating sparks on boss phase transition.
   */
  bossPhaseBlast(x: number, y: number): void {
    const blast = this.scene.add.graphics().setDepth(15);
    blast.fillStyle(0xffaa00, 0.45);
    blast.fillCircle(x, y, 20);

    this.scene.tweens.add({
      targets: blast,
      scaleX: 12,
      scaleY: 12,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => blast.destroy(),
    });

    for (let i = 0; i < 24; i++) {
      const angle = (i * Math.PI * 2) / 24;
      const speed = Phaser.Math.Between(100, 300);
      const spark = this.scene.add.circle(x, y, 4, 0xff3300, 0.95).setDepth(14);

      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.2,
        duration: 800,
        onComplete: () => spark.destroy(),
      });
    }
  }

  /**
   * Visual red ember particles trailing behind enraged boss.
   */
  bossRageTrail(x: number, y: number): void {
    const px = x + Phaser.Math.Between(-16, 16);
    const py = y + Phaser.Math.Between(-20, 20);
    const size = Phaser.Math.Between(3, 7);
    const particle = this.scene.add.circle(px, py, size, 0xff0000, 0.7).setDepth(5);

    this.scene.tweens.add({
      targets: particle,
      y: py - Phaser.Math.Between(20, 40),
      alpha: 0,
      scale: 0.1,
      duration: 600,
      onComplete: () => particle.destroy(),
    });
  }

  /**
   * Spawns warning exclamation mark/text above boss's head.
   */
  bossSkillWarningIcon(x: number, y: number, duration: number = 400): void {
    const warning = this.scene.add.text(x, y - 55, '⚠️ WARNING', {
      fontSize: '12px',
      color: '#ff2222',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      fontFamily: 'Cinzel, serif'
    }).setOrigin(0.5).setDepth(200);

    this.scene.tweens.add({
      targets: warning,
      scale: { from: 0.8, to: 1.2 },
      alpha: { from: 1, to: 0.3 },
      yoyo: true,
      repeat: 2,
      duration: duration / 4,
      onComplete: () => warning.destroy()
    });
  }
}
