/**
 * Document — Collectible lore item on the map.
 *
 * Architecture:
 * - Static physics body placed at specific map locations
 * - Player approaches and presses G to collect
 * - Once collected, the document is stored and can be re-read via inventory
 * - Emits DOCUMENT_COLLECTED event for UI viewer
 */
import Phaser from 'phaser';
import EventBus from '../../EventBus';
import { GameEvent } from '../../../types/game.types';

// ── Document Definition ────────────────────────────────────────────────

export interface DocumentDef {
  id: string;
  title: string;
  content: string;
  icon: string;
}

// ── Document Registry ──────────────────────────────────────────────────

export const DOCUMENT_REGISTRY: Record<string, DocumentDef> = {
  doc_1: {
    id: 'doc_1',
    title: 'Mảnh Giấy 1',
    content: `THÔNG TIN CÁ NHÂN & HỌC VẤN

- Họ và Tên: TRẦN VĂN TRỌNG
- Vai trò: Sinh Viên Năm Cuối
- Học lực: Xếp loại Khá
- GPA Tích Lũy: 7.4 / 10`,
    icon: '📄',
  },
  doc_2: {
    id: 'doc_2',
    title: 'Mảnh Giấy 2',
    content: `THÔNG TIN LIÊN HỆ

- Số điện thoại: 0971028904
- Địa chỉ: Đường 42, TP. Thủ Đức
- Email:
  email.tranvantrong.2015@gmail.com`,
    icon: '📄',
  },
  doc_3: {
    id: 'doc_3',
    title: 'Mảnh Giấy 3',
    content: `KỸ NĂNG & CÔNG NGHỆ CHUYÊN MÔN

- Ngôn ngữ Lập trình:
  C#, HTML, CSS, JS, Java,
  Kotlin, Swift, Python
- Framework: Laravel
- Công nghệ & Công cụ: Git, GitHub
- AI Agents:
  DeepSeek, Claude, ChatGPT,
  Gemini, V0.app, Grok`,
    icon: '📄',
  },
  merged_doc: {
    id: 'merged_doc',
    title: 'Hồ Sơ Hoàn Chỉnh',
    content: `HỒ SƠ CÁ NHÂN & NĂNG LỰC CHUYÊN MÔN
Ứng viên: TRẦN VĂN TRỌNG

1. THÔNG TIN CÁ NHÂN & HỌC VẤN
- Họ và Tên: TRẦN VĂN TRỌNG
- Vai trò: Sinh Viên Năm Cuối
- Học lực: Xếp loại Khá (GPA: 7.4/10)

2. THÔNG TIN LIÊN HỆ
- Số điện thoại: 0971028904
- Địa chỉ: Đường 42, TP. Thủ Đức,
  TP. Hồ Chí Minh
- Email:
  email.tranvantrong.2015@gmail.com

3. KỸ NĂNG & CÔNG NGHỆ CHUYÊN MÔN
- Ngôn ngữ Lập trình:
  C#, HTML, CSS, JS, Java,
  Kotlin, Swift, Python
- Framework sử dụng: Laravel
- Công nghệ & Công cụ: Git, GitHub
- AI Agents:
  DeepSeek, Claude, ChatGPT,
  Gemini, V0.app, Grok`,
    icon: '',
  },
};

// ── Interaction Range ──────────────────────────────────────────────────
const INTERACT_RANGE = 45;

// ── Document Entity ────────────────────────────────────────────────────

export class Document extends Phaser.GameObjects.Container {
  public readonly docId: string;
  public collected: boolean = false;
  private docDef: DocumentDef;
  private iconText: Phaser.GameObjects.Text;
  private promptText: Phaser.GameObjects.Text;
  private glowGraphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, docId: string) {
    super(scene, x, y);

    this.docId = docId;
    this.docDef = DOCUMENT_REGISTRY[docId];

    scene.add.existing(this);
    this.setDepth(5);

    // Glow circle underneath
    this.glowGraphics = scene.add.graphics();
    this.glowGraphics.fillStyle(0xf1c40f, 0.15);
    this.glowGraphics.fillCircle(x, y + 4, 14);
    this.glowGraphics.setDepth(4);

    // Document icon
    this.iconText = scene.add.text(x, y - 6, this.docDef.icon, {
      fontSize: '20px',
    }).setOrigin(0.5).setDepth(6);

    // Float animation
    scene.tweens.add({
      targets: this.iconText,
      y: y - 12,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Glow pulse
    scene.tweens.add({
      targets: this.glowGraphics,
      alpha: { from: 0.4, to: 1 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });

    // Prompt text (hidden)
    this.promptText = scene.add.text(x, y - 32, '[G] Nhặt', {
      fontSize: '10px', color: '#f1c40f', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6).setVisible(false);
  }

  /** Check if player is within interaction range */
  isPlayerInRange(playerX: number, playerY: number): boolean {
    if (this.collected) return false;
    const dx = Math.abs(playerX - this.x);
    const dy = Math.abs(playerY - this.y);
    return dx < INTERACT_RANGE && dy < INTERACT_RANGE;
  }

  /** Show/hide interaction prompt */
  showPrompt(visible: boolean): void {
    if (this.collected) {
      this.promptText.setVisible(false);
      return;
    }
    this.promptText.setVisible(visible);
  }

  /** Collect the document */
  collect(): DocumentDef | null {
    if (this.collected) return null;
    this.collected = true;

    // Pickup VFX: fly up and fade
    this.scene.tweens.add({
      targets: this.iconText,
      y: this.y - 60,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        this.destroyDocument();
      }
    });

    // Fade glow
    this.scene.tweens.add({
      targets: this.glowGraphics,
      alpha: 0,
      duration: 400,
    });

    this.promptText.setVisible(false);
    if (this.promptText && this.promptText.active) {
      this.promptText.destroy();
    }

    // Emit event
    EventBus.emit(GameEvent.DOCUMENT_COLLECTED, {
      id: this.docId,
      title: this.docDef.title,
      content: this.docDef.content,
      icon: this.docDef.icon,
    });

    return this.docDef;
  }

  /** Cleanup */
  destroyDocument(): void {
    if (this.scene && this.scene.tweens) {
      this.scene.tweens.killTweensOf(this.iconText);
      this.scene.tweens.killTweensOf(this.glowGraphics);
    }
    this.iconText.destroy();
    this.glowGraphics.destroy();
    if (this.promptText && this.promptText.active) this.promptText.destroy();
    this.destroy();
  }
}
