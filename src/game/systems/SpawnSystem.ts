/**
 * SpawnSystem — Manages enemy spawn points, respawning, and alive tracking.
 *
 * Architecture Decision:
 * Spawn points are data-driven so level designers can place enemies via
 * config objects.  The system uses a factory to map enemy type strings to
 * concrete classes, tracks alive counts per spawn point, and handles
 * respawn timers automatically.
 */
import Phaser from 'phaser';
import { Enemy } from '../entities/enemies/Enemy';
import { Slime } from '../entities/enemies/Slime';
import { Goblin } from '../entities/enemies/Goblin';
import { Bat } from '../entities/enemies/Bat';
import { AncientKnight } from '../entities/enemies/AncientKnight';
import EventBus from '../EventBus';
import { EntityState } from '../../types/game.types';

// ── Spawn Point Definition ─────────────────────────────────────────────

export interface SpawnPoint {
  id: string;
  x: number;
  y: number;
  enemyType: string;       // 'slime', 'bat', etc.
  maxEnemies: number;      // max alive from this point
  respawnDelay: number;    // ms before respawn
  spawnRadius: number;     // random offset from point
  isActive: boolean;
}

// ── Internal tracking per spawn point ──────────────────────────────────

interface SpawnTracker {
  config: SpawnPoint;
  aliveEnemies: Enemy[];
  pendingRespawns: number; // how many are waiting to respawn
  lastDeathTime: number;   // timestamp of the most recent death
}

// ── Enemy factory ──────────────────────────────────────────────────────

type EnemyFactory = (scene: Phaser.Scene, x: number, y: number) => Enemy;

const ENEMY_FACTORIES: Record<string, EnemyFactory> = {
  slime: (scene, x, y) => new Slime(scene, x, y),
  goblin: (scene, x, y) => new Goblin(scene, x, y),
  bat: (scene, x, y) => new Bat(scene, x, y),
  ancient_knight: (scene, x, y) => new AncientKnight(scene, x, y),
};

// ── SpawnSystem Class ──────────────────────────────────────────────────

export class SpawnSystem {
  private scene: Phaser.Scene;
  private trackers: Map<string, SpawnTracker> = new Map();
  private enemyPool: Map<string, Enemy[]> = new Map();

  /** Player sprite — passed to each spawned enemy for detection */
  private playerRef: Phaser.Physics.Arcade.Sprite;

  /** Physics group that holds all enemies (for collision wiring) */
  private enemiesGroup: Phaser.Physics.Arcade.Group;

  /** Platform collider target (enemies collide with platforms) */
  private platforms: Phaser.Physics.Arcade.StaticGroup;

  constructor(
    scene: Phaser.Scene,
    playerRef: Phaser.Physics.Arcade.Sprite,
    enemiesGroup: Phaser.Physics.Arcade.Group,
    platforms: Phaser.Physics.Arcade.StaticGroup,
  ) {
    this.scene = scene;
    this.playerRef = playerRef;
    this.enemiesGroup = enemiesGroup;
    this.platforms = platforms;
  }

  // ── Public API ─────────────────────────────────────────────────────

  /** Register a spawn point */
  addSpawnPoint(config: SpawnPoint): void {
    this.trackers.set(config.id, {
      config,
      aliveEnemies: [],
      pendingRespawns: 0,
      lastDeathTime: 0,
    });

    // Initial spawn
    if (config.isActive) {
      this.spawnInitial(config.id);
    }
  }

  /** Deactivate a spawn point and destroy its active enemies */
  deactivateSpawnPoint(id: string): void {
    const tracker = this.trackers.get(id);
    if (tracker) {
      tracker.config.isActive = false;
      for (const enemy of tracker.aliveEnemies) {
        if (enemy.active && enemy.currentHp > 0) {
          enemy.destroy();
        }
      }
      tracker.aliveEnemies = [];
    }
  }

  /** Activate a spawn point and spawn its initial enemies */
  activateSpawnPoint(id: string): void {
    const tracker = this.trackers.get(id);
    if (tracker && !tracker.config.isActive) {
      tracker.config.isActive = true;
      this.spawnInitial(id);
    }
  }

  /** Per-frame update: process respawn timers */
  update(time: number, _delta: number): void {
    if ((this.scene as any).bossIntroActive) return;

    for (const tracker of this.trackers.values()) {
      if (!tracker.config.isActive) continue;

      // Respawn if enough time has passed
      if (
        tracker.pendingRespawns > 0 &&
        time - tracker.lastDeathTime >= tracker.config.respawnDelay
      ) {
        const canSpawn = tracker.config.maxEnemies - tracker.aliveEnemies.length;
        const toSpawn = Math.min(tracker.pendingRespawns, canSpawn);

        for (let i = 0; i < toSpawn; i++) {
          this.spawnEnemy(tracker);
        }

        tracker.pendingRespawns -= toSpawn;
      }
    }
  }

