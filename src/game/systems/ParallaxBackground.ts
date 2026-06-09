/**
 * ParallaxBackground — Multi-layer scrolling background
 * 
 * Creates depth illusion by scrolling background layers at different speeds.
 * Layers further away scroll slower (smaller scrollFactor).
 * Uses procedurally generated graphics for the dark fantasy atmosphere.
 */
import Phaser from 'phaser';

interface ParallaxLayer {
  graphics: Phaser.GameObjects.Graphics;
  scrollFactor: number;
}

export class ParallaxBackground {
  private scene: Phaser.Scene;
  private layers: ParallaxLayer[] = [];

  constructor(scene: Phaser.Scene, worldWidth: number, worldHeight: number) {
    this.scene = scene;
    this.createLayers(worldWidth, worldHeight);
  }

  private createLayers(worldWidth: number, worldHeight: number): void {
    // Layer 0: Deep sky gradient (slowest)
    this.createSkyLayer(worldWidth, worldHeight, 0.0);

    // Layer 1: Distant mountains
    this.createMountainLayer(worldWidth, worldHeight, 0.1, 0x1a1a3e, 0.6);

    // Layer 2: Mid mountains  
    this.createMountainLayer(worldWidth, worldHeight, 0.2, 0x22224a, 0.5);

    // Layer 3: Near hills
    this.createMountainLayer(worldWidth, worldHeight, 0.4, 0x2a2a55, 0.4);

    // Layer 4: Trees/foreground silhouettes
    this.createTreeLayer(worldWidth, worldHeight, 0.6);

    // Layer 5: Floating particles (soul-like)
    this.createParticleLayer(worldWidth, worldHeight, 0.3);
  }

  private createSkyLayer(w: number, h: number, scrollFactor: number): void {
    const gfx = this.scene.add.graphics().setDepth(-100);

    // Dark gradient sky
    const steps = 20;
    const stepH = h / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.floor(Phaser.Math.Linear(0x05, 0x1a, t));
      const g = Math.floor(Phaser.Math.Linear(0x05, 0x10, t));
      const b = Math.floor(Phaser.Math.Linear(0x15, 0x2e, t));
      const color = (r << 16) | (g << 8) | b;
      gfx.fillStyle(color, 1);
      gfx.fillRect(0, i * stepH, w, stepH + 1);
    }

    // Stars
    for (let i = 0; i < 80; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h * 0.5;
      const size = Math.random() * 1.5 + 0.5;
      const alpha = Math.random() * 0.6 + 0.2;
      gfx.fillStyle(0xffffff, alpha);
      gfx.fillCircle(sx, sy, size);
    }

    gfx.setScrollFactor(scrollFactor);
    this.layers.push({ graphics: gfx, scrollFactor });
  }

  private createMountainLayer(
    w: number, h: number, scrollFactor: number, 
    color: number, heightRatio: number
  ): void {
    const gfx = this.scene.add.graphics().setDepth(-90 + scrollFactor * 10);

    const baseY = h * heightRatio;
    const peakVariation = h * 0.15;

    gfx.fillStyle(color, 0.9);
    gfx.beginPath();
    gfx.moveTo(0, h);

    // Generate mountain peaks using sine waves
    const segments = Math.ceil(w / 20);
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * w;
      const peak = baseY + 
        Math.sin(i * 0.3) * peakVariation +
        Math.sin(i * 0.7) * peakVariation * 0.5 +
        Math.sin(i * 1.3) * peakVariation * 0.25;
      gfx.lineTo(x, peak);
    }

    gfx.lineTo(w, h);
    gfx.closePath();
    gfx.fill();

    gfx.setScrollFactor(scrollFactor);
    this.layers.push({ graphics: gfx, scrollFactor });
  }

  private createTreeLayer(w: number, h: number, scrollFactor: number): void {
    const gfx = this.scene.add.graphics().setDepth(-50);
    const treeColor = 0x15152a;

    gfx.fillStyle(treeColor, 0.8);

    // Draw tree silhouettes
    const treeCount = Math.ceil(w / 60);
    for (let i = 0; i < treeCount; i++) {
      const tx = i * 60 + Phaser.Math.Between(-15, 15);
      const treeH = Phaser.Math.Between(60, 120);
      const baseY = h - 32; // above ground

      // Trunk
      gfx.fillRect(tx - 3, baseY - treeH, 6, treeH);

      // Canopy (triangle)
      gfx.beginPath();
      gfx.moveTo(tx, baseY - treeH - 30);
      gfx.lineTo(tx - 20, baseY - treeH + 20);
      gfx.lineTo(tx + 20, baseY - treeH + 20);
      gfx.closePath();
      gfx.fill();

      // Second canopy layer
      gfx.beginPath();
      gfx.moveTo(tx, baseY - treeH - 10);
      gfx.lineTo(tx - 15, baseY - treeH + 30);
      gfx.lineTo(tx + 15, baseY - treeH + 30);
      gfx.closePath();
      gfx.fill();
    }

    gfx.setScrollFactor(scrollFactor);
    this.layers.push({ graphics: gfx, scrollFactor });
  }

  private createParticleLayer(w: number, h: number, scrollFactor: number): void {
    // Create floating soul-like particles as individual circles
    const gfx = this.scene.add.graphics().setDepth(-40);

    for (let i = 0; i < 30; i++) {
      const px = Math.random() * w;
      const py = Math.random() * h * 0.8;
      const size = Math.random() * 2 + 1;
      const alpha = Math.random() * 0.3 + 0.1;
      gfx.fillStyle(0x4fc3f7, alpha);
      gfx.fillCircle(px, py, size);
    }

    gfx.setScrollFactor(scrollFactor);
    this.layers.push({ graphics: gfx, scrollFactor });
  }

  destroy(): void {
    this.layers.forEach(l => l.graphics.destroy());
    this.layers = [];
  }
}
