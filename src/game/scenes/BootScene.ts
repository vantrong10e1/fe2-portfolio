/**
 * BootScene - Minimal bootstrap scene.
 *
 * Architecture Decision:
 * The sole purpose of BootScene is to set any engine-level settings
 * (like render mode flags) and immediately hand off to PreloadScene.
 * Keeping boot logic separate means PreloadScene doesn't need to know
 * whether it's the first scene or being re-entered.
 */
import Phaser from 'phaser';
import { SceneKey } from '../../types/game.types';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.BOOT });
  }

  create(): void {
    // Future: set scaling mode, configure renderer, etc.
    this.scene.start(SceneKey.PRELOAD);
  }
}
