/**
 * PreloadScene - Asset loading with a visual progress bar.
 *
 * Architecture Decision:
 * All asset loading is centralised here so every subsequent scene can
 * assume textures / audio / data are already cached.  Until real sprite
 * sheets exist, we generate placeholder coloured rectangles via the
 * Graphics → generateTexture workflow so the rest of the engine can
 * reference texture keys without caring whether they're real assets.
 */
import Phaser from 'phaser';
import { SceneKey } from '../../types/game.types';
import { TILE_SIZE } from '../utils/Constants';
import { AudioManager } from '../managers/AudioManager';

/** Bar dimensions (centred on screen) */
const BAR_WIDTH = 400;
const BAR_HEIGHT = 30;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.PRELOAD });
  }

  // ── Preload ────────────────────────────────────────────────────────

  preload(): void {
    // In the future, real assets are loaded here:
    // this.load.spritesheet('player-idle', 'assets/player/idle.png', { ... });
  }

  // ── Create ─────────────────────────────────────────────────────────

  create(): void {
    AudioManager.getInstance();
    
    // Catch any real asset loading errors
    this.load.on('loaderror', (fileObj: any) => {
      console.error('Asset missing or failed to load:', fileObj.src);
    });

    this.createFakeLoadingSequence();
  }

  // ── Progress bar ───────────────────────────────────────────────────

  private createFakeLoadingSequence(): void {
    const { width, height } = this.cameras.main;
    const x = (width - BAR_WIDTH) / 2;
    const y = (height - BAR_HEIGHT) / 2;

    // Outer border
    const border = this.add.graphics();
    border.lineStyle(2, 0xffffff, 1);
    border.strokeRect(x, y, BAR_WIDTH, BAR_HEIGHT);

    // Inner fill
    const fill = this.add.graphics();

    // Texts
    const loadingText = this.add.text(width / 2, y - 24, 'Loading…', {
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const statusText = this.add.text(width / 2, y + 40, 'Initializing...', {
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    let progress = 0;
    this.time.addEvent({
      delay: 50,
      repeat: 20,
      callback: () => {
        progress += 0.05;
        if (progress > 1) progress = 1;
        
        fill.clear();
        fill.fillStyle(0x3498db, 1);
        fill.fillRect(x + 2, y + 2, (BAR_WIDTH - 4) * progress, BAR_HEIGHT - 4);

        if (progress < 0.3) statusText.setText('Loading Textures...');
        else if (progress < 0.6) statusText.setText('Loading Audio...');
        else if (progress < 0.9) statusText.setText('Generating Map Data...');
        else statusText.setText('Ready!');
      }
    });

    this.time.delayedCall(1100, () => {
      this.generatePlaceholderTextures();
      this.createPlaceholderAnimations();
      this.scene.start(SceneKey.GAME);
    });
  }

  // ── Placeholder texture generation ─────────────────────────────────

  private generatePlaceholderTextures(): void {
    const g = this.add.graphics();

    // Player – 32×48, blue
    g.fillStyle(0x3498db, 1);
    g.fillRect(0, 0, TILE_SIZE, 48);
    g.generateTexture('player', TILE_SIZE, 48);
    g.clear();

    // Enemy slime – 32×32, green
    g.fillStyle(0x2ecc71, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.generateTexture('enemy-slime', TILE_SIZE, TILE_SIZE);
    g.clear();

    // Enemy bat – 24×24, purple
    g.fillStyle(0x9b59b6, 1);
    g.fillRect(0, 0, 24, 24);
    g.generateTexture('enemy-bat', 24, 24);
    g.clear();

    // Enemy goblin – 28×36, orange
    g.fillStyle(0xe67e22, 1);
    g.fillRect(0, 0, 28, 36);
    g.generateTexture('enemy-goblin', 28, 36);
    g.clear();

    // Ground tile – 32×32, brown
    g.fillStyle(0x8b4513, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.generateTexture('ground-tile', TILE_SIZE, TILE_SIZE);
    g.clear();

    // Platform – 128×16, gray
    g.fillStyle(0x808080, 1);
    g.fillRect(0, 0, 128, 16);
    g.generateTexture('platform', 128, 16);
    g.clear();

    // Bullet – 8×4, yellow
    g.fillStyle(0xffff00, 1);
    g.fillRect(0, 0, 8, 4);
    g.generateTexture('bullet', 8, 4);
    g.clear();

    // Fireball – 16×16, orange
    g.fillStyle(0xff6600, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture('fireball', 16, 16);
    g.clear();

    g.destroy();
  }

  // ── Placeholder animations ─────────────────────────────────────────

  /**
   * Create single-frame "animations" for every player state.
   * These use the same placeholder texture but allow Player.playAnim()
   * to succeed.  Once real spritesheets arrive, only this method changes.
   */
  private createPlaceholderAnimations(): void {
    const playerKeys = [
      'player-idle',
      'player-run',
      'player-jump',
      'player-fall',
      'player-attack',
      'player-dash',
      'player-hurt',
      'player-death',
    ];

    for (const key of playerKeys) {
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: [{ key: 'player', frame: 0 }],
          frameRate: 1,
          repeat: 0,
        });
      }
    }

    // ── Slime enemy animations (single-frame placeholders) ──────
    const slimeKeys = [
      'slime-idle',
      'slime-walk',
      'slime-attack',
      'slime-hurt',
      'slime-death',
    ];

    for (const key of slimeKeys) {
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: [{ key: 'enemy-slime', frame: 0 }],
          frameRate: 1,
          repeat: 0,
        });
      }
    }

    // ── Goblin enemy animations (single-frame placeholders) ──────
    const goblinKeys = [
      'goblin-idle',
      'goblin-walk',
      'goblin-attack',
      'goblin-hurt',
      'goblin-death',
    ];

    for (const key of goblinKeys) {
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: [{ key: 'enemy-goblin', frame: 0 }],
          frameRate: 1,
          repeat: 0,
        });
      }
    }

    // ── Bat enemy animations (single-frame placeholders) ──────
    const batKeys = [
      'bat-idle',
      'bat-walk',
      'bat-attack',
      'bat-hurt',
      'bat-death',
    ];

    for (const key of batKeys) {
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: [{ key: 'enemy-bat', frame: 0 }],
          frameRate: 1,
          repeat: 0,
        });
      }
    }
  }
}
