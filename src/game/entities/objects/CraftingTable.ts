/**
 * CraftingTable — Workbench where the player merges the 5 documents into the Full Profile.
 *
 * Architecture:
 * - Static physics body placed near the end of the map (beyond the boss area)
 * - Approaching and interacting triggers the merge if conditions are met
 * - Emits DOCUMENTS_MERGED event
 */
import Phaser from 'phaser';
import EventBus from '../../EventBus';
import { GameEvent } from '../../../types/game.types';

const INTERACT_RANGE = 55;

export class CraftingTable extends Phaser.GameObjects.Container {
  public merged: boolean = false;
  private iconText: Phaser.GameObjects.Text;
  private promptText: Phaser.GameObjects.Text;
  private glowGraphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    scene.add.existing(this);
    this.setDepth(5);

    // Glowing base circle under the table
    this.glowGraphics = scene.add.graphics();
    this.glowGraphics.fillStyle(0x00e676, 0.12); // Neon green glow
    this.glowGraphics.fillCircle(x, y + 4, 18);
    this.glowGraphics.setDepth(4);

    // Workbench icon (using tools/magic emoji)
    this.iconText = scene.add.text(x, y - 6, '⚒️', {
      fontSize: '22px',
    }).setOrigin(0.5).setDepth(6);

    // Idle pulse animations
    scene.tweens.add({
      targets: this.iconText,
      y: y - 10,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    scene.tweens.add({
      targets: this.glowGraphics,
      alpha: { from: 0.4, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Interact prompt text
    this.promptText = scene.add.text(x, y - 34, '[G] Ghép hồ sơ', {
      fontSize: '10px', color: '#00e676', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6).setVisible(false);
  }

  /** Check if player is within range */
  isPlayerInRange(playerX: number, playerY: number): boolean {
    if (this.merged) return false;
    const dx = Math.abs(playerX - this.x);
    const dy = Math.abs(playerY - this.y);
    return dx < INTERACT_RANGE && dy < INTERACT_RANGE;
  }

  /** Show/hide G interact prompt */
  showPrompt(visible: boolean, collectedCount: number): void {
    if (this.merged) {
      this.promptText.setVisible(false);
      return;
    }
    
    if (visible) {
      if (collectedCount < 3) {
        this.promptText.setText(`[G] Ghép hồ sơ (${collectedCount}/3)`);
        this.promptText.setColor('#ff3d00'); // red/orange if incomplete
      } else {
        this.promptText.setText('[G] Ghép hồ sơ (Sẵn sàng)');
        this.promptText.setColor('#00e676'); // green if complete
      }
    }
    
    this.promptText.setVisible(visible);
  }

  /** Perform merge animation and trigger merge success */
  merge(): void {
    if (this.merged) return;
    this.merged = true;

    this.promptText.setVisible(false);
    this.promptText.destroy();

    // Fade out and shrink table visuals immediately
    this.scene.tweens.add({
      targets: [this.iconText, this.glowGraphics],
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        this.destroyTable();
      }
    });

    // Spawn success particle rings
    const circle = this.scene.add.graphics();
    circle.lineStyle(2, 0x00e676, 0.8);
    circle.strokeCircle(this.x, this.y, 2);
    circle.setDepth(10);
    
    this.scene.tweens.add({
      targets: circle,
      scaleX: 30,
      scaleY: 30,
      alpha: 0,
      duration: 1000,
      onComplete: () => circle.destroy(),
    });

    // Emit final merge success event
    EventBus.emit(GameEvent.DOCUMENTS_MERGED);
  }

  /** Cleanup */
  destroyTable(): void {
    this.scene.tweens.killTweensOf(this.iconText);
    this.scene.tweens.killTweensOf(this.glowGraphics);
    this.iconText.destroy();
    this.glowGraphics.destroy();
    if (this.promptText && this.promptText.active) this.promptText.destroy();
    this.destroy();
  }
}
