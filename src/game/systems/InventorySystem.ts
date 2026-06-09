/**
 * InventorySystem — Manages player items, gold, and equipment state.
 *
 * Architecture:
 * - Static ITEM_REGISTRY defines all available items
 * - Player starts with default equipment (Iron Sword + Light Gun)
 * - Gold earned from enemy kills
 * - Items stored as InventorySlot[] with quantity tracking
 * - Emits events for UI updates
 */
import EventBus from '../EventBus';
import { GameEvent } from '../../types/game.types';
import {
  ItemCategory,
  ItemRarity,
} from '../../types/item.types';
import type { ItemDef, InventorySlot } from '../../types/item.types';

// ── Item Registry ──────────────────────────────────────────────────────

export const ITEM_REGISTRY: Record<string, ItemDef> = {
  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.COMMON,
    icon: '⚔',
    description: 'Kiếm sắt cơ bản. Sát thương: 15. Có khả năng hút máu 8%.',
    stackable: false,
    maxStack: 1,
  },
  flintlock_pistol: {
    id: 'flintlock_pistol',
    name: 'Light Gun',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.COMMON,
    icon: '🔫',
    description: 'Súng ánh sáng. Sát thương: 10. Chí mạng 40%. Đạn: 10/10.',
    stackable: false,
    maxStack: 1,
  },
  health_potion: {
    id: 'health_potion',
    name: 'Bình máu',
    category: ItemCategory.CONSUMABLE,
    rarity: ItemRarity.COMMON,
    icon: '❤',
    description: 'Hồi phục 30 HP ngay lập tức.',
    effect: { type: 'heal_hp', value: 30 },
    stackable: true,
    maxStack: 99,
  },
  mana_potion: {
    id: 'mana_potion',
    name: 'Bình mana',
    category: ItemCategory.CONSUMABLE,
    rarity: ItemRarity.COMMON,
    icon: '💙',
    description: 'Hồi phục 20 MP ngay lập tức.',
    effect: { type: 'heal_mp', value: 20 },
    stackable: true,
    maxStack: 99,
  },
  slime_jelly: {
    id: 'slime_jelly',
    name: 'Slime Jelly',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.COMMON,
    icon: '🟢',
    description: 'Chất nhầy từ Slime. Nguyên liệu chế tạo.',
    stackable: true,
    maxStack: 99,
  },
  bat_wing: {
    id: 'bat_wing',
    name: 'Bat Wing',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.UNCOMMON,
    icon: '🦇',
    description: 'Cánh dơi bóng tối. Nguyên liệu hiếm.',
    stackable: true,
    maxStack: 99,
  },
  goblin_shield: {
    id: 'goblin_shield',
    name: 'Goblin Shield',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.UNCOMMON,
    icon: '🛡',
    description: 'Khiên Goblin đã vỡ. Có thể bán giá cao.',
    stackable: true,
    maxStack: 99,
  },
};

// ── Rarity Colors ──────────────────────────────────────────────────────

export const RARITY_COLORS: Record<string, string> = {
  [ItemRarity.COMMON]: '#cccccc',
  [ItemRarity.UNCOMMON]: '#2ecc71',
  [ItemRarity.RARE]: '#3498db',
  [ItemRarity.EPIC]: '#9b59b6',
  [ItemRarity.LEGENDARY]: '#f39c12',
};

// ── InventorySystem Class ──────────────────────────────────────────────

export class InventorySystem {
  /** Player's gold */
  private gold: number = 0;

  /** Item slots */
  private slots: InventorySlot[] = [];

  /** Equipment slots: currently equipped weapon IDs */
  private equippedWeapon: string = 'iron_sword';

  /** Collected document IDs */
  private collectedDocuments: string[] = [];

  constructor() {
    // Start with default items
    this.slots = [
      { itemId: 'iron_sword', quantity: 1 },
      { itemId: 'flintlock_pistol', quantity: 1 },
      { itemId: 'health_potion', quantity: 3 },
      { itemId: 'mana_potion', quantity: 2 },
    ];

    // Listen for gold from kills
    EventBus.on(GameEvent.ENEMY_KILLED, this.onEnemyKilled, this);

    // Listen for collected documents
    EventBus.on(GameEvent.DOCUMENT_COLLECTED, this.onDocumentCollected, this);
  }

  // ── Public API ──────────────────────────────────────────────────────

  getGold(): number { return this.gold; }

  addGold(amount: number): void {
    this.gold += amount;
  }

  getSlots(): readonly InventorySlot[] { return this.slots; }

  getEquippedWeapon(): string { return this.equippedWeapon; }

  setEquippedWeapon(itemId: string): void {
    this.equippedWeapon = itemId;
  }

  getCollectedDocuments(): string[] {
    return this.collectedDocuments;
  }

  addCollectedDocument(docId: string): void {
    if (!this.collectedDocuments.includes(docId)) {
      this.collectedDocuments.push(docId);
    }
  }

  mergeDocuments(): void {
    this.collectedDocuments = this.collectedDocuments.filter(
      id => id !== 'doc_1' && id !== 'doc_2' && id !== 'doc_3'
    );
    this.addCollectedDocument('merged_doc');
  }

  /** Add an item to inventory. Returns true if successful. */
  addItem(itemId: string, quantity: number = 1): boolean {
    const def = ITEM_REGISTRY[itemId];
    if (!def) return false;

    if (def.stackable) {
      const existing = this.slots.find(s => s.itemId === itemId);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + quantity, def.maxStack);
        return true;
      }
    }

    this.slots.push({ itemId, quantity });
    return true;
  }

  /** Remove quantity of an item. Returns true if successful. */
  removeItem(itemId: string, quantity: number = 1): boolean {
    const idx = this.slots.findIndex(s => s.itemId === itemId);
    if (idx === -1) return false;

    const slot = this.slots[idx];
    if (slot.quantity < quantity) return false;

    slot.quantity -= quantity;
    if (slot.quantity <= 0) {
      this.slots.splice(idx, 1);
    }
    return true;
  }

  /** Get quantity of a specific item */
  getItemQuantity(itemId: string): number {
    const slot = this.slots.find(s => s.itemId === itemId);
    return slot?.quantity ?? 0;
  }

  /** Check if player has at least `quantity` of an item */
  hasItem(itemId: string, quantity: number = 1): boolean {
    return this.getItemQuantity(itemId) >= quantity;
  }

  /** Get all items in a specific category */
  getItemsByCategory(category: ItemCategory): InventorySlot[] {
    return this.slots.filter(s => {
      const def = ITEM_REGISTRY[s.itemId];
      return def && def.category === category;
    });
  }

  // ── Internal ────────────────────────────────────────────────────────

  private onEnemyKilled(data: { gold: number; type: string }): void {
    this.addGold(data.gold);

    // Random material drops
    if (data.type === 'slime' && Math.random() < 0.4) {
      this.addItem('slime_jelly', 1);
    } else if (data.type === 'bat' && Math.random() < 0.3) {
      this.addItem('bat_wing', 1);
    } else if (data.type === 'goblin' && Math.random() < 0.25) {
      this.addItem('goblin_shield', 1);
    }
  }

  private onDocumentCollected(data: { id: string }): void {
    this.addCollectedDocument(data.id);
  }

  /** Cleanup event listeners */
  destroy(): void {
    EventBus.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled, this);
    EventBus.off(GameEvent.DOCUMENT_COLLECTED, this.onDocumentCollected, this);
  }
}
