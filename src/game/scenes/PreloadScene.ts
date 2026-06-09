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
      this.generateAnimationFrames();
      this.createPlaceholderAnimations();
      this.scene.start(SceneKey.GAME);
    });
  }

  // ── Placeholder texture generation ─────────────────────────────────

  private generatePlaceholderTextures(): void {
    const g = this.add.graphics();

    // ── Player – 32×48, Hooded Swordsman ──────────────────────────
    // Body
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(8, 16, 16, 20); // torso
    // Cape
    g.fillStyle(0x6c3483, 1);
    g.fillRect(6, 18, 4, 18);
    g.fillRect(22, 18, 4, 18);
    // Hood
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(8, 6, 16, 14);
    g.fillRect(6, 10, 20, 8);
    // Eyes (glowing blue)
    g.fillStyle(0x00d4ff, 1);
    g.fillRect(12, 12, 3, 3);
    g.fillRect(18, 12, 3, 3);
    // Legs
    g.fillStyle(0x34495e, 1);
    g.fillRect(10, 36, 5, 10);
    g.fillRect(17, 36, 5, 10);
    // Boots
    g.fillStyle(0x5d4037, 1);
    g.fillRect(9, 43, 7, 5);
    g.fillRect(16, 43, 7, 5);
    // Sword (right side)
    g.fillStyle(0xb0bec5, 1);
    g.fillRect(26, 8, 2, 24);
    // Sword guard
    g.fillStyle(0xffd700, 1);
    g.fillRect(24, 30, 6, 2);
    // Sword handle
    g.fillStyle(0x5d4037, 1);
    g.fillRect(26, 32, 2, 6);
    g.generateTexture('player', 32, 48);
    g.clear();

    // ── Enemy slime – 32×32, Blob with eyes ──────────────────────
    // Body blob shape
    g.fillStyle(0x27ae60, 1);
    g.fillRect(4, 14, 24, 16);
    g.fillRect(6, 10, 20, 4);
    g.fillRect(8, 8, 16, 2);
    g.fillRect(2, 18, 28, 8);
    g.fillRect(6, 28, 20, 4);
    // Lighter belly highlight
    g.fillStyle(0x2ecc71, 1);
    g.fillRect(8, 16, 16, 10);
    // Shine spot
    g.fillStyle(0x82e0aa, 1);
    g.fillRect(10, 12, 4, 4);
    // Eyes
    g.fillStyle(0xffffff, 1);
    g.fillRect(10, 16, 5, 5);
    g.fillRect(18, 16, 5, 5);
    // Pupils
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(12, 17, 3, 3);
    g.fillRect(20, 17, 3, 3);
    // Mouth
    g.fillStyle(0x1e8449, 1);
    g.fillRect(13, 24, 6, 2);
    g.generateTexture('enemy-slime', 32, 32);
    g.clear();

    // ── Enemy bat – 24×24, Winged bat ────────────────────────────
    // Wings
    g.fillStyle(0x7d3c98, 1);
    g.fillRect(0, 6, 6, 10);
    g.fillRect(18, 6, 6, 10);
    g.fillRect(2, 4, 4, 4);
    g.fillRect(18, 4, 4, 4);
    // Wing tips
    g.fillStyle(0x6c3483, 1);
    g.fillRect(0, 4, 3, 3);
    g.fillRect(21, 4, 3, 3);
    // Body
    g.fillStyle(0x512e5f, 1);
    g.fillRect(8, 6, 8, 12);
    // Head
    g.fillStyle(0x4a235a, 1);
    g.fillRect(9, 2, 6, 6);
    // Ears
    g.fillRect(8, 0, 2, 4);
    g.fillRect(14, 0, 2, 4);
    // Eyes (red glow)
    g.fillStyle(0xff0000, 1);
    g.fillRect(10, 4, 2, 2);
    g.fillRect(13, 4, 2, 2);
    // Fangs
    g.fillStyle(0xffffff, 1);
    g.fillRect(10, 8, 1, 2);
    g.fillRect(13, 8, 1, 2);
    // Feet
    g.fillStyle(0x4a235a, 1);
    g.fillRect(9, 18, 2, 3);
    g.fillRect(13, 18, 2, 3);
    g.generateTexture('enemy-bat', 24, 24);
    g.clear();

    // ── Enemy goblin – 28×36, Armed goblin ───────────────────────
    // Body
    g.fillStyle(0x6b8e23, 1);
    g.fillRect(8, 12, 12, 14);
    // Armor vest
    g.fillStyle(0x5d4037, 1);
    g.fillRect(9, 14, 10, 10);
    // Belt
    g.fillStyle(0x795548, 1);
    g.fillRect(8, 22, 12, 2);
    // Belt buckle
    g.fillStyle(0xffd700, 1);
    g.fillRect(12, 22, 4, 2);
    // Head (larger, green)
    g.fillStyle(0x7cb342, 1);
    g.fillRect(7, 2, 14, 12);
    // Ears (pointy)
    g.fillStyle(0x7cb342, 1);
    g.fillRect(4, 4, 4, 6);
    g.fillRect(20, 4, 4, 6);
    // Inner ears
    g.fillStyle(0xc5e1a5, 1);
    g.fillRect(5, 6, 2, 3);
    g.fillRect(21, 6, 2, 3);
    // Eyes (yellow, menacing)
    g.fillStyle(0xffeb3b, 1);
    g.fillRect(10, 6, 3, 3);
    g.fillRect(16, 6, 3, 3);
    // Pupils
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(11, 7, 2, 2);
    g.fillRect(17, 7, 2, 2);
    // Mouth (grin)
    g.fillStyle(0x33691e, 1);
    g.fillRect(10, 11, 8, 2);
    // Teeth
    g.fillStyle(0xffffff, 1);
    g.fillRect(11, 11, 2, 1);
    g.fillRect(15, 11, 2, 1);
    // Legs
    g.fillStyle(0x558b2f, 1);
    g.fillRect(9, 26, 4, 8);
    g.fillRect(15, 26, 4, 8);
    // Feet
    g.fillStyle(0x5d4037, 1);
    g.fillRect(8, 32, 6, 4);
    g.fillRect(14, 32, 6, 4);
    // Dagger (right hand)
    g.fillStyle(0xbdbdbd, 1);
    g.fillRect(22, 14, 2, 10);
    // Dagger guard
    g.fillStyle(0x795548, 1);
    g.fillRect(21, 23, 4, 2);
    g.generateTexture('enemy-goblin', 28, 36);
    g.clear();

    // ── Ground tile – 32×32, Textured earth ──────────────────────
    g.fillStyle(0x5d4037, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    // Texture details
    g.fillStyle(0x4e342e, 1);
    g.fillRect(4, 4, 6, 3);
    g.fillRect(16, 8, 8, 3);
    g.fillRect(2, 18, 10, 2);
    g.fillRect(20, 22, 6, 3);
    g.fillRect(8, 26, 4, 4);
    // Top edge (grass)
    g.fillStyle(0x558b2f, 1);
    g.fillRect(0, 0, TILE_SIZE, 4);
    g.fillStyle(0x689f38, 1);
    g.fillRect(2, 0, 4, 2);
    g.fillRect(10, 0, 6, 3);
    g.fillRect(20, 0, 8, 2);
    g.generateTexture('ground-tile', TILE_SIZE, TILE_SIZE);
    g.clear();

    // ── Platform – 128×16, Stone platform ────────────────────────
    g.fillStyle(0x607d8b, 1);
    g.fillRect(0, 0, 128, 16);
    // Stone pattern
    g.fillStyle(0x546e7a, 1);
    for (let px = 0; px < 128; px += 16) {
      g.fillRect(px, 0, 1, 16);
    }
    // Top edge highlight
    g.fillStyle(0x78909c, 1);
    g.fillRect(0, 0, 128, 2);
    // Bottom shadow
    g.fillStyle(0x455a64, 1);
    g.fillRect(0, 14, 128, 2);
    g.generateTexture('platform', 128, 16);
    g.clear();

    // ── Bullet – 8×4, Yellow energy ──────────────────────────────
    g.fillStyle(0xffff00, 1);
    g.fillRect(0, 0, 8, 4);
    g.fillStyle(0xffffff, 1);
    g.fillRect(1, 1, 4, 2);
    g.generateTexture('bullet', 8, 4);
    g.clear();

    // ── Fireball – 16×16, Burning orb ────────────────────────────
    g.fillStyle(0xff6600, 1);
    g.fillCircle(8, 8, 7);
    g.fillStyle(0xffcc00, 1);
    g.fillCircle(8, 8, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 2);
    g.generateTexture('fireball', 16, 16);
    g.clear();

    // ── Chest texture – 28×24, Treasure chest ────────────────────
    // Main body (wood)
    g.fillStyle(0x8b4513, 1);
    g.fillRect(2, 8, 24, 14);
    // Lid
    g.fillStyle(0xa0522d, 1);
    g.fillRect(2, 4, 24, 6);
    g.fillRect(4, 2, 20, 4);
    // Metal bands
    g.fillStyle(0xdaa520, 1);
    g.fillRect(0, 8, 28, 2);
    g.fillRect(0, 14, 28, 2);
    g.fillRect(0, 20, 28, 2);
    // Lock
    g.fillStyle(0xffd700, 1);
    g.fillRect(11, 10, 6, 6);
    g.fillStyle(0x8b4513, 1);
    g.fillRect(13, 12, 2, 2);
    // Corner studs
    g.fillStyle(0xdaa520, 1);
    g.fillRect(2, 4, 3, 3);
    g.fillRect(23, 4, 3, 3);
    g.fillRect(2, 19, 3, 3);
    g.fillRect(23, 19, 3, 3);
    g.generateTexture('chest', 28, 24);
    g.clear();

    // ── Document fragment – 20×20, Ancient scroll ────────────────
    // Parchment body
    g.fillStyle(0xf5deb3, 1);
    g.fillRect(4, 2, 12, 16);
    // Torn edges
    g.fillStyle(0xd2b48c, 1);
    g.fillRect(3, 4, 1, 12);
    g.fillRect(16, 6, 1, 8);
    g.fillRect(6, 1, 4, 1);
    g.fillRect(10, 17, 4, 1);
    // Writing lines
    g.fillStyle(0x4a3728, 1);
    g.fillRect(6, 5, 8, 1);
    g.fillRect(6, 8, 6, 1);
    g.fillRect(6, 11, 7, 1);
    g.fillRect(6, 14, 5, 1);
    // Wax seal (red)
    g.fillStyle(0xc0392b, 1);
    g.fillCircle(13, 14, 2);
    g.generateTexture('document', 20, 20);
    g.clear();

    g.destroy();
  }

  // ── Animation frame generation ─────────────────────────────────────

  private generateAnimationFrames(): void {
    const g = this.add.graphics();

    // ── Helper: draw player body (no legs, no sword) ─────────────
    const drawPlayerUpper = (yOff: number = 0) => {
      // Hood
      g.fillStyle(0x1a1a2e, 1);
      g.fillRect(8, 6 + yOff, 16, 14);
      g.fillRect(6, 10 + yOff, 20, 8);
      // Eyes
      g.fillStyle(0x00d4ff, 1);
      g.fillRect(12, 12 + yOff, 3, 3);
      g.fillRect(18, 12 + yOff, 3, 3);
      // Torso
      g.fillStyle(0x2c3e50, 1);
      g.fillRect(8, 16 + yOff, 16, 20);
      // Cape
      g.fillStyle(0x6c3483, 1);
      g.fillRect(6, 18 + yOff, 4, 18);
      g.fillRect(22, 18 + yOff, 4, 18);
    };

    // ── Helper: draw legs at phase (0=neutral, 1=left fwd, 2=right fwd, 3=together) ──
    const drawLegs = (phase: number, yOff: number = 0) => {
      g.fillStyle(0x34495e, 1);
      const offsets = [
        [10, 17], // phase 0: neutral
        [7, 19],  // phase 1: left fwd
        [19, 7],  // phase 2: right fwd
        [12, 15], // phase 3: close together
      ];
      const [lx, rx] = offsets[phase] || offsets[0];
      g.fillRect(lx, 36 + yOff, 5, 10);
      g.fillRect(rx, 36 + yOff, 5, 10);
      // Boots
      g.fillStyle(0x5d4037, 1);
      g.fillRect(lx - 1, 43 + yOff, 7, 5);
      g.fillRect(rx - 1, 43 + yOff, 7, 5);
    };

    // ── Player Idle Frame 1 (bob down 1px) ────────────────────────
    g.clear();
    drawPlayerUpper(1);
    drawLegs(0, 1);
    // Sword at side (same as base but shifted)
    g.fillStyle(0xb0bec5, 1);
    g.fillRect(26, 9, 2, 24);
    g.fillStyle(0xffd700, 1);
    g.fillRect(24, 31, 6, 2);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(26, 33, 2, 6);
    g.generateTexture('player-idle-1', 32, 48);
    g.clear();

    // ── Player Run Frames (4-frame cycle) ─────────────────────────
    for (let i = 0; i < 4; i++) {
      g.clear();
      const bob = (i % 2 === 0) ? 0 : -1;
      drawPlayerUpper(bob);
      drawLegs(i, bob);
      // Sword bounces with run
      g.fillStyle(0xb0bec5, 1);
      g.fillRect(26, 8 + bob + (i % 2), 2, 22);
      g.fillStyle(0xffd700, 1);
      g.fillRect(24, 28 + bob + (i % 2), 6, 2);
      g.fillStyle(0x5d4037, 1);
      g.fillRect(26, 30 + bob + (i % 2), 2, 5);
      g.generateTexture(`player-run-${i}`, 32, 48);
    }
    g.clear();

    // ── Player Attack Frame 0 — Wind-up (sword raised above head) ──
    g.clear();
    drawPlayerUpper(0);
    drawLegs(0, 0);
    // Sword raised vertically above head
    g.fillStyle(0xb0bec5, 1);
    g.fillRect(14, 0, 2, 16); // blade vertical above head
    g.fillStyle(0xffd700, 1);
    g.fillRect(12, 14, 6, 2); // guard
    g.fillStyle(0x5d4037, 1);
    g.fillRect(14, 16, 2, 5); // handle
    // Arm reaching up
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(14, 16, 4, 4);
    g.generateTexture('player-atk-0', 32, 48);
    g.clear();

    // ── Player Attack Frame 1 — Mid-swing (sword diagonal + slash arc) ──
    g.clear();
    drawPlayerUpper(0);
    drawLegs(1, 0); // lunge forward
    // Sword diagonal (upper-right to mid)
    g.fillStyle(0xb0bec5, 1);
    g.fillRect(20, 6, 2, 4);
    g.fillRect(22, 10, 2, 4);
    g.fillRect(24, 14, 2, 4);
    g.fillRect(26, 18, 2, 4);
    // Guard
    g.fillStyle(0xffd700, 1);
    g.fillRect(18, 20, 6, 2);
    // Handle
    g.fillStyle(0x5d4037, 1);
    g.fillRect(16, 22, 4, 4);
    // Slash arc trail (white-blue sweep)
    g.lineStyle(2, 0xffffff, 0.9);
    g.beginPath();
    g.arc(16, 16, 18, -1.2, 0.3, false);
    g.strokePath();
    g.lineStyle(3, 0x88ccff, 0.5);
    g.beginPath();
    g.arc(16, 16, 16, -1.0, 0.5, false);
    g.strokePath();
    g.generateTexture('player-atk-1', 32, 48);
    g.clear();

    // ── Player Attack Frame 2 — Follow-through (sword extended forward) ──
    g.clear();
    drawPlayerUpper(1); // slight dip
    drawLegs(2, 1); // weight shifted forward
    // Sword extended forward-right
    g.fillStyle(0xb0bec5, 1);
    g.fillRect(20, 22, 4, 2);
    g.fillRect(24, 24, 4, 2);
    g.fillRect(28, 26, 4, 2); // tip extends beyond body
    // Guard
    g.fillStyle(0xffd700, 1);
    g.fillRect(18, 24, 4, 3);
    // Handle
    g.fillStyle(0x5d4037, 1);
    g.fillRect(16, 24, 3, 4);
    // Wide slash trail (fading sweep)
    g.lineStyle(3, 0xffffff, 0.7);
    g.beginPath();
    g.arc(16, 20, 20, -0.8, 0.8, false);
    g.strokePath();
    g.lineStyle(4, 0x88ccff, 0.3);
    g.beginPath();
    g.arc(16, 20, 22, -0.6, 1.0, false);
    g.strokePath();
    g.generateTexture('player-atk-2', 32, 48);
    g.clear();

    // ── Player Jump Frame ─────────────────────────────────────────
    g.clear();
    drawPlayerUpper(-2);
    // Legs tucked up
    g.fillStyle(0x34495e, 1);
    g.fillRect(10, 32, 5, 7);
    g.fillRect(17, 32, 5, 7);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(9, 37, 7, 4);
    g.fillRect(16, 37, 7, 4);
    // Sword at side
    g.fillStyle(0xb0bec5, 1);
    g.fillRect(26, 6, 2, 22);
    g.fillStyle(0xffd700, 1);
    g.fillRect(24, 26, 6, 2);
    g.generateTexture('player-jump-f', 32, 48);
    g.clear();

    // ── Player Fall Frame ─────────────────────────────────────────
    g.clear();
    drawPlayerUpper(2);
    // Legs stretched down
    g.fillStyle(0x34495e, 1);
    g.fillRect(9, 38, 5, 10);
    g.fillRect(18, 38, 5, 10);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(8, 46, 7, 2);
    g.fillRect(17, 46, 7, 2);
    // Sword
    g.fillStyle(0xb0bec5, 1);
    g.fillRect(26, 10, 2, 22);
    g.fillStyle(0xffd700, 1);
    g.fillRect(24, 30, 6, 2);
    g.generateTexture('player-fall-f', 32, 48);
    g.clear();

    // ── Player Hurt Frame ─────────────────────────────────────────
    g.clear();
    // Shifted body to show recoil
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(4, 8, 16, 14);
    g.fillRect(2, 12, 20, 8);
    g.fillStyle(0xff4444, 1); // Eyes flash red
    g.fillRect(8, 14, 3, 3);
    g.fillRect(14, 14, 3, 3);
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(4, 18, 16, 20);
    g.fillStyle(0x6c3483, 1);
    g.fillRect(2, 20, 4, 18);
    g.fillRect(18, 20, 4, 18);
    drawLegs(0, 2);
    g.fillStyle(0xb0bec5, 1);
    g.fillRect(22, 12, 2, 20);
    g.generateTexture('player-hurt-f', 32, 48);
    g.clear();

    // ── Player Death Frame ────────────────────────────────────────
    g.clear();
    // Collapsed sideways look
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(4, 20, 16, 10);
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(4, 26, 24, 10);
    g.fillStyle(0x6c3483, 1);
    g.fillRect(2, 28, 28, 6);
    g.fillStyle(0x34495e, 1);
    g.fillRect(4, 36, 24, 6);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(2, 40, 28, 4);
    // Sword on ground
    g.fillStyle(0xb0bec5, 1);
    g.fillRect(2, 38, 20, 2);
    g.fillStyle(0xffd700, 1);
    g.fillRect(22, 37, 2, 4);
    // X eyes
    g.fillStyle(0x555555, 1);
    g.fillRect(8, 22, 3, 3);
    g.fillRect(14, 22, 3, 3);
    g.generateTexture('player-death-f', 32, 48);
    g.clear();

    // ── Player Dash Frame ─────────────────────────────────────────
    g.clear();
    // Leaning forward with speed lines
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(12, 4, 16, 12);
    g.fillRect(10, 8, 20, 8);
    g.fillStyle(0x00d4ff, 1);
    g.fillRect(16, 8, 3, 3);
    g.fillRect(22, 8, 3, 3);
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(12, 14, 16, 18);
    g.fillStyle(0x6c3483, 1);
    g.fillRect(4, 16, 8, 16); // cape trailing behind
    g.fillStyle(0x34495e, 1);
    g.fillRect(14, 32, 5, 10);
    g.fillRect(20, 34, 5, 8);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(13, 40, 7, 5);
    g.fillRect(19, 40, 7, 5);
    // Speed lines
    g.lineStyle(1, 0x88ccff, 0.6);
    g.lineBetween(0, 12, 8, 12);
    g.lineBetween(0, 20, 6, 20);
    g.lineBetween(2, 28, 10, 28);
    // Sword forward
    g.fillStyle(0xb0bec5, 1);
    g.fillRect(28, 10, 4, 2);
    g.fillRect(26, 12, 4, 2);
    g.generateTexture('player-dash-f', 32, 48);
    g.clear();

    // ── Slime bounce frame ────────────────────────────────────────
    g.clear();
    // Squished wider and shorter
    g.fillStyle(0x27ae60, 1);
    g.fillRect(2, 18, 28, 12);
    g.fillRect(0, 20, 32, 8);
    g.fillRect(4, 28, 24, 4);
    g.fillStyle(0x2ecc71, 1);
    g.fillRect(6, 20, 20, 6);
    g.fillStyle(0x82e0aa, 1);
    g.fillRect(8, 18, 4, 3);
    g.fillStyle(0xffffff, 1);
    g.fillRect(8, 20, 6, 4);
    g.fillRect(18, 20, 6, 4);
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(10, 21, 3, 3);
    g.fillRect(20, 21, 3, 3);
    g.fillStyle(0x1e8449, 1);
    g.fillRect(13, 26, 6, 2);
    g.generateTexture('slime-f1', 32, 32);
    g.clear();

    // Slime attack frame (stretched up tall)
    g.clear();
    g.fillStyle(0x27ae60, 1);
    g.fillRect(8, 4, 16, 24);
    g.fillRect(6, 8, 20, 16);
    g.fillRect(10, 26, 12, 6);
    g.fillStyle(0x2ecc71, 1);
    g.fillRect(10, 10, 12, 14);
    g.fillStyle(0xffffff, 1);
    g.fillRect(10, 10, 5, 5);
    g.fillRect(18, 10, 5, 5);
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(12, 11, 3, 3);
    g.fillRect(20, 11, 3, 3);
    g.fillStyle(0xff0000, 1);
    g.fillRect(13, 18, 6, 3); // angry mouth
    g.generateTexture('slime-atk', 32, 32);
    g.clear();

    // ── Bat wing flap frame ───────────────────────────────────────
    g.clear();
    // Wings down
    g.fillStyle(0x7d3c98, 1);
    g.fillRect(0, 10, 6, 10);
    g.fillRect(18, 10, 6, 10);
    g.fillRect(2, 14, 4, 6);
    g.fillRect(18, 14, 4, 6);
    g.fillStyle(0x512e5f, 1);
    g.fillRect(8, 6, 8, 12);
    g.fillStyle(0x4a235a, 1);
    g.fillRect(9, 2, 6, 6);
    g.fillRect(8, 0, 2, 4);
    g.fillRect(14, 0, 2, 4);
    g.fillStyle(0xff0000, 1);
    g.fillRect(10, 4, 2, 2);
    g.fillRect(13, 4, 2, 2);
    g.fillStyle(0xffffff, 1);
    g.fillRect(10, 8, 1, 2);
    g.fillRect(13, 8, 1, 2);
    g.fillStyle(0x4a235a, 1);
    g.fillRect(9, 18, 2, 3);
    g.fillRect(13, 18, 2, 3);
    g.generateTexture('bat-f1', 24, 24);
    g.clear();

    // ── Goblin walk frame ─────────────────────────────────────────
    g.clear();
    // Body
    g.fillStyle(0x6b8e23, 1);
    g.fillRect(8, 12, 12, 14);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(9, 14, 10, 10);
    g.fillStyle(0x795548, 1);
    g.fillRect(8, 22, 12, 2);
    g.fillStyle(0xffd700, 1);
    g.fillRect(12, 22, 4, 2);
    g.fillStyle(0x7cb342, 1);
    g.fillRect(7, 2, 14, 12);
    g.fillRect(4, 4, 4, 6);
    g.fillRect(20, 4, 4, 6);
    g.fillStyle(0xffeb3b, 1);
    g.fillRect(10, 6, 3, 3);
    g.fillRect(16, 6, 3, 3);
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(11, 7, 2, 2);
    g.fillRect(17, 7, 2, 2);
    g.fillStyle(0x33691e, 1);
    g.fillRect(10, 11, 8, 2);
    // Legs apart (walking)
    g.fillStyle(0x558b2f, 1);
    g.fillRect(6, 26, 4, 8);
    g.fillRect(18, 26, 4, 8);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(5, 32, 6, 4);
    g.fillRect(17, 32, 6, 4);
    // Dagger forward
    g.fillStyle(0xbdbdbd, 1);
    g.fillRect(24, 12, 2, 8);
    g.fillStyle(0x795548, 1);
    g.fillRect(23, 19, 4, 2);
    g.generateTexture('goblin-f1', 28, 36);
    g.clear();

    // Goblin attack frame (dagger thrust forward)
    g.clear();
    g.fillStyle(0x6b8e23, 1);
    g.fillRect(6, 12, 12, 14);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(7, 14, 10, 10);
    g.fillStyle(0x7cb342, 1);
    g.fillRect(5, 2, 14, 12);
    g.fillRect(2, 4, 4, 6);
    g.fillRect(18, 4, 4, 6);
    g.fillStyle(0xffeb3b, 1);
    g.fillRect(8, 6, 3, 3);
    g.fillRect(14, 6, 3, 3);
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(9, 7, 2, 2);
    g.fillRect(15, 7, 2, 2);
    g.fillStyle(0xff0000, 1);
    g.fillRect(9, 11, 6, 2); // angry mouth
    g.fillStyle(0x558b2f, 1);
    g.fillRect(7, 26, 4, 8);
    g.fillRect(15, 26, 4, 8);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(6, 32, 6, 4);
    g.fillRect(14, 32, 6, 4);
    // Dagger thrust forward with arm
    g.fillStyle(0x6b8e23, 1);
    g.fillRect(18, 16, 6, 3); // arm extended
    g.fillStyle(0xbdbdbd, 1);
    g.fillRect(24, 15, 4, 2); // blade horizontal
    g.fillStyle(0xffffff, 1);
    g.fillRect(26, 15, 2, 2); // blade tip shine
    g.generateTexture('goblin-atk', 28, 36);
    g.clear();

    // ══════════════════════════════════════════════════════════════════
    //  GUN MODE FRAMES
    // ══════════════════════════════════════════════════════════════════

    // ── Helper: draw gun-mode player body (no legs, no sword — holds gun) ──
    const drawGunUpper = (yOff: number = 0) => {
      // Hood
      g.fillStyle(0x1a1a2e, 1);
      g.fillRect(8, 6 + yOff, 16, 14);
      g.fillRect(6, 10 + yOff, 20, 8);
      // Eyes (orange for gun mode)
      g.fillStyle(0xffaa00, 1);
      g.fillRect(12, 12 + yOff, 3, 3);
      g.fillRect(18, 12 + yOff, 3, 3);
      // Torso (slightly different shade for gun mode)
      g.fillStyle(0x2c3e50, 1);
      g.fillRect(8, 16 + yOff, 16, 20);
      // Bandolier (ammo belt across chest)
      g.fillStyle(0x795548, 1);
      g.fillRect(10, 20 + yOff, 12, 2);
      g.fillStyle(0xffd700, 1);
      g.fillRect(11, 20 + yOff, 2, 2);
      g.fillRect(15, 20 + yOff, 2, 2);
      g.fillRect(19, 20 + yOff, 2, 2);
      // Cape (shorter in gun mode)
      g.fillStyle(0x6c3483, 1);
      g.fillRect(6, 18 + yOff, 4, 14);
      g.fillRect(22, 18 + yOff, 4, 14);
    };

    // ── Helper: draw gun at position ──
    const drawGun = (gx: number, gy: number, horizontal: boolean = true) => {
      if (horizontal) {
        // Gun body (horizontal)
        g.fillStyle(0x455a64, 1);
        g.fillRect(gx, gy, 10, 3);       // barrel
        g.fillStyle(0x37474f, 1);
        g.fillRect(gx - 2, gy - 1, 6, 5); // receiver
        // Grip
        g.fillStyle(0x5d4037, 1);
        g.fillRect(gx - 1, gy + 3, 3, 4); // grip
        // Trigger guard
        g.fillStyle(0x757575, 1);
        g.fillRect(gx + 1, gy + 3, 2, 1);
      } else {
        // Gun body (angled down for idle)
        g.fillStyle(0x455a64, 1);
        g.fillRect(gx, gy, 3, 8);         // barrel vertical
        g.fillStyle(0x37474f, 1);
        g.fillRect(gx - 1, gy - 2, 5, 5); // receiver
        g.fillStyle(0x5d4037, 1);
        g.fillRect(gx + 3, gy + 1, 3, 3); // grip
      }
    };

    // ── Gun Idle Frame 0 (gun pointing down-right) ──────────────
    g.clear();
    drawGunUpper(0);
    drawLegs(0, 0);
    drawGun(24, 24, false); // gun held down at side
    g.generateTexture('player-gun-idle-0', 32, 48);
    g.clear();

    // ── Gun Idle Frame 1 (bob) ──────────────────────────────────
    g.clear();
    drawGunUpper(1);
    drawLegs(0, 1);
    drawGun(24, 25, false);
    g.generateTexture('player-gun-idle-1', 32, 48);
    g.clear();

    // ── Gun Run Frames (4-frame cycle, gun bouncing) ────────────
    for (let i = 0; i < 4; i++) {
      g.clear();
      const bob = (i % 2 === 0) ? 0 : -1;
      drawGunUpper(bob);
      drawLegs(i, bob);
      // Gun bounces with run, held forward
      drawGun(22, 20 + bob + (i % 2), true);
      g.generateTexture(`player-gun-run-${i}`, 32, 48);
    }
    g.clear();

    // ── Gun Shoot Frame 0 — Aim (gun raised forward) ────────────
    g.clear();
    drawGunUpper(0);
    drawLegs(0, 0);
    // Arm extended
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(20, 18, 6, 3); // arm reaching forward
    // Gun horizontal aimed forward
    g.fillStyle(0x455a64, 1);
    g.fillRect(24, 16, 8, 3); // long barrel
    g.fillStyle(0x37474f, 1);
    g.fillRect(22, 15, 5, 5); // receiver
    g.fillStyle(0x5d4037, 1);
    g.fillRect(22, 20, 3, 4); // grip
    g.generateTexture('player-gun-shoot-0', 32, 48);
    g.clear();

    // ── Gun Shoot Frame 1 — Fire! (muzzle flash + recoil) ───────
    g.clear();
    drawGunUpper(-1); // recoil pushes body back slightly
    drawLegs(0, 0);
    // Arm extended with recoil
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(18, 18, 6, 3);
    // Gun kicked back slightly
    g.fillStyle(0x455a64, 1);
    g.fillRect(22, 16, 7, 3);
    g.fillStyle(0x37474f, 1);
    g.fillRect(20, 15, 5, 5);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(20, 20, 3, 4);
    // Muzzle flash! (bright yellow-white star)
    g.fillStyle(0xffff00, 1);
    g.fillRect(29, 14, 3, 2);
    g.fillRect(28, 13, 2, 4);
    g.fillStyle(0xffffff, 1);
    g.fillRect(29, 14, 2, 2);
    // Flash rays
    g.fillStyle(0xffcc00, 0.8);
    g.fillRect(31, 15, 1, 1);
    g.fillRect(29, 12, 1, 1);
    g.fillRect(29, 17, 1, 1);
    g.generateTexture('player-gun-shoot-1', 32, 48);
    g.clear();

    // ── Gun Shoot Frame 2 — Recovery (smoke) ────────────────────
    g.clear();
    drawGunUpper(0);
    drawLegs(0, 0);
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(20, 18, 6, 3);
    g.fillStyle(0x455a64, 1);
    g.fillRect(24, 16, 8, 3);
    g.fillStyle(0x37474f, 1);
    g.fillRect(22, 15, 5, 5);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(22, 20, 3, 4);
    // Smoke wisp
    g.fillStyle(0xaaaaaa, 0.4);
    g.fillRect(30, 12, 2, 2);
    g.fillRect(29, 10, 2, 2);
    g.fillStyle(0xcccccc, 0.3);
    g.fillRect(31, 9, 1, 2);
    g.generateTexture('player-gun-shoot-2', 32, 48);
    g.clear();

    // ── Gun Jump Frame ──────────────────────────────────────────
    g.clear();
    drawGunUpper(-2);
    g.fillStyle(0x34495e, 1);
    g.fillRect(10, 32, 5, 7);
    g.fillRect(17, 32, 5, 7);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(9, 37, 7, 4);
    g.fillRect(16, 37, 7, 4);
    drawGun(24, 20, true);
    g.generateTexture('player-gun-jump', 32, 48);
    g.clear();

    // ── Gun Fall Frame ──────────────────────────────────────────
    g.clear();
    drawGunUpper(2);
    g.fillStyle(0x34495e, 1);
    g.fillRect(9, 38, 5, 10);
    g.fillRect(18, 38, 5, 10);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(8, 46, 7, 2);
    g.fillRect(17, 46, 7, 2);
    drawGun(24, 24, true);
    g.generateTexture('player-gun-fall', 32, 48);
    g.clear();

    // ── Gun Dash Frame ──────────────────────────────────────────
    g.clear();
    // Leaning forward
    g.fillStyle(0x1a1a2e, 1);
    g.fillRect(12, 4, 16, 12);
    g.fillRect(10, 8, 20, 8);
    g.fillStyle(0xffaa00, 1);
    g.fillRect(16, 8, 3, 3);
    g.fillRect(22, 8, 3, 3);
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(12, 14, 16, 18);
    // Bandolier
    g.fillStyle(0x795548, 1);
    g.fillRect(14, 18, 12, 2);
    g.fillStyle(0x6c3483, 1);
    g.fillRect(4, 16, 8, 14);
    g.fillStyle(0x34495e, 1);
    g.fillRect(14, 32, 5, 10);
    g.fillRect(20, 34, 5, 8);
    g.fillStyle(0x5d4037, 1);
    g.fillRect(13, 40, 7, 5);
    g.fillRect(19, 40, 7, 5);
    // Speed lines
    g.lineStyle(1, 0xffaa44, 0.6);
    g.lineBetween(0, 12, 8, 12);
    g.lineBetween(0, 20, 6, 20);
    g.lineBetween(2, 28, 10, 28);
    // Gun forward
    g.fillStyle(0x455a64, 1);
    g.fillRect(26, 12, 6, 3);
    g.fillStyle(0x37474f, 1);
    g.fillRect(24, 11, 4, 5);
    g.generateTexture('player-gun-dash', 32, 48);
    g.clear();

    g.destroy();
  }

  // ── Placeholder animations ─────────────────────────────────────────

  /**
   * Create multi-frame animations for player states, enemies.
   * Player attack features a 3-frame sword swing with visible arc trail.
   */
  private createPlaceholderAnimations(): void {

    // ── Player Animations ────────────────────────────────────────

    if (!this.anims.exists('player-idle')) {
      this.anims.create({
        key: 'player-idle',
        frames: [
          { key: 'player' },
          { key: 'player-idle-1' },
        ],
        frameRate: 3,
        repeat: -1,
        yoyo: true,
      });
    }

    if (!this.anims.exists('player-run')) {
      this.anims.create({
        key: 'player-run',
        frames: [
          { key: 'player-run-0' },
          { key: 'player-run-1' },
          { key: 'player-run-2' },
          { key: 'player-run-3' },
        ],
        frameRate: 8,
        repeat: -1,
      });
    }

    if (!this.anims.exists('player-attack')) {
      this.anims.create({
        key: 'player-attack',
        frames: [
          { key: 'player-atk-0' },
          { key: 'player-atk-1' },
          { key: 'player-atk-2' },
        ],
        frameRate: 10,
        repeat: 0,
      });
    }

    if (!this.anims.exists('player-jump')) {
      this.anims.create({
        key: 'player-jump',
        frames: [{ key: 'player-jump-f' }],
        frameRate: 1,
        repeat: 0,
      });
    }

    if (!this.anims.exists('player-fall')) {
      this.anims.create({
        key: 'player-fall',
        frames: [{ key: 'player-fall-f' }],
        frameRate: 1,
        repeat: 0,
      });
    }

    if (!this.anims.exists('player-hurt')) {
      this.anims.create({
        key: 'player-hurt',
        frames: [{ key: 'player-hurt-f' }],
        frameRate: 1,
        repeat: 0,
      });
    }

    if (!this.anims.exists('player-death')) {
      this.anims.create({
        key: 'player-death',
        frames: [{ key: 'player-death-f' }],
        frameRate: 1,
        repeat: 0,
      });
    }

    if (!this.anims.exists('player-dash')) {
      this.anims.create({
        key: 'player-dash',
        frames: [{ key: 'player-dash-f' }],
        frameRate: 1,
        repeat: 0,
      });
    }

    // ── Player Gun Animations ────────────────────────────────────

    if (!this.anims.exists('player-gun-idle')) {
      this.anims.create({
        key: 'player-gun-idle',
        frames: [
          { key: 'player-gun-idle-0' },
          { key: 'player-gun-idle-1' },
        ],
        frameRate: 3,
        repeat: -1,
        yoyo: true,
      });
    }

    if (!this.anims.exists('player-gun-run')) {
      this.anims.create({
        key: 'player-gun-run',
        frames: [
          { key: 'player-gun-run-0' },
          { key: 'player-gun-run-1' },
          { key: 'player-gun-run-2' },
          { key: 'player-gun-run-3' },
        ],
        frameRate: 8,
        repeat: -1,
      });
    }

    if (!this.anims.exists('player-gun-shoot')) {
      this.anims.create({
        key: 'player-gun-shoot',
        frames: [
          { key: 'player-gun-shoot-0' },
          { key: 'player-gun-shoot-1' },
          { key: 'player-gun-shoot-2' },
        ],
        frameRate: 12,
        repeat: 0,
      });
    }

    if (!this.anims.exists('player-gun-jump')) {
      this.anims.create({
        key: 'player-gun-jump',
        frames: [{ key: 'player-gun-jump' }],
        frameRate: 1,
        repeat: 0,
      });
    }

    if (!this.anims.exists('player-gun-fall')) {
      this.anims.create({
        key: 'player-gun-fall',
        frames: [{ key: 'player-gun-fall' }],
        frameRate: 1,
        repeat: 0,
      });
    }

    if (!this.anims.exists('player-gun-dash')) {
      this.anims.create({
        key: 'player-gun-dash',
        frames: [{ key: 'player-gun-dash' }],
        frameRate: 1,
        repeat: 0,
      });
    }

    // ── Slime Animations ─────────────────────────────────────────

    if (!this.anims.exists('slime-idle')) {
      this.anims.create({
        key: 'slime-idle',
        frames: [
          { key: 'enemy-slime' },
          { key: 'slime-f1' },
        ],
        frameRate: 3,
        repeat: -1,
        yoyo: true,
      });
    }

    if (!this.anims.exists('slime-walk')) {
      this.anims.create({
        key: 'slime-walk',
        frames: [
          { key: 'enemy-slime' },
          { key: 'slime-f1' },
        ],
        frameRate: 5,
        repeat: -1,
      });
    }

    if (!this.anims.exists('slime-attack')) {
      this.anims.create({
        key: 'slime-attack',
        frames: [
          { key: 'enemy-slime' },
          { key: 'slime-atk' },
        ],
        frameRate: 6,
        repeat: 0,
      });
    }

    if (!this.anims.exists('slime-hurt')) {
      this.anims.create({
        key: 'slime-hurt',
        frames: [{ key: 'slime-f1' }],
        frameRate: 1,
        repeat: 0,
      });
    }

    if (!this.anims.exists('slime-death')) {
      this.anims.create({
        key: 'slime-death',
        frames: [{ key: 'slime-f1' }],
        frameRate: 1,
        repeat: 0,
      });
    }

    // ── Goblin Animations ────────────────────────────────────────

    if (!this.anims.exists('goblin-idle')) {
      this.anims.create({
        key: 'goblin-idle',
        frames: [
          { key: 'enemy-goblin' },
          { key: 'goblin-f1' },
        ],
        frameRate: 3,
        repeat: -1,
        yoyo: true,
      });
    }

    if (!this.anims.exists('goblin-walk')) {
      this.anims.create({
        key: 'goblin-walk',
        frames: [
          { key: 'enemy-goblin' },
          { key: 'goblin-f1' },
        ],
        frameRate: 6,
        repeat: -1,
      });
    }

    if (!this.anims.exists('goblin-attack')) {
      this.anims.create({
        key: 'goblin-attack',
        frames: [
          { key: 'enemy-goblin' },
          { key: 'goblin-atk' },
        ],
        frameRate: 8,
        repeat: 0,
      });
    }

    if (!this.anims.exists('goblin-hurt')) {
      this.anims.create({
        key: 'goblin-hurt',
        frames: [{ key: 'goblin-f1' }],
        frameRate: 1,
        repeat: 0,
      });
    }

    if (!this.anims.exists('goblin-death')) {
      this.anims.create({
        key: 'goblin-death',
        frames: [{ key: 'goblin-f1' }],
        frameRate: 1,
        repeat: 0,
      });
    }

    // ── Bat Animations ───────────────────────────────────────────

    if (!this.anims.exists('bat-idle')) {
      this.anims.create({
        key: 'bat-idle',
        frames: [
          { key: 'enemy-bat' },
          { key: 'bat-f1' },
        ],
        frameRate: 6,
        repeat: -1,
      });
    }

    if (!this.anims.exists('bat-walk')) {
      this.anims.create({
        key: 'bat-walk',
        frames: [
          { key: 'enemy-bat' },
          { key: 'bat-f1' },
        ],
        frameRate: 8,
        repeat: -1,
      });
    }

    if (!this.anims.exists('bat-attack')) {
      this.anims.create({
        key: 'bat-attack',
        frames: [
          { key: 'bat-f1' },
          { key: 'enemy-bat' },
        ],
        frameRate: 8,
        repeat: 0,
      });
    }

    if (!this.anims.exists('bat-hurt')) {
      this.anims.create({
        key: 'bat-hurt',
        frames: [{ key: 'bat-f1' }],
        frameRate: 1,
        repeat: 0,
      });
    }

    if (!this.anims.exists('bat-death')) {
      this.anims.create({
        key: 'bat-death',
        frames: [{ key: 'bat-f1' }],
        frameRate: 1,
        repeat: 0,
      });
    }
  }
}
