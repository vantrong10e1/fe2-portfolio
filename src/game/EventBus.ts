/**
 * EventBus - Singleton event emitter for React ↔ Phaser communication.
 *
 * Architecture Decision:
 * We use Phaser's built-in EventEmitter (backed by eventemitter3) as a
 * decoupled message bus. This allows React components to subscribe to
 * game events (HP changes, level ups, etc.) without holding direct
 * references to Phaser scenes or game objects, and vice versa.
 *
 * Usage:
 *   Phaser side:  EventBus.emit(GameEvent.HP_CHANGED, { current: 80, max: 100 });
 *   React side:   EventBus.on(GameEvent.HP_CHANGED, handler);
 */
import Phaser from 'phaser';

/** Singleton event bus shared between React and Phaser layers */
const EventBus = new Phaser.Events.EventEmitter();

export default EventBus;
