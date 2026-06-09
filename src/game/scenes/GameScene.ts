/**
 * GameScene - Main gameplay scene.
 *
 * Integrates: Player, Enemies, WeaponSystem, SkillSystem, SpawnSystem,
 * DamageSystem, bullets, fireballs, lifesteal, EXP, skills cooldown HUD.
 */
import Phaser from 'phaser';
import { SceneKey, GameEvent } from '../../types/game.types';
import { Player } from '../entities/player/Player';
import { Enemy } from '../entities/enemies/Enemy';
import { Chest } from '../entities/objects/Chest';
import { Document } from '../entities/objects/Document';
import { CraftingTable } from '../entities/objects/CraftingTable';
import { CameraManager } from '../managers/CameraManager';
import { ParallaxBackground } from '../systems/ParallaxBackground';
import { SpawnSystem } from '../systems/SpawnSystem';
import { DamageSystem } from '../systems/DamageSystem';
import { SkillSystem, SKILLS } from '../systems/SkillSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { InventorySystem, ITEM_REGISTRY } from '../systems/InventorySystem';
import EventBus from '../EventBus';
import { AudioManager } from '../managers/AudioManager';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  TILE_SIZE,
  SKILL_FIREBALL_DAMAGE,
  SKILL_ULTIMATE_DAMAGE,
  SKILL_STUN_BLAST_DAMAGE,
  PLAYER_INITIAL_STATS,
  LEVEL_HP_BONUS,
  LEVEL_MP_BONUS,
  LEVEL_ATK_BONUS,
  LEVEL_DEF_BONUS,
} from '../utils/Constants';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private cameraManager!: CameraManager;
  private parallax!: ParallaxBackground;
  private spawnSystem!: SpawnSystem;
  private effectsSystem!: EffectsSystem;
  private enemiesGroup!: Phaser.Physics.Arcade.Group;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;

  /** Active bullets from gun */
  private bullets!: Phaser.Physics.Arcade.Group;

  /** Active fireballs from Q skill */
  private fireballs!: Phaser.Physics.Arcade.Group;

  /** Track processed melee hits per swing */
  private attackProcessed: Set<number> = new Set();

  /** Unique ID counter for enemies */
  private nextEnemyId: number = 1;

  /** Whether the game is currently paused */
  private isPaused: boolean = false;

  /** Total score accumulated from kills */
  private totalScore: number = 0;

  /** Inventory system */
  private inventorySystem!: InventorySystem;

  /** Treasure chests */
  private chests: Chest[] = [];

  /** Lore documents */
  private documents: Document[] = [];
  private collectedDocIds: Set<string> = new Set();

  /** Crafting Table for document merging */
  private craftingTable!: CraftingTable;

  /** Progress tracking for save/restore */
  private killCount: number = 0;
  private bossDefeated: boolean = false;
  public loadedAchievements: string[] = [];
  public activeSlowFields: { x: number; y: number; radius: number; level: number }[] = [];

  constructor() {
    super({ key: SceneKey.GAME });
  }

  // ── Create ─────────────────────────────────────────────────────────

  create(): void {
    AudioManager.getInstance().playBgm('gameplay');
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.parallax = new ParallaxBackground(this, WORLD_WIDTH, WORLD_HEIGHT);
    this.platforms = this.createLevel();

    this.player = new Player(this, 160, WORLD_HEIGHT - TILE_SIZE * 2 - 48);
    this.physics.add.collider(this.player, this.platforms);

    // ── Projectile groups ────────────────────────────────────────
    this.bullets = this.physics.add.group({
      runChildUpdate: false,
      allowGravity: false,
    });

    this.fireballs = this.physics.add.group({
      runChildUpdate: false,
      allowGravity: false,
    });

    // ── Enemies ──────────────────────────────────────────────────
    this.enemiesGroup = this.physics.add.group({ runChildUpdate: false });

    this.spawnSystem = new SpawnSystem(
      this, this.player, this.enemiesGroup, this.platforms,
    );
    this.setupSpawnPoints();

    // ── Effects ──────────────────────────────────────────────────
    this.effectsSystem = new EffectsSystem(this);

    // ── Treasure Chests ───────────────────────────────────────
    this.spawnChests();

    // ── Lore Documents ───────────────────────────────────────
    this.spawnDocuments();

    // ── Collisions ───────────────────────────────────────────────

    // Player ↔ enemies (contact damage)
    this.physics.add.overlap(
      this.player, this.enemiesGroup,
      this.handlePlayerEnemyContact as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );

    // Bullets ↔ enemies
    this.physics.add.overlap(
      this.bullets, this.enemiesGroup,
      this.handleBulletEnemyHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );

    // Fireballs ↔ enemies
    this.physics.add.overlap(
      this.fireballs, this.enemiesGroup,
      this.handleFireballEnemyHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined, this,
    );

    // Bullets ↔ platforms (recycle on impact with effect)
    this.physics.add.collider(this.bullets, this.platforms, (bullet) => {
      const b = bullet as Phaser.GameObjects.Rectangle;
      if (b.active) {
        this.effectsSystem.bulletImpact(b.x, b.y);
        this.killBullet(b);
      }
    });

    // ── Camera ───────────────────────────────────────────────────
    this.cameraManager = new CameraManager(this);
    this.cameraManager.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameraManager.startFollow(this.player, 0.1);

    // ── HUD ──────────────────────────────────────────────────────
    this.scene.launch(SceneKey.UI);

    // ── Click outside to deselect enemy ──────────────────────────
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (pointer.leftButtonDown() || pointer.rightButtonDown()) {
        const clickedEnemy = currentlyOver.find(go => go instanceof Enemy);
        if (!clickedEnemy) {
          EventBus.emit('enemy-selected', null);
        }
      }
    });

    // ── Events ───────────────────────────────────────────────────
    EventBus.on(GameEvent.ENEMY_KILLED, this.onEnemyKilled, this);
    EventBus.on('boss-attack-hit', this.onBossAttackHit, this);

    // Listen for resume from UIScene (button click)
    EventBus.on(GameEvent.GAME_RESUMED, this.resumeGame, this);
    EventBus.on(GameEvent.GAME_PAUSED, this.pauseGame, this);

    // ── Inventory ────────────────────────────────────────────────
    this.inventorySystem = new InventorySystem();

    this.events.on('shutdown', () => {
      EventBus.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled, this);
      EventBus.off('boss-attack-hit', this.onBossAttackHit, this);
      EventBus.off(GameEvent.GAME_RESUMED, this.resumeGame, this);
      EventBus.off(GameEvent.GAME_PAUSED, this.pauseGame, this);
      this.spawnSystem.destroy();
      this.inventorySystem.destroy();
      // Destroy chests
      for (const chest of this.chests) {
        chest.destroyChest();
      }
      this.chests = [];
      // Destroy documents
      for (const doc of this.documents) {
        doc.destroyDocument();
      }
      this.documents = [];
      // Destroy crafting table
      if (this.craftingTable) {
        this.craftingTable.destroyTable();
      }
    });

    EventBus.emit(GameEvent.SCENE_READY, this);

    // Send inventory reference to UIScene
    EventBus.emit('inventory-ready', this.inventorySystem);
  }

  // ── Pause System ───────────────────────────────────────────────────

  private togglePause(): void {
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame({ manual: true });
    }
  }

  private pauseGame(data?: { manual?: boolean } | any): void {
    if (!this.sys || !this.sys.isActive() || !this.physics || !this.physics.world) return;
    if (this.isPaused) return; // Prevent recursive loops
    this.isPaused = true;
    this.physics.world.pause();
    this.time.paused = true;
    this.tweens.pauseAll();
    // Pause all enemy animations
    for (const enemy of this.spawnSystem.getAliveEnemies()) {
      if (enemy.active && enemy.anims) {
        enemy.anims.pause();
      }
    }
    if (this.player.active && this.player.anims) {
      this.player.anims.pause();
    }
    const isManual = data && typeof data === 'object' && data.manual === true;
    EventBus.emit(GameEvent.GAME_PAUSED, { manual: isManual });
  }

  private resumeGame(): void {
    if (!this.sys || !this.sys.isActive() || !this.physics || !this.physics.world) return;
    if (!this.isPaused) return; // Prevent recursive loops
    this.isPaused = false;
    this.physics.world.resume();
    this.time.paused = false;
    this.tweens.resumeAll();
    // Resume all enemy animations
    for (const enemy of this.spawnSystem.getAliveEnemies()) {
      if (enemy.active && enemy.anims) {
        enemy.anims.resume();
      }
    }
    if (this.player.active && this.player.anims) {
      this.player.anims.resume();
    }
    // Note: Do NOT re-emit GAME_RESUMED here — this method is called
    // FROM the EventBus listener.  Re-emitting would cause a loop.
  }

  // ── Update ─────────────────────────────────────────────────────────

  update(time: number, delta: number): void {
    // ESC check reads from player cached controller inputs to prevent double-polling
    const input = this.player.controller.getInput();
    if (input.pause) {
      const uiScene = this.scene.get(SceneKey.UI) as any;
      if (uiScene) {
        if (typeof uiScene.isInventoryOpen === 'function' && uiScene.isInventoryOpen()) {
          EventBus.emit(GameEvent.INVENTORY_TOGGLE, { open: false });
          AudioManager.getInstance().playSFX('inventory');
          return;
        }
        if (typeof uiScene.hasActiveOverlay === 'function' && uiScene.hasActiveOverlay()) {
          return;
        }
      }
      this.togglePause();
      return;
    }

    // Skip all game logic when paused
    if (this.isPaused) return;

    this.spawnSystem.update(time, delta);

    // Spawn boss dynamically when player gets close to boss arena
    if (!this.bossDefeated && this.player.x >= 2400) {
      this.spawnSystem.activateSpawnPoint('spawn-boss');
    }

    this.checkMeleeCollisions();
    this.checkPlayerSlashEffect();
    this.checkPlayerBulletFire();
    this.checkPlayerSkills(time);
    this.emitSkillCooldowns(time);
    this.updateBulletTrails();
    this.updateFireballTrails();
    this.cleanupBullets();
    this.handleChestInteraction();
    this.handleDocumentInteraction();
    this.handleCraftingTableInteraction();
  }

  // ── Melee combat ───────────────────────────────────────────────────

  private checkMeleeCollisions(): void {
    const hitbox = this.player.getAttackHitbox();
    if (!hitbox || !hitbox.body) {
      // Attack ended — reset processed set
      if (this.attackProcessed.size > 0) this.attackProcessed.clear();
      return;
    }

    const p = this.player as any;
    const angle = p._attackAngle !== undefined ? p._attackAngle : (this.player.facing === 'right' ? 0 : Math.PI);
    const radius = this.player.level >= 5 ? 80 : 55;
    const hitRange = radius + 24; // Include quái body radius margin
    const cx = this.player.x + 10 * Math.cos(angle);
    const cy = this.player.y + 10 * Math.sin(angle);

    const enemies = this.spawnSystem.getAliveEnemies();
    let lightningTriggered = false;
    let mpRestored = false;

    for (const enemy of enemies) {
      if (!enemy.active || !enemy.body) continue;

      const eid = this.getEnemyId(enemy);
      if (this.attackProcessed.has(eid)) continue;

      const dist = Phaser.Math.Distance.Between(cx, cy, enemy.x, enemy.y);
      const enemyAngle = Phaser.Math.Angle.Between(cx, cy, enemy.x, enemy.y);
      const diff = Phaser.Math.Angle.ShortestBetween(angle, enemyAngle);
      
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      const enemySize = Math.max(body.width, body.height) / 2;
      const effectiveDist = dist - enemySize;
      const maxSlashRadius = radius * 1.3;
      
      const inSlashRange = effectiveDist <= maxSlashRadius && Math.abs(diff) <= Phaser.Math.DegToRad(75);

      if (inSlashRange) {
        this.attackProcessed.add(eid);

        const weapon = this.player.getWeaponSystem();
        const critChanceOverride = this.player.level < 9 ? -1 : 0;
        const isBoss = enemy.config.category === 'boss';
        const result = DamageSystem.calculateDamage(
          this.player.stats, enemy.stats,
          weapon.getDamage(), weapon.getKnockback(),
          critChanceOverride,
          isBoss,
        );

        enemy.takeDamage(result.finalDamage);
        if (isBoss) {
          this.player.applyGrievousWounds(5000);
        }

        DamageSystem.applyKnockback(enemy, this.player.x, result.knockbackForce);

        DamageSystem.showDamageNumber(
          this, enemy.x, enemy.y, result.finalDamage, result.isCritical,
        );

        // Visual effects: hit sparks + flash + hitstop
        if (result.isCritical) {
          this.effectsSystem.criticalHitExplosion(enemy.x, enemy.y);
          this.triggerHitStop(120);
          this.cameraManager.shake(150, 0.007);
        } else {
          this.effectsSystem.swordHitSparks(enemy.x, enemy.y);
          this.triggerHitStop(50);
          this.cameraManager.shake(60, 0.002);
        }
        this.effectsSystem.hitFlash(enemy);

        // Lifesteal
        this.player.applyLifesteal(result.finalDamage, isBoss);

        // Chain lightning if level >= 7 (once per swing)
        if (this.player.level >= 7 && !lightningTriggered) {
          this.triggerChainLightning(enemy, result.finalDamage);
          lightningTriggered = true;
        }

        // Mana recovery (once per swing)
        if (!mpRestored) {
          const mpRegen = Math.floor(this.player.stats.maxMp * 0.05);
          this.player.restoreMp(mpRegen);
          mpRestored = true;
        }
      }
    }
  }

  private triggerChainLightning(sourceEnemy: Enemy, baseDamage: number): void {
    const maxJumps = 5;
    const range = 300;
    const hitEnemies = new Set<Enemy>();
    hitEnemies.add(sourceEnemy);

    let currentSource: { x: number; y: number } = sourceEnemy;
    const jumps: { from: { x: number; y: number }, to: Enemy }[] = [];

    for (let i = 0; i < maxJumps; i++) {
      let nearestEnemy: Enemy | null = null;
      let nearestDist = range;

      for (const enemy of this.spawnSystem.getAliveEnemies()) {
        if (!enemy.active || hitEnemies.has(enemy)) continue;

        const dist = Phaser.Math.Distance.Between(currentSource.x, currentSource.y, enemy.x, enemy.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = enemy;
        }
      }

      if (nearestEnemy) {
        hitEnemies.add(nearestEnemy);
        jumps.push({ from: { x: currentSource.x, y: currentSource.y }, to: nearestEnemy });
        currentSource = nearestEnemy;
      } else {
        break; // No more enemies in range
      }
    }

    // Apply damage and draw lightning for each jump
    jumps.forEach((jump, index) => {
      this.time.delayedCall(index * 80, () => {
        if (!jump.to.active) return;

        const lightningDmg = Math.round(baseDamage * 1.2);
        jump.to.takeDamage(lightningDmg);
        DamageSystem.showDamageNumber(this, jump.to.x, jump.to.y, lightningDmg, false);
        this.effectsSystem.hitFlash(jump.to);

        // Draw lightning bolt
        this.drawLightningBolt(jump.from.x, jump.from.y, jump.to.x, jump.to.y);
      });
    });
  }

  private drawLightningBolt(startX: number, startY: number, endX: number, endY: number): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x00ffff, 1.0);
    graphics.setDepth(150);

    const dist = Phaser.Math.Distance.Between(startX, startY, endX, endY);
    const steps = Math.max(3, Math.floor(dist / 30));

    graphics.beginPath();
    graphics.moveTo(startX, startY);

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const lx = Phaser.Math.Linear(startX, endX, t);
      const ly = Phaser.Math.Linear(startY, endY, t);

      // Jagged displacement perpendicular to direction
      const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY) + Math.PI / 2;
      const displacement = Phaser.Math.Between(-12, 12);
      const px = lx + Math.cos(angle) * displacement;
      const py = ly + Math.sin(angle) * displacement;

      graphics.lineTo(px, py);
    }

    graphics.lineTo(endX, endY);
    graphics.strokePath();

    // Glow effect (thicker neon blue glow line)
    const glow = this.add.graphics();
    glow.lineStyle(6, 0x00ffff, 0.3);
    glow.setDepth(149);
    glow.beginPath();
    glow.moveTo(startX, startY);
    glow.lineTo(endX, endY);
    glow.strokePath();

    this.tweens.add({
      targets: [graphics, glow],
      alpha: 0,
      duration: 250,
      onComplete: () => {
        graphics.destroy();
        glow.destroy();
      }
    });

    AudioManager.getInstance().playSFX('ui-click');
  }

  // ── Sword: slash VFX ──────────────────────────────────────────────

  private checkPlayerSlashEffect(): void {
    const p = this.player as any;
    if (!p._swingSlash) return;
    p._swingSlash = false;

    const angle = p._attackAngle !== undefined ? p._attackAngle : (this.player.facing === 'right' ? 0 : Math.PI);
    this.effectsSystem.slashArc(this.player.x, this.player.y, angle, this.player.level);
  }

  // ── Gun: bullet fire ───────────────────────────────────────────────

  private killBullet(bullet: Phaser.GameObjects.Rectangle): void {
    if (!bullet.active) return;
    bullet.setActive(false);
    bullet.setVisible(false);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setEnable(false);
      body.setVelocity(0, 0);
    }
  }

  private checkPlayerBulletFire(): void {
    const p = this.player as any;
    if (!p._firedBullet) return;
    p._firedBullet = false;

    const weapon = this.player.getWeaponSystem();
    const angle = p._attackAngle !== undefined ? p._attackAngle : (this.player.facing === 'right' ? 0 : Math.PI);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const bx = this.player.x + 20 * cos;
    const by = this.player.y + 20 * sin;
    const vx = weapon.getBulletSpeed() * cos;
    const vy = weapon.getBulletSpeed() * sin;

    let bullet = this.bullets.getFirstDead(false) as Phaser.GameObjects.Rectangle;
    if (bullet) {
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.setPosition(bx, by);
      bullet.setRotation(angle);
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setEnable(true);
        body.setVelocity(vx, vy);
      }
    } else {
      bullet = this.add.rectangle(bx, by, 8, 4, 0xffff00, 1);
      bullet.setRotation(angle);
      this.physics.add.existing(bullet);
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      this.bullets.add(bullet);
      body.setVelocity(vx, vy);
    }

    // Store spawn position for max range check
    bullet.setData('spawnX', this.player.x);
    bullet.setData('spawnY', this.player.y);
    bullet.setData('maxRange', weapon.getMaxRange());

    // Muzzle flash VFX
    this.effectsSystem.muzzleFlash(this.player.x, this.player.y, angle);

    // Auto-kill after lifetime (fallback safety net)
    this.time.delayedCall(weapon.getBulletLifetime(), () => {
      this.killBullet(bullet);
    });
  }

  // ── Bullet ↔ Enemy ─────────────────────────────────────────────────

  private handleBulletEnemyHit(
    bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void {
    const bullet = bulletObj as Phaser.GameObjects.Rectangle;
    const enemy = enemyObj as unknown as Enemy;
    if (!enemy.active) return;

    const weapon = this.player.getWeaponSystem();
    let critChance = weapon.getCriticalChance();
    if (this.player.level >= 9) {
      if (enemy.currentHp / enemy.maxHp < 0.2) {
        critChance = 1.0;
      }
    }
    const isBoss = enemy.config.category === 'boss';
    const result = DamageSystem.calculateDamage(
      this.player.stats, enemy.stats,
      weapon.getDamage(), weapon.getKnockback(),
      critChance,
      isBoss,
    );

    enemy.takeDamage(result.finalDamage);
    if (isBoss) {
      this.player.applyGrievousWounds(5000);
    }
    DamageSystem.applyKnockback(enemy, bullet.x, result.knockbackForce);
    DamageSystem.showDamageNumber(this, enemy.x, enemy.y, result.finalDamage, result.isCritical);

    // Bullet impact VFX
    this.effectsSystem.bulletImpact(bullet.x, bullet.y);
    if (result.isCritical) {
      this.effectsSystem.criticalHitExplosion(enemy.x, enemy.y);
      this.triggerHitStop(100);
      this.cameraManager.shake(120, 0.006);
    } else {
      this.triggerHitStop(40);
      this.cameraManager.shake(50, 0.001);
    }
    this.effectsSystem.hitFlash(enemy);

    // Mana recovery
    const mpRegen = Math.floor(this.player.stats.maxMp * 0.05);
    this.player.restoreMp(mpRegen);

    this.killBullet(bullet);
  }

  // ── Fireball ↔ Enemy ───────────────────────────────────────────────

  private killFireball(fb: Phaser.GameObjects.Rectangle): void {
    if (!fb.active) return;
    fb.setActive(false);
    fb.setVisible(false);
    const body = fb.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setEnable(false);
      body.setVelocity(0, 0);
    }
  }

  private handleFireballEnemyHit(
    fbObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void {
    const fb = fbObj as Phaser.GameObjects.Rectangle;
    const enemy = enemyObj as unknown as Enemy;
    if (!enemy.active) return;

    let dmg = SKILL_FIREBALL_DAMAGE + this.player.skillDamageBonus;
    if (this.player.level >= 9) {
      dmg *= 1.5;
    }
    const finalDamage = Math.round(dmg);

    this.effectsSystem.fireballExplosion(fb.x, fb.y);
    enemy.takeDamage(finalDamage);
    DamageSystem.applyKnockback(enemy, fb.x, 250);
    DamageSystem.showDamageNumber(this, enemy.x, enemy.y, finalDamage, false);
    this.effectsSystem.hitFlash(enemy);

    this.killFireball(fb);
    this.triggerHitStop(60);
    this.cameraManager.shake(120, 0.004);
  }

  // ── Skills ─────────────────────────────────────────────────────────

  private checkPlayerSkills(time: number): void {
    const p = this.player as unknown as { _pendingSkill?: string | null };
    if (!p._pendingSkill) return;

    const skillId = p._pendingSkill;
    p._pendingSkill = null;

    const skillSystem = this.player.getSkillSystem();
    const skill = skillSystem.use(skillId, this.player.stats.currentMp, time, this.player.level);
    if (!skill) return;

    // Deduct MP
    this.player.spendMp(skill.mpCost);

    if (skillId === 'fireball') {
      const pointer = this.input.activePointer;

      // Flip player towards mouse cursor
      this.player.applyFacing((pointer.worldX < this.player.x ? 'left' : 'right') as any);
      const facingRight = this.player.facing === ('right' as string);

      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const fbx = this.player.x + 20 * cos;
      const fby = this.player.y + 20 * sin;
      const fvx = 350 * cos; // SKILL_FIREBALL_SPEED is 350
      const fvy = 350 * sin;

      const isLevel9 = this.player.level >= 9;
      const fbSize = isLevel9 ? 32 : 16;

      let fb = this.fireballs.getFirstDead(false) as Phaser.GameObjects.Rectangle;
      if (fb) {
        fb.setActive(true);
        fb.setVisible(true);
        fb.setPosition(fbx, fby);
        fb.setRotation(angle);
        fb.setSize(fbSize, fbSize);
        const body = fb.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.setEnable(true);
          body.setSize(fbSize, fbSize);
          body.setVelocity(fvx, fvy);
        }
      } else {
        fb = SkillSystem.createFireball(this, this.player.x, this.player.y, facingRight);
        fb.setPosition(fbx, fby);
        fb.setRotation(angle);
        fb.setSize(fbSize, fbSize);
        this.fireballs.add(fb);
        const body = fb.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.setSize(fbSize, fbSize);
          body.setVelocity(fvx, fvy);
        }
      }

      AudioManager.getInstance().playSFX('fireball');

      // Auto-kill after lifetime
      this.time.delayedCall(2000, () => {
        this.killFireball(fb);
      });
    } else if (skillId === 'slow') {
      const enemies = this.spawnSystem.getAliveEnemies();
      SkillSystem.createSlowField(this, this.player.x, this.player.y, enemies);
    } else if (skillId === 'ultimate') {
      const enemies = this.spawnSystem.getAliveEnemies();
      const hit = SkillSystem.createUltimateBurst(this, this.player.x, this.player.y, enemies);
      for (const target of hit) {
        const e = target as unknown as Enemy;
        const baseDamage = SKILL_ULTIMATE_DAMAGE + this.player.skillDamageBonus;

        let damage = baseDamage;
        let isCrit = false;

        const isLarge = e.config.category === 'elite' || e.config.category === 'boss';

        if (this.player.level >= 10 && isLarge) {
          damage = e.currentHp * 0.1;
        } else if (this.player.level >= 9) {
          damage = baseDamage * 1.3; // +30% damage

          // Crit chance: 60% base, 100% if enemy HP < 20%
          const hpPercent = e.currentHp / e.maxHp;
          const critChance = hpPercent < 0.2 ? 1.0 : 0.6;
          isCrit = Math.random() < critChance;

          if (isCrit) {
            damage *= this.player.stats.criticalDamage;
            if (e.config.category === 'boss') {
              damage *= 0.5; // 50% critical damage reduction
            }
          }
        }

        const finalDamage = Math.round(damage);
        e.takeDamage(finalDamage);
        DamageSystem.showDamageNumber(this, e.x, e.y, finalDamage, isCrit);
        DamageSystem.applyKnockback(e, this.player.x, 300);

        if (isCrit) {
          this.effectsSystem.criticalHitExplosion(e.x, e.y);
        }
      }
      this.cameraManager.shake(200, 0.008);
    } else if (skillId === 'stun_blast') {
      const enemies = this.spawnSystem.getAliveEnemies();
      const hit = SkillSystem.createStunBlast(this, this.player.x, this.player.y, enemies);
      for (const target of hit) {
        const e = target as unknown as Enemy;
        const finalDamage = SKILL_STUN_BLAST_DAMAGE + this.player.skillDamageBonus;
        e.takeDamage(finalDamage);
        DamageSystem.showDamageNumber(this, e.x, e.y, finalDamage, false);
      }
      this.cameraManager.shake(120, 0.005);
    }
  }

  /** Emit skill cooldown progress every frame for HUD */
  private emitSkillCooldowns(time: number): void {
    const skillSystem = this.player.getSkillSystem();
    for (const id of Object.keys(SKILLS)) {
      const progress = skillSystem.getCooldownProgress(id, time, this.player.level);
      const remaining = skillSystem.getRemainingCooldown(id, time, this.player.level);
      EventBus.emit(GameEvent.SKILL_COOLDOWN, { id, progress, remainingMs: remaining });
    }

    // Emit dash cooldown (weapon-dependent)
    const dashCd = this.player.getDashCooldown();
    const elapsed = time - this.player.lastDashTime;
    const remaining = Math.max(0, dashCd - elapsed);
    const progress = Math.min(1, elapsed / dashCd);
    EventBus.emit(GameEvent.SKILL_COOLDOWN, { id: 'dash', progress, remainingMs: remaining });
  }

  // ── Contact damage ─────────────────────────────────────────────────

  private handlePlayerEnemyContact(
    _player: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void {
    const enemy = enemyObj as unknown as Enemy;
    if (!enemy.active) return;

    const damage = enemy.stats.attack;
    const dealt = this.player.takeDamage(damage);

    if (dealt > 0) {
      DamageSystem.applyKnockback(this.player, enemy.x, 180, -120);
      DamageSystem.showDamageNumber(this, this.player.x, this.player.y, dealt, false);
      this.cameraManager.shake(120, 0.005);
    }
  }

  // ── Enemy kill ─────────────────────────────────────────────────────

  private onEnemyKilled(data: { exp: number; gold: number; score: number; x: number; y: number; type?: string }): void {
    if (!this.sys.isActive()) return;

    // Track kills
    this.killCount++;
    EventBus.emit('kills-changed', { kills: this.killCount });

    // Track score
    this.totalScore += data.score;
    EventBus.emit(GameEvent.SCORE_CHANGED, { score: this.totalScore });

    // Check if boss was killed
    if (data.type === 'ancient_knight') {
      this.bossDefeated = true;
      this.spawnSystem.deactivateSpawnPoint('spawn-boss');
      AudioManager.getInstance().playBgm('gameplay');

      // Spawn Crafting Table
      this.spawnCraftingTable();

      // Game continues running at normal speed

      EventBus.emit('boss-slain');

      const spawnX = data.x || 3000;
      const tx = data.x !== undefined ? data.x : 3000;
      const ty = data.y !== undefined ? data.y : (WORLD_HEIGHT - TILE_SIZE - 80);

      // Direct loot drop (150 gold, 2 health potions, 2 mana potions)
      this.inventorySystem.addGold(150);
      this.inventorySystem.addItem('health_potion', 2);
      this.inventorySystem.addItem('mana_potion', 2);

      // Floating gold text
      const goldText = this.add.text(tx, ty - 30, `+150 💰`, {
        fontSize: '14px', color: '#f1c40f', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(100);
      this.tweens.add({
        targets: goldText,
        y: ty - 80,
        alpha: 0,
        duration: 1500,
        onComplete: () => goldText.destroy(),
      });

      // Floating items text
      const potionText = this.add.text(tx + 40, ty - 30, `+2 ❤️, +2 💙`, {
        fontSize: '13px', color: '#e74c3c', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(100);
      this.tweens.add({
        targets: potionText,
        y: ty - 75,
        alpha: 0,
        duration: 1800,
        onComplete: () => potionText.destroy(),
      });

      // Spawn Mảnh Giấy 3 on the ground at a fixed position near the boss
      const doc3Y = WORLD_HEIGHT - TILE_SIZE - 12;
      const doc3 = new Document(this, 2900, doc3Y, 'doc_3');
      this.documents.push(doc3);
    }

    // Floating XP text
    const expText = this.add.text(data.x, data.y - 30, `+${data.exp} XP`, {
      fontSize: '12px', color: '#f39c12', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: expText,
      y: data.y - 70,
      alpha: 0,
      duration: 1200,
      onComplete: () => expText.destroy(),
    });

    // Floating score text (offset right)
    const scoreText = this.add.text(data.x + 30, data.y - 30, `+${data.score}`, {
      fontSize: '11px', color: '#e74c3c', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: scoreText,
      y: data.y - 65,
      alpha: 0,
      duration: 1000,
      onComplete: () => scoreText.destroy(),
    });
  }

  private onBossAttackHit(data: { damage: number; x: number; y: number; direction: number }): void {
    if (!this.sys.isActive() || !this.player.active || this.player.isDead) return;

    this.player.takeDamage(data.damage);
    DamageSystem.showDamageNumber(this, this.player.x, this.player.y, data.damage, false);
    this.effectsSystem.hitFlash(this.player);

    // Knockback from boss
    if (data.direction !== 0) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(data.direction * 200);
    }

    this.cameraManager.shake(120, 0.005);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private getEnemyId(enemy: Enemy): number {
    let id = enemy.getData('_eid') as number | undefined;
    if (id === undefined) {
      id = this.nextEnemyId++;
      enemy.setData('_eid', id);
    }
    return id;
  }

  /** Spawn trail particles behind each active bullet */
  private updateBulletTrails(): void {
    for (const bullet of this.bullets.getChildren()) {
      const b = bullet as Phaser.GameObjects.Rectangle;
      if (b.active) {
        this.effectsSystem.bulletTrailDot(b.x, b.y);
      }
    }
  }

  /** Spawn trailing fire particles behind each active fireball */
  private updateFireballTrails(): void {
    for (const fb of this.fireballs.getChildren()) {
      const f = fb as Phaser.GameObjects.Rectangle;
      if (f.active) {
        this.effectsSystem.fireballTrail(f.x, f.y);
      }
    }
  }

  private cleanupBullets(): void {
    for (const bullet of this.bullets.getChildren()) {
      const b = bullet as Phaser.GameObjects.Rectangle;
      if (!b.active) continue;

      // Max range check — recycle bullet with VFX when it exceeds weapon range
      const spawnX = b.getData('spawnX') as number | undefined;
      const spawnY = b.getData('spawnY') as number | undefined;
      const maxRange = b.getData('maxRange') as number | undefined;
      if (spawnX !== undefined && spawnY !== undefined && maxRange !== undefined && maxRange > 0) {
        const dist = Phaser.Math.Distance.Between(b.x, b.y, spawnX, spawnY);
        if (dist >= maxRange) {
          this.effectsSystem.bulletImpact(b.x, b.y);
          this.killBullet(b);
          continue;
        }
      }

      // Fallback: recycle bullets that left the world
      if (b.x < -50 || b.x > WORLD_WIDTH + 50 || b.y < -50 || b.y > WORLD_HEIGHT + 50) {
        this.killBullet(b);
      }
    }
  }

  // ── Spawn Points ───────────────────────────────────────────────────

  private setupSpawnPoints(): void {
    const groundY = WORLD_HEIGHT - TILE_SIZE - 32;
    const batY = WORLD_HEIGHT - TILE_SIZE * 6;  // Elevated for flying enemies

    const spawnConfigs = [
      { id: 'spawn-1', x: 500, y: groundY, enemyType: 'slime', maxEnemies: 2 },
      { id: 'spawn-2', x: 900, y: groundY, enemyType: 'goblin', maxEnemies: 1 },
      { id: 'spawn-3', x: 1300, y: groundY, enemyType: 'slime', maxEnemies: 2 },
      { id: 'spawn-4', x: 1700, y: groundY, enemyType: 'goblin', maxEnemies: 1 },
      { id: 'spawn-5', x: 2100, y: groundY, enemyType: 'slime', maxEnemies: 2 },
      { id: 'spawn-6', x: 2500, y: groundY, enemyType: 'goblin', maxEnemies: 1 },
      { id: 'spawn-7', x: 2900, y: groundY, enemyType: 'slime', maxEnemies: 2 },
      // Bats: elevated spawn points for flying enemies
      { id: 'spawn-bat-1', x: 700, y: batY, enemyType: 'bat', maxEnemies: 2 },
      { id: 'spawn-bat-2', x: 1500, y: batY, enemyType: 'bat', maxEnemies: 2 },
      { id: 'spawn-bat-3', x: 2300, y: batY, enemyType: 'bat', maxEnemies: 2 },
      // Boss: end of map
      { id: 'spawn-boss', x: 3000, y: WORLD_HEIGHT - TILE_SIZE - 80, enemyType: 'ancient_knight', maxEnemies: 1, isActive: false },
    ];

    for (const cfg of spawnConfigs) {
      this.spawnSystem.addSpawnPoint({
        id: cfg.id, x: cfg.x, y: cfg.y,
        enemyType: cfg.enemyType,
        maxEnemies: cfg.maxEnemies,
        respawnDelay: 8000,
        spawnRadius: 30,
        isActive: cfg.hasOwnProperty('isActive') ? (cfg as any).isActive : true,
      });
    }
  }

  // ── Treasure Chests ────────────────────────────────────────────────

  private spawnChests(): void {
    const groundY = WORLD_HEIGHT - TILE_SIZE - 16;

    const chestConfigs = [
      // Normal Chests
      {
        id: 'chest-1', x: 350, y: groundY,
        goldMin: 5, goldMax: 15,
        lootTable: [
          { itemId: 'health_potion', chance: 1.0, minQuantity: 3, maxQuantity: 6 },
          { itemId: 'mana_potion', chance: 1.0, minQuantity: 3, maxQuantity: 6 },
        ],
      },
      {
        id: 'chest-2', x: 1050, y: WORLD_HEIGHT - 200 - 16,
        goldMin: 10, goldMax: 30,
        lootTable: [
          { itemId: 'mana_potion', chance: 1.0, minQuantity: 4, maxQuantity: 8 },
          { itemId: 'health_potion', chance: 1.0, minQuantity: 4, maxQuantity: 8 },
        ],
      },
      {
        id: 'chest-3', x: 1800, y: groundY,
        goldMin: 15, goldMax: 40,
        lootTable: [
          { itemId: 'health_potion', chance: 1.0, minQuantity: 5, maxQuantity: 10 },
          { itemId: 'mana_potion', chance: 1.0, minQuantity: 5, maxQuantity: 10 },
        ],
      },
      {
        id: 'chest-4', x: 2600, y: WORLD_HEIGHT - 180 - 16,
        goldMin: 20, goldMax: 50,
        lootTable: [
          { itemId: 'health_potion', chance: 1.0, minQuantity: 6, maxQuantity: 12 },
          { itemId: 'mana_potion', chance: 1.0, minQuantity: 6, maxQuantity: 12 },
        ],
      },
    ];

    for (const cfg of chestConfigs) {
      const chest = new Chest(this, cfg);
      this.chests.push(chest);
    }
  }

  private handleChestInteraction(): void {
    const input = this.player.controller.getInput();
    this.chests = this.chests.filter(c => c.active);

    for (const chest of this.chests) {
      const inRange = chest.isPlayerInRange(this.player.x, this.player.y);
      chest.showPrompt(inRange);

      if (inRange && input.interact) {
        const loot = chest.open();
        if (loot) {
          this.effectsSystem.itemPickup(chest.x, chest.y);
          AudioManager.getInstance().playSFX('item-pickup');
          EventBus.emit(GameEvent.CHEST_OPENED, { chestId: chest.chestId });

          // Add gold
          this.inventorySystem.addGold(loot.gold);

          // Add items
          for (const item of loot.items) {
            this.inventorySystem.addItem(item.itemId, item.quantity);
          }

          // Random 30% chance to double basic stats for 5 seconds
          if (Math.random() < 0.3) {
            this.player.activateDoubleStatsBuff(5000);
          }

          // Floating gold text
          const goldText = this.add.text(chest.x, chest.y - 30, `+${loot.gold} 💰`, {
            fontSize: '14px', color: '#f1c40f', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 2,
          }).setOrigin(0.5).setDepth(100);

          this.tweens.add({
            targets: goldText,
            y: chest.y - 80,
            alpha: 0,
            duration: 1500,
            onComplete: () => goldText.destroy(),
          });

          // Floating item texts (stacked)
          let offsetY = 0;
          for (const item of loot.items) {
            offsetY += 18;
            const def = ITEM_REGISTRY[item.itemId];
            const itemName = def ? `${def.icon} ${def.name}` : item.itemId;

            const itemText = this.add.text(chest.x, chest.y - 30 - offsetY, `+${item.quantity} ${itemName}`, {
              fontSize: '12px', color: '#4fc3f7', fontStyle: 'bold',
              stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(100);

            this.tweens.add({
              targets: itemText,
              y: chest.y - 80 - offsetY,
              alpha: 0,
              duration: 1800,
              delay: offsetY * 5,
              onComplete: () => itemText.destroy(),
            });
          }

          // Camera shake for feedback
          this.cameraManager.shake(100, 0.002);
        }
      }
    }
  }

  private spawnDocuments(): void {
    const groundY = WORLD_HEIGHT - TILE_SIZE - 12;

    const documentConfigs = [
      { id: 'doc_1', x: 600, y: groundY },
      { id: 'doc_2', x: 1600, y: groundY },
    ];

    for (const cfg of documentConfigs) {
      const doc = new Document(this, cfg.x, cfg.y, cfg.id);
      this.documents.push(doc);
    }
  }

  private spawnCraftingTable(): void {
    if (this.craftingTable) return;
    const groundY = WORLD_HEIGHT - TILE_SIZE - 12;
    this.craftingTable = new CraftingTable(this, 3120, groundY);
  }

  private handleDocumentInteraction(): void {
    const input = this.player.controller.getInput();
    this.documents = this.documents.filter(d => d.active);

    for (const doc of this.documents) {
      const inRange = doc.isPlayerInRange(this.player.x, this.player.y);
      doc.showPrompt(inRange);

      if (inRange && input.interact) {
        const docDef = doc.collect();
        if (docDef) {
          // Direct addition to inventory system
          this.inventorySystem.addCollectedDocument(doc.docId);

          this.effectsSystem.itemPickup(doc.x, doc.y);
          AudioManager.getInstance().playSFX('item-pickup');
          // Pause the game scene
          this.pauseGame();

          // Floating pickup text
          const pickupText = this.add.text(doc.x, doc.y - 30, `📜 ${docDef.title}`, {
            fontSize: '12px', color: '#f1c40f', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 2,
          }).setOrigin(0.5).setDepth(100);

          this.tweens.add({
            targets: pickupText,
            y: doc.y - 80,
            alpha: 0,
            duration: 2000,
            onComplete: () => pickupText.destroy(),
          });

          // Camera shake
          this.cameraManager.shake(100, 0.002);
        }
      }
    }
  }

  private handleCraftingTableInteraction(): void {
    if (!this.craftingTable || this.craftingTable.merged) return;

    const input = this.player.controller.getInput();
    const inRange = this.craftingTable.isPlayerInRange(this.player.x, this.player.y);
    const collectedDocs = this.inventorySystem.getCollectedDocuments();

    this.craftingTable.showPrompt(inRange, collectedDocs.length);

    if (inRange && input.interact) {
      if (collectedDocs.length === 3) {
        // Successful merge
        this.craftingTable.merge();

        // Game continues playing without pausing
      } else {
        // Show floating error message
        const errMsg = this.add.text(this.craftingTable.x, this.craftingTable.y - 32, 'Cần đủ 3 tài liệu để ghép!', {
          fontSize: '11px', color: '#ff3d00', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(100);

        this.tweens.add({
          targets: errMsg,
          y: this.craftingTable.y - 65,
          alpha: 0,
          duration: 1800,
          onComplete: () => errMsg.destroy(),
        });
      }
    }
  }



  // ── Level Generation ───────────────────────────────────────────────

  private createLevel(): Phaser.Physics.Arcade.StaticGroup {
    const platforms = this.physics.add.staticGroup();

    const groundY = WORLD_HEIGHT - TILE_SIZE;
    for (let x = TILE_SIZE / 2; x < WORLD_WIDTH; x += TILE_SIZE) {
      platforms.create(x, groundY, 'ground-tile');
    }

    const platformPositions = [
      { x: 400, y: WORLD_HEIGHT - 180 },
      { x: 700, y: WORLD_HEIGHT - 280 },
      { x: 1050, y: WORLD_HEIGHT - 200 },
      { x: 1400, y: WORLD_HEIGHT - 320 },
      { x: 1800, y: WORLD_HEIGHT - 220 },
      { x: 2200, y: WORLD_HEIGHT - 260 },
      { x: 2600, y: WORLD_HEIGHT - 180 },
      { x: 3000, y: WORLD_HEIGHT - 300 },
    ];

    for (const pos of platformPositions) {
      const plat = platforms.create(pos.x, pos.y, 'platform');
      const body = plat.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
    }

    return platforms;
  }

  // ── Accessors ──────────────────────────────────────────────────────

  public triggerHitStop(duration: number = 80): void {
    if (this.isPaused) return;
    this.physics.world.pause();
    if (this.player && this.player.anims) {
      this.player.anims.pause();
    }
    for (const enemy of this.spawnSystem.getAliveEnemies()) {
      if (enemy.active && enemy.anims) {
        enemy.anims.pause();
      }
    }
    this.time.delayedCall(duration, () => {
      if (this.isPaused) return;
      this.physics.world.resume();
      if (this.player && this.player.active && this.player.anims) {
        this.player.anims.resume();
      }
      for (const enemy of this.spawnSystem.getAliveEnemies()) {
        if (enemy.active && enemy.anims) {
          enemy.anims.resume();
        }
      }
    });
  }

  getPlayer(): Player { return this.player; }
  getCameraManager(): CameraManager { return this.cameraManager; }
}
