/**
 * Phaser Game Configuration
 *
 * Architecture Decision:
 * Config is exported as a plain object so PhaserGame.tsx can spread / override
 * it when instantiating the game.  Scene imports are done at the top level to
 * avoid lazy-loading complexity at this stage.
 */
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GRAVITY } from './utils/Constants';

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  // ── Scale Manager ────────────────────────────────────────────────
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },

  // ── Pixel-art rendering ──────────────────────────────────────────
  roundPixels: true,
  antialias: false,
  pixelArt: true,

  // ── Background ───────────────────────────────────────────────────
  backgroundColor: '#1a1a2e',

  // ── Physics ──────────────────────────────────────────────────────
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: GRAVITY },
      // Set to true during development to visualise hitboxes
      debug: false,
    },
  },

  // ── Scene pipeline ───────────────────────────────────────────────
  scene: [BootScene, PreloadScene, GameScene, UIScene],
};

export default gameConfig;
