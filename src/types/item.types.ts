export enum ItemCategory {
  WEAPON = 'weapon',
  CONSUMABLE = 'consumable',
  DOCUMENT = 'document',
  MATERIAL = 'material',
}

export enum ItemRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  icon: string;
  description: string;
  stackable: boolean;
  maxStack: number;
  effect?: { type: string; value: number };
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
}