  /** Recycle an enemy by deactivating and pooling it */
  recycleEnemy(enemy: Enemy): void {
    enemy.setActive(false);
    enemy.setVisible(false);
    
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setEnable(false);
      body.setVelocity(0, 0);
    }
    
    const type = enemy.config.type;
    if (!this.enemyPool.has(type)) {
      this.enemyPool.set(type, []);
    }
    this.enemyPool.get(type)!.push(enemy);
  }

  /** Callback when an enemy dies, updating respawn parameters event-driven */
  onEnemyDeath(enemy: Enemy, time: number): void {
    const tracker = this.trackers.get(enemy.spawnPointId);
    if (tracker) {
      const index = tracker.aliveEnemies.indexOf(enemy);
      if (index !== -1) {
        tracker.aliveEnemies.splice(index, 1);
        tracker.pendingRespawns++;
        tracker.lastDeathTime = time;
      }
    }
  }

  /** Clean up all spawn tracking and destroy remaining enemies + pooled enemies */
  destroy(): void {
    for (const tracker of this.trackers.values()) {
      tracker.aliveEnemies.forEach(e => { if (e.active) e.destroy(); });
      tracker.aliveEnemies = [];
    }
    this.trackers.clear();
    
    for (const pool of this.enemyPool.values()) {
      pool.forEach(e => e.destroy());
    }
    this.enemyPool.clear();
  }

  /** Return all currently alive enemies across all spawn points */
  getAliveEnemies(): Enemy[] {
    const seen = new Set<Enemy>();
    const result: Enemy[] = [];

    for (const enemy of this.enemiesGroup.getChildren() as Enemy[]) {
      if (!enemy || !enemy.active || enemy.isDead || enemy.currentHp <= 0) continue;
      if (seen.has(enemy)) continue;
      seen.add(enemy);
      result.push(enemy);
    }

    for (const tracker of this.trackers.values()) {
      for (const enemy of tracker.aliveEnemies) {
        if (!enemy || !enemy.active || enemy.isDead || enemy.currentHp <= 0) continue;
        if (seen.has(enemy)) continue;
        seen.add(enemy);
        result.push(enemy);
      }
    }

    return result;
  }

  // ── Internal ──────────────────────────────────────────────────────

  /** Spawn the initial batch for a spawn point */
  private spawnInitial(spawnId: string): void {
    const tracker = this.trackers.get(spawnId);
    if (!tracker) return;

    for (let i = 0; i < tracker.config.maxEnemies; i++) {
      this.spawnEnemy(tracker);
    }
  }

  /** Create or reuse a single enemy from a spawn tracker */
  private spawnEnemy(tracker: SpawnTracker): void {
    const cfg = tracker.config;
    const type = cfg.enemyType;
    const offsetX = Phaser.Math.Between(-cfg.spawnRadius, cfg.spawnRadius);
    const sx = cfg.x + offsetX;
    const sy = cfg.y;

    // Check if there's an inactive enemy in the pool
    const pool = this.enemyPool.get(type);
    let enemy: Enemy | undefined;
    if (pool && pool.length > 0) {
      enemy = pool.pop();
    }

    if (!enemy) {
      const factory = ENEMY_FACTORIES[type];
      if (!factory) {
        console.warn(`[SpawnSystem] No factory for enemy type: "${type}"`);
        return;
      }
      enemy = factory(this.scene, sx, sy);

      // Make interactive for target frame selection
      enemy.setInteractive({ useHandCursor: true });
      enemy.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) {
          EventBus.emit('enemy-selected', enemy!);
        }
      });

      // Add to physics group
      this.enemiesGroup.add(enemy);

      // Collide with platforms (only if not flying)
      if (!enemy.isFlying) {
        this.scene.physics.add.collider(enemy, this.platforms);
      }
    } else {
      // Reactivate enemy
      enemy.removeBossBuff();
      enemy.setActive(true);
      enemy.setVisible(true);
      enemy.setAlpha(1);
      enemy.isDead = false;
      enemy.currentHp = enemy.maxHp;
      enemy.shield = enemy.maxShield;
      enemy.showOverheadBars = true;
      enemy.setPosition(sx, sy);

      // Reactivate physics body
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setEnable(true);
        body.setAllowGravity(!enemy.isFlying);
        body.setVelocity(0, 0);
      }

      // Reset state machine state to PATROL so they immediately run around
      const sm = (enemy as any).stateMachine;
      if (sm && typeof sm.setState === 'function') {
        sm.setState(EntityState.PATROL);
      }
    }

    // Spawn visual effect
    if ((this.scene as any).effectsSystem) {
      (this.scene as any).effectsSystem.enemySpawn(sx, sy);
    }

    // Wire up references
    enemy.playerRef = this.playerRef;
    enemy.spawnPointId = cfg.id;
    enemy.spawnX = cfg.x;
    enemy.spawnY = cfg.y;

    tracker.aliveEnemies.push(enemy);
  }
}
