/**
 * CameraManager - Handles camera follow, bounds, shake, and zoom.
 *
 * Architecture Decision:
 * Encapsulates all camera logic so scenes don't interact with the raw
 * camera API directly.  Supports smooth follow via lerp, world-bound
 * clamping, screen-shake presets, and runtime zoom control.
 */
import Phaser from 'phaser';
import { useSettingsStore } from '../../stores/settingsStore';

/** Default lerp speed for smooth follow (0 = no follow, 1 = instant) */
const DEFAULT_LERP = 0.1;

export class CameraManager {
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene) {
    this.camera = scene.cameras.main;
  }

  // ── Follow ─────────────────────────────────────────────────────────

  /**
   * Start following a game object with smooth interpolation.
   * @param target  The game object to follow (usually the Player sprite).
   * @param lerp    Smoothing factor (0-1). Lower = smoother.
   */
  startFollow(
    target: Phaser.GameObjects.GameObject,
    lerp: number = DEFAULT_LERP,
  ): void {
    this.camera.startFollow(target, true, lerp, lerp);
  }

  /** Stop following any target */
  stopFollow(): void {
    this.camera.stopFollow();
  }

  // ── Bounds ─────────────────────────────────────────────────────────

  /** Constrain the camera within the world rectangle */
  setBounds(x: number, y: number, width: number, height: number): void {
    this.camera.setBounds(x, y, width, height);
  }

  // ── Shake ──────────────────────────────────────────────────────────

  /**
   * Trigger a screen shake effect.
   * @param duration  Duration in milliseconds (default 100).
   * @param intensity Shake strength (default 0.01).
   */
  shake(duration: number = 100, intensity: number = 0.01): void {
    if (!useSettingsStore.getState().screenShake) return;
    this.camera.shake(duration, intensity);
  }

  /** Pre-configured shake for damage feedback */
  shakeOnDamage(): void {
    this.shake(150, 0.008);
  }

  /** Pre-configured shake for heavy impacts */
  shakeOnImpact(): void {
    this.shake(200, 0.015);
  }

  // ── Zoom ───────────────────────────────────────────────────────────

  /** Set camera zoom instantly */
  setZoom(zoom: number): void {
    this.camera.setZoom(zoom);
  }

  /** Smoothly tween to a target zoom level */
  zoomTo(zoom: number, duration: number = 500): void {
    this.camera.zoomTo(zoom, duration);
  }

  // ── Accessor ───────────────────────────────────────────────────────

  /** Expose the underlying Phaser camera for edge-cases */
  getCamera(): Phaser.Cameras.Scene2D.Camera {
    return this.camera;
  }
}
