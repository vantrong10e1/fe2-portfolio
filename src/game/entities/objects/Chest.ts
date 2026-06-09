/**
 * Chest — Treasure chest that can be opened once by the player.
 *
 * Architecture:
 * - Static physics body placed on platforms/ground
 * - Opens when player presses interact key (G) within range
 * - Drops random loot (gold + items) on open
 * - Emits CHEST_OPENED event for VFX and inventory integration
 * - Cannot be re-opened after opening
 */
import Phaser from 'phaser';
import EventBus from '../../EventBus';
import { GameEvent } from '../../../types/game.types';

/** Chest state */
export enum ChestState {
  CLOSED = 'closed',
  OPENING = 'opening',
  OPENED = 'opened',
}

/** Loot entry from a chest */
export interface ChestLoot {
  gold: number;
  items: { itemId: string; quantity: number }[];
}

/** Loot table entry */
export interface LootEntry {
  itemId: string;
  chance: number;       // 0-1
  minQuantity: number;
  maxQuantity: number;
}

/** Chest configuration */
export interface ChestConfig {
  id: string;
  x: number;
  y: number;
  goldMin: number;
  goldMax: number;
  lootTable: LootEntry[];
}

// ── Interaction Range ──────────────────────────────────────────────────
const INTERACT_RANGE = 50;

export class Chest extends Phaser.GameObjects.Rectangle {
  public readonly chestId: string;
  public state: ChestState = ChestState.CLOSED;
  private config: ChestConfig;

  /** Visual elements */
  private chestIcon!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, config: ChestConfig) {
    // Create as a styled rectangle for the chest body
    super(scene, config.x, config.y, 28, 24, 0x8b4513);

    this.chestId = config.id;
    this.config = config;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body

    // Set depth so chest renders above ground
    this.setDepth(5);

    // Physics body
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(28, 24);

    // Chest icon (emoji above the box)
    this.chestIcon = scene.add.text(config.x, config.y - 20, '📦', {
      fontSize: '18px',
    }).setOrigin(0.5).setDepth(6);

    // Interaction prompt (hidden by default)
    this.promptText = scene.add.text(config.x, config.y - 40, '[G] Mở', {
      fontSize: '10px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6).setVisible(false);

    // Glow effect (pulsing alpha)
    scene.tweens.add({
      targets: this.chestIcon,
      alpha: { from: 0.7, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }

  /** Check if player is within interaction range */
  isPlayerInRange(playerX: number, playerY: number): boolean {
    if (this.state !== ChestState.CLOSED) return false;
    const dx = Math.abs(playerX - this.x);
    const dy = Math.abs(playerY - this.y);
    return dx < INTERACT_RANGE && dy < INTERACT_RANGE;
  }

  /** Show/hide interaction prompt */
  showPrompt(visible: boolean): void {
    if (this.state !== ChestState.CLOSED) {
      this.promptText.setVisible(false);
      return;
    }
    this.promptText.setVisible(visible);
  }

  /** Open the chest and return loot */
  open(): ChestLoot | null {
    if (this.state !== ChestState.CLOSED) return null;

    this.state = ChestState.OPENING;

    // Calculate random gold
    const gold = Phaser.Math.Between(this.config.goldMin, this.config.goldMax);

    // Roll loot table
    const items: { itemId: string; quantity: number }[] = [];
    for (const entry of this.config.lootTable) {
      if (Math.random() <= entry.chance) {
        const qty = Phaser.Math.Between(entry.minQuantity, entry.maxQuantity);
        items.push({ itemId: entry.itemId, quantity: qty });
      }
    }

    const loot: ChestLoot = { gold, items };

    // Visual: change to opened state
    this.setFillStyle(0x5c3a1e, 0.6);
    this.chestIcon.setText('📭');
    this.promptText.setVisible(false);

    // Stop pulsing
    this.scene.tweens.killTweensOf(this.chestIcon);
    this.chestIcon.setAlpha(0.5);

    this.state = ChestState.OPENED;

    // Fade out and float up, then destroy
    this.scene.tweens.add({
      targets: [this, this.chestIcon],
      alpha: 0,
      y: '-=15',
      duration: 600,
      ease: 'Power2.easeOut',
      onComplete: () => {
        this.destroyChest();
      }
    });

    // Emit event
    EventBus.emit(GameEvent.CHEST_OPENED, {
      id: this.chestId,
      x: this.x,
      y: this.y,
      loot,
    });

    return loot;
  }

  /** Force open chest (used for loading save progress) */
  forceOpen(): void {
    this.state = ChestState.OPENED;
    this.setFillStyle(0x5c3a1e, 0.6);
    this.chestIcon.setText('📭');
    this.promptText.setVisible(false);
    this.scene.tweens.killTweensOf(this.chestIcon);
    this.chestIcon.setAlpha(0.5);
  }

  /** Cleanup */
  destroyChest(): void {
    this.chestIcon.destroy();
    this.promptText.destroy();
    this.destroy();
  }
}
