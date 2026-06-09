/**
 * Core game type definitions
 */

export enum Direction {
  LEFT = 'left',
  RIGHT = 'right',
  UP = 'up',
  DOWN = 'down',
}

export enum EntityState {
  IDLE = 'idle',
  RUN = 'run',
  JUMP = 'jump',
  FALL = 'fall',
  ATTACK = 'attack',
  DASH = 'dash',
  TAKE_DAMAGE = 'take_damage',
  DEATH = 'death',
  PATROL = 'patrol',
  CHASE = 'chase',
  DETECT = 'detect',
}

export interface CharacterStats {
  maxHp: number;
  currentHp: number;
  maxMp: number;
  currentMp: number;
  attack: number;
  defense: number;
  moveSpeed: number;
  jumpForce: number;
  criticalRate: number;
  criticalDamage: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface HitboxConfig {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export interface DamageEvent {
  source: string;
  target: string;
  damage: number;
  isCritical: boolean;
  knockbackForce: number;
  knockbackDirection: Direction;
}

export enum SceneKey {
  BOOT = 'BootScene',
  PRELOAD = 'PreloadScene',
  MAIN_MENU = 'MainMenuScene',
  GAME = 'GameScene',
  UI = 'UIScene',
  GAME_OVER = 'GameOverScene',
}

export enum AssetKey {
  PLAYER_IDLE = 'player-idle',
  PLAYER_RUN = 'player-run',
  PLAYER_JUMP = 'player-jump',
  PLAYER_FALL = 'player-fall',
  PLAYER_ATTACK = 'player-attack',
  PLAYER_DASH = 'player-dash',
  PLAYER_HURT = 'player-hurt',
  PLAYER_DEATH = 'player-death',
  TILESET = 'tileset',
  LEVEL_01 = 'level-01',
  HEALTH_BAR = 'health-bar',
  MANA_BAR = 'mana-bar',
}

export enum GameEvent {
  // Player events
  HP_CHANGED = 'hp-changed',
  MP_CHANGED = 'mp-changed',
  EXP_CHANGED = 'exp-changed',
  LEVEL_UP = 'level-up',
  PLAYER_DIED = 'player-died',

  // Combat events
  DAMAGE_DEALT = 'damage-dealt',
  DAMAGE_RECEIVED = 'damage-received',
  ENEMY_KILLED = 'enemy-killed',

  // Weapon events
  WEAPON_SWITCHED = 'weapon-switched',
  AMMO_CHANGED = 'ammo-changed',
  RELOAD_START = 'reload-start',
  RELOAD_END = 'reload-end',

  // Skill events
  SKILL_USED = 'skill-used',
  SKILL_COOLDOWN = 'skill-cooldown',
  SKILL_READY = 'skill-ready',

  // Item events
  ITEM_PICKED = 'item-picked',
  ITEM_USED = 'item-used',
  ITEM_EQUIPPED = 'item-equipped',

  // Inventory
  INVENTORY_TOGGLE = 'inventory-toggle',

  // Game state events
  GAME_STARTED = 'game-started',
  GAME_PAUSED = 'game-paused',
  GAME_RESUMED = 'game-resumed',
  GAME_OVER = 'game-over',
  SCENE_READY = 'scene-ready',
  EXIT_TO_MENU = 'exit-to-menu',

  // Score & Stats
  SCORE_CHANGED = 'score-changed',
  TAB_TOGGLE = 'tab-toggle',
  BOSS_HP_CHANGED = 'boss-hp-changed',
  CHEST_OPENED = 'chest-opened',
  DOCUMENT_COLLECTED = 'document-collected',
  DOCUMENTS_MERGED = 'documents-merged',

  // Quest events
  QUEST_STARTED = 'quest-started',
  QUEST_COMPLETED = 'quest-completed',
  QUEST_UPDATED = 'quest-updated',
}
