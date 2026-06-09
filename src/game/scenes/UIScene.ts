/**
 * UIScene — Premium HUD overlay with Pause Menu.
 *
 * Layout (top-left):
 *   LEVEL X
 *   HP: current/max  [████████████████████]
 *   MP: current/max  [████████████████████]
 *   EXP              [██████░░░░░░░░░░░░░] 65%
 *
 * Bottom-left: Skill slots (Q, E, F) with cooldown
 * Bottom-right: Weapon info + ammo
 * Top-right: Kill counter
 * Center (pause): Dark overlay + Resume / Settings / Exit
 */
import Phaser from 'phaser';
import { SceneKey, GameEvent } from '../../types/game.types';
import EventBus from '../EventBus';
import { AudioManager } from '../managers/AudioManager';
import { PLAYER_INITIAL_STATS } from '../utils/Constants';
import { SKILLS } from '../systems/SkillSystem';
import type { Enemy } from '../entities/enemies/Enemy';
import type { InventorySystem } from '../systems/InventorySystem';
import { ITEM_REGISTRY, RARITY_COLORS } from '../systems/InventorySystem';
import { DOCUMENT_REGISTRY } from '../entities/objects/Document';
import { LeaderboardHelper } from '../utils/LeaderboardHelper';
import { useSettingsStore } from '../../stores/settingsStore';

interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

// ── Layout Constants ─────────────────────────────────────────────────
const M = 16;                  // margin
const BAR_W = 220;             // all bars same width
const BAR_H = 14;              // all bars same height
const BAR_R = 3;               // border radius
const ROW_GAP = 6;             // gap between rows
const LABEL_COL = M;           // x for labels
const BAR_COL = M + 90;        // x for bar start (after label text)
const VAL_COL = BAR_COL + BAR_W + 8; // x for value text (right of bar)
const SKILL_Y = 104;           // skill slots Y position

export class UIScene extends Phaser.Scene {
  // ── HUD Graphics ───────────────────────────────────────────────────
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private mpBarBg!: Phaser.GameObjects.Graphics;
  private mpBarFill!: Phaser.GameObjects.Graphics;
  private expBarBg!: Phaser.GameObjects.Graphics;
  private expBarFill!: Phaser.GameObjects.Graphics;

  private levelText!: Phaser.GameObjects.Text;
  private hpLabel!: Phaser.GameObjects.Text;
  private hpValueText!: Phaser.GameObjects.Text;
  private mpLabel!: Phaser.GameObjects.Text;
  private mpValueText!: Phaser.GameObjects.Text;
  private expLabel!: Phaser.GameObjects.Text;
  private expPctText!: Phaser.GameObjects.Text;

  // ── TAB Stats Panel ────────────────────────────────────────────────
  private tabPanelContainer!: Phaser.GameObjects.Container;
  private tabStatsTexts: Phaser.GameObjects.Text[] = [];

  // ── Weapon Display ─────────────────────────────────────────────────
  private weaponNameText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private reloadText!: Phaser.GameObjects.Text;
  private weaponSlotIconText!: Phaser.GameObjects.Text;

  // ── Skill Slots ────────────────────────────────────────────────────
  private skillSlots: Map<string, {
    bg: Phaser.GameObjects.Graphics;
    overlay: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
    cdText: Phaser.GameObjects.Text;
    nameText: Phaser.GameObjects.Text;
  }> = new Map();

  // ── Pause Menu ─────────────────────────────────────────────────────
  private pauseOverlay!: Phaser.GameObjects.Graphics;
  private pausePanel!: Phaser.GameObjects.Graphics;
  private pauseTitle!: Phaser.GameObjects.Text;
  private btnResume!: Phaser.GameObjects.Text;
  private btnSettings!: Phaser.GameObjects.Text;
  private btnAchievements!: Phaser.GameObjects.Text;
  private btnExit!: Phaser.GameObjects.Text;
  private achievementsContainer!: Phaser.GameObjects.Container;
  private achievementListGroup: (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics)[] = [];

  private achievements: Achievement[] = [
    { id: 'first_kill', title: 'Chiến Công Đầu', description: 'Tiêu diệt kẻ địch đầu tiên', unlocked: false },
    { id: 'kill_25', title: 'Kẻ Săn Đuổi', description: 'Tiêu diệt 25 kẻ địch', unlocked: false },
    { id: 'kill_50', title: 'Chiến Binh Điêu Luyện', description: 'Tiêu diệt 50 kẻ địch', unlocked: false },
    { id: 'kill_100', title: 'Huyền Thoại Shadow', description: 'Tiêu diệt 100 kẻ địch', unlocked: false },
    { id: 'reach_lvl_5', title: 'Sức Mạnh Tăng Tiến', description: 'Đạt cấp độ 5', unlocked: false },
    { id: 'reach_lvl_10', title: 'Cảnh Giới Tột Cùng', description: 'Đạt cấp độ 10', unlocked: false },
    { id: 'first_treasure', title: 'Thợ Săn Kho Báu', description: 'Mở rương báu đầu tiên', unlocked: false },
    { id: 'collect_all_pages', title: 'Nhà Sử Học', description: 'Thu thập đầy đủ 3 tài liệu cổ', unlocked: false },
    { id: 'first_boss_kill', title: 'Diệt Hiệp Sĩ Cổ Đại', description: 'Đánh bại Boss Ancient Knight', unlocked: false },
    { id: 'complete_game', title: 'Chúa Tể Bóng Đêm', description: 'Hoàn thành trò chơi (Ghép hồ sơ)', unlocked: false },
  ];

  // ── Inventory Panel ────────────────────────────────────────────────
  private inventoryContainer!: Phaser.GameObjects.Container;

  // ── Settings Panel (Guide) ─────────────────────────────────────────
  private settingsContainer!: Phaser.GameObjects.Container;
  private gameOverContainer!: Phaser.GameObjects.Container;
  private btnBgmOn!: Phaser.GameObjects.Text;
  private btnBgmOff!: Phaser.GameObjects.Text;
  private btnFontLow!: Phaser.GameObjects.Text;
  private btnFontMedium!: Phaser.GameObjects.Text;
  private btnFontHigh!: Phaser.GameObjects.Text;

  // Settings State
  private isMusicOn: boolean = true;
  private fontSizeSetting: 'low' | 'medium' | 'high' = 'medium';
  private settingsUnsubscribe!: () => void;
  private isReactSettingsOpen: boolean = false;
  private isReactTutorialOpen: boolean = false;

  // ── Selected Target Frame HUD ──────────────────────────────────────
  private selectedEnemy: Enemy | null = null;

  // ── Inventory Reference ──────────────────────────────────────
  private inventoryRef: InventorySystem | null = null;
  private targetFrameContainer!: Phaser.GameObjects.Container;
  private targetNameText!: Phaser.GameObjects.Text;
  private targetHpText!: Phaser.GameObjects.Text;
  private targetHpBarBg!: Phaser.GameObjects.Graphics;
  private targetHpBarFill!: Phaser.GameObjects.Graphics;
  private targetShieldBarBg!: Phaser.GameObjects.Graphics;
  private targetShieldBarFill!: Phaser.GameObjects.Graphics;
  private targetCategoryText!: Phaser.GameObjects.Text;

  // ── Tooltips ───────────────────────────────────────────────────────
  private tooltipContainer!: Phaser.GameObjects.Container;
  private tooltipBg!: Phaser.GameObjects.Graphics;
  private tooltipText!: Phaser.GameObjects.Text;

  // ── Boss HP Bar ────────────────────────────────────────────────────
  private bossBarContainer!: Phaser.GameObjects.Container;
  private bossNameText!: Phaser.GameObjects.Text;
  private bossHpBarBg!: Phaser.GameObjects.Graphics;
  private bossHpBarFill!: Phaser.GameObjects.Graphics;
  private bossHpPctText!: Phaser.GameObjects.Text;

  // ── Document Viewer ────────────────────────────────────────────────
  private documentViewerContainer!: Phaser.GameObjects.Container;
  private documentOverlay!: Phaser.GameObjects.Graphics;
  private docTitleText!: Phaser.GameObjects.Text;
  private docContentText!: Phaser.GameObjects.Text;
  private docIconText!: Phaser.GameObjects.Text;
  private maskRect!: Phaser.GameObjects.Rectangle;
  private docContentInitialY: number = 0;
  private docViewportH: number = 350;
  private keyG!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;

  // ── Portfolio Viewer ───────────────────────────────────────────────
  private portfolioViewerContainer!: Phaser.GameObjects.Container;
  private portfolioOverlay!: Phaser.GameObjects.Graphics;
  private portfolioTabContents: Phaser.GameObjects.Container[] = [];
  private portfolioTabButtons: Phaser.GameObjects.Text[] = [];
  private activePortfolioTab: number = 0;

  // Inventory Slot Metadata
  private inventoryLineData: Array<{ type: 'weapon' | 'consumable' | 'material' | 'document' | 'section'; id: string } | null> = [];

  // ── Tracked State ──────────────────────────────────────────────────
  private currentHp: number = PLAYER_INITIAL_STATS.maxHp;
  private maxHp: number = PLAYER_INITIAL_STATS.maxHp;
  private currentMp: number = PLAYER_INITIAL_STATS.maxMp;
  private maxMp: number = PLAYER_INITIAL_STATS.maxMp;
  private playerLevel: number = 1;
  private currentExp: number = 0;
  private expToNext: number = 50;
  private killCount: number = 0;
  private weaponName: string = 'Iron Sword';
  private weaponType: string = 'melee';
  private magazine: number = 0;
  private maxMagazine: number = 0;
  private isReloading: boolean = false;
  private gamePaused: boolean = false;
  private totalScore: number = 0;
  private bossDefeated: boolean = false;
  private killsByType: Map<string, number> = new Map();
  private tabOpen: boolean = false;

  constructor() {
    super({ key: SceneKey.UI });
  }

  // ═══════════════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════════════

  create(): void {
    // Reset tracked state on create (since Phaser reuses scene instances)
    this.currentHp = PLAYER_INITIAL_STATS.maxHp;
    this.maxHp = PLAYER_INITIAL_STATS.maxHp;
    this.currentMp = PLAYER_INITIAL_STATS.maxMp;
    this.maxMp = PLAYER_INITIAL_STATS.maxMp;
    this.playerLevel = 1;
    this.currentExp = 0;
    this.expToNext = 50;
    this.killCount = 0;
    this.totalScore = 0;
    this.bossDefeated = false;
    this.killsByType = new Map();
    this.tabOpen = false;
    this.isReloading = false;
    this.gamePaused = false;

    // Disable default browser context menu for right click tooltips
    this.input.mouse!.disableContextMenu();

    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;

    // ── Row positions (top-left HUD) ─────────────────────────────
    const row0 = M;                                    // LEVEL text
    const row1 = row0 + 22;                            // HP bar
    const row2 = row1 + BAR_H + ROW_GAP;               // MP bar
    const row3 = row2 + BAR_H + ROW_GAP;               // EXP bar

    // ── LEVEL ────────────────────────────────────────────────────
    this.levelText = this.add.text(LABEL_COL, row0, 'LEVEL 1', {
      fontSize: '12px', color: '#4fc3f7', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 1,
    }).setDepth(10);

    // ── HP ───────────────────────────────────────────────────────
    this.hpLabel = this.add.text(LABEL_COL, row1, 'HP:', {
      fontSize: '12px', color: '#e74c3c', fontStyle: 'bold',
    }).setDepth(10);

    this.hpBarBg = this.add.graphics().setDepth(8);
    this.hpBarFill = this.add.graphics().setDepth(9);

    this.hpValueText = this.add.text(BAR_COL + BAR_W / 2, row1 + BAR_H / 2, '', {
      fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(10);

    // ── MP ───────────────────────────────────────────────────────
    this.mpLabel = this.add.text(LABEL_COL, row2, 'MP:', {
      fontSize: '12px', color: '#3498db', fontStyle: 'bold',
    }).setDepth(10);

    this.mpBarBg = this.add.graphics().setDepth(8);
    this.mpBarFill = this.add.graphics().setDepth(9);

    this.mpValueText = this.add.text(BAR_COL + BAR_W / 2, row2 + BAR_H / 2, '', {
      fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(10);

    // ── EXP ──────────────────────────────────────────────────────
    this.expLabel = this.add.text(LABEL_COL, row3, 'EXP:', {
      fontSize: '12px', color: '#f39c12', fontStyle: 'bold',
    }).setDepth(10);

    this.expBarBg = this.add.graphics().setDepth(8);
    this.expBarFill = this.add.graphics().setDepth(9);

    this.expPctText = this.add.text(BAR_COL + BAR_W + 6, row3 + BAR_H / 2, '0%', {
      fontSize: '10px', color: '#f39c12', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(10);

    // ── Kill Counter (top-right) ─────────────────────────────────
    // ── Weapon Info (left, below skills) ─────────────────────────
    this.weaponNameText = this.add.text(M, 172, '⚔ Iron Sword', {
      fontSize: '14px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0, 0).setDepth(10);

    this.ammoText = this.add.text(M, 190, '', {
      fontSize: '12px', color: '#aaaaaa',
    }).setOrigin(0, 0).setDepth(10);

    this.reloadText = this.add.text(M, 206, '', {
      fontSize: '11px', color: '#ff6666', fontStyle: 'bold',
    }).setOrigin(0, 0).setDepth(10);

    // ── Skill Slots (below EXP bar) ──────────────────────────────
    this.createSkillSlots();

    // ── Inventory (hidden) ───────────────────────────────────────
    this.createInventoryPanel(camW, camH);

    // ── Settings / Guide Panel (hidden) ──────────────────────────
    this.createSettingsPanel(camW, camH);

    // ── Pause Menu (hidden) ──────────────────────────────────────
    this.createPauseMenu(camW, camH);

    // ── Game Over Panel (hidden) ─────────────────────────────────
    this.createGameOverPanel(camW, camH);

    // ── Target HUD Frame & Tooltip UI (hidden) ───────────────────
    this.createTargetFrame(camW, camH);
    this.createTooltip(camW, camH);

    // ── TAB Stats Panel (hidden) ─────────────────────────────────
    this.createTabPanel(camW, camH);

    // ── Boss HP Bar (hidden) ─────────────────────────────────────
    this.createBossBar(camW, camH);

    // ── Document Viewer (hidden) ─────────────────────────────────
    this.createDocumentViewer(camW, camH);

    // ── Portfolio Viewer (hidden) ────────────────────────────────
    this.createPortfolioViewer(camW, camH);

    // ── Initial draw ─────────────────────────────────────────────
    this.drawAllBars();
    this.updateWeaponDisplay();

    // ── Sync with settings store accessibility ──
    const settings = useSettingsStore.getState();
    this.cameras.main.setZoom(settings.uiScale);
    this.cameras.main.setOrigin(0, 0);
    this.applyFontSizeScale(settings.fontScale);

    this.settingsUnsubscribe = useSettingsStore.subscribe((state) => {
      if (!this.cameras || !this.cameras.main) return;
      this.cameras.main.setZoom(state.uiScale);
      this.cameras.main.setOrigin(0, 0);
      this.applyFontSizeScale(state.fontScale);
    });

    // ── EventBus ─────────────────────────────────────────────────
    EventBus.on(GameEvent.HP_CHANGED, this.onHpChanged, this);
    EventBus.on(GameEvent.MP_CHANGED, this.onMpChanged, this);
    EventBus.on(GameEvent.LEVEL_UP, this.onLevelUp, this);
    EventBus.on(GameEvent.EXP_CHANGED, this.onExpChanged, this);
    EventBus.on(GameEvent.ENEMY_KILLED, this.onEnemyKilled, this);
    EventBus.on(GameEvent.WEAPON_SWITCHED, this.onWeaponSwitched, this);
    EventBus.on(GameEvent.AMMO_CHANGED, this.onAmmoChanged, this);
    EventBus.on(GameEvent.RELOAD_START, this.onReloadStart, this);
    EventBus.on(GameEvent.RELOAD_END, this.onReloadEnd, this);
    EventBus.on(GameEvent.SKILL_COOLDOWN, this.onSkillCooldown, this);
    EventBus.on(GameEvent.INVENTORY_TOGGLE, this.onInventoryToggle, this);
    EventBus.on(GameEvent.GAME_PAUSED, this.onGamePaused, this);
    EventBus.on(GameEvent.GAME_RESUMED, this.onGameResumed, this);
    EventBus.on(GameEvent.PLAYER_DIED, this.onPlayerDied, this);
    EventBus.on(GameEvent.SCORE_CHANGED, this.onScoreChanged, this);
    EventBus.on(GameEvent.TAB_TOGGLE, this.onTabToggle, this);
    EventBus.on(GameEvent.BOSS_HP_CHANGED, this.onBossHpChanged, this);
    EventBus.on('enemy-selected', this.onEnemySelected, this);
    EventBus.on('inventory-ready', this.onInventoryReady, this);
    EventBus.on(GameEvent.DOCUMENT_COLLECTED, this.onDocumentCollected, this);
    EventBus.on(GameEvent.DOCUMENTS_MERGED, this.onDocumentsMerged, this);
    EventBus.on('kills-changed', this.onKillsChanged, this);
    EventBus.on(GameEvent.CHEST_OPENED, this.onChestOpened, this);
    EventBus.on('open-settings', this.onOpenSettings, this);
    EventBus.on('close-settings', this.onCloseSettings, this);
    EventBus.on('tutorial-active', this.onTutorialActive, this);
    EventBus.on('boss-slain', this.onBossSlain, this);

    // Create Achievements Panel
    this.createAchievementsPanel(camW, camH);

    // Sync achievements from GameScene if loaded
    const gameScene = this.scene.get(SceneKey.GAME) as any;
    if (gameScene) {
      if (gameScene.loadedAchievements) {
        this.setAchievementsState(gameScene.loadedAchievements);
      }
      if (gameScene.inventorySystem) {
        this.inventoryRef = gameScene.inventorySystem;
      }
    }

    this.events.on('shutdown', () => {
      if (this.settingsUnsubscribe) {
        this.settingsUnsubscribe();
      }
      EventBus.off(GameEvent.HP_CHANGED, this.onHpChanged, this);
      EventBus.off(GameEvent.MP_CHANGED, this.onMpChanged, this);
      EventBus.off(GameEvent.LEVEL_UP, this.onLevelUp, this);
      EventBus.off(GameEvent.EXP_CHANGED, this.onExpChanged, this);
      EventBus.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled, this);
      EventBus.off(GameEvent.WEAPON_SWITCHED, this.onWeaponSwitched, this);
      EventBus.off(GameEvent.AMMO_CHANGED, this.onAmmoChanged, this);
      EventBus.off(GameEvent.RELOAD_START, this.onReloadStart, this);
      EventBus.off(GameEvent.RELOAD_END, this.onReloadEnd, this);
      EventBus.off(GameEvent.SKILL_COOLDOWN, this.onSkillCooldown, this);
      EventBus.off(GameEvent.INVENTORY_TOGGLE, this.onInventoryToggle, this);
      EventBus.off(GameEvent.GAME_PAUSED, this.onGamePaused, this);
      EventBus.off(GameEvent.GAME_RESUMED, this.onGameResumed, this);
      EventBus.off(GameEvent.PLAYER_DIED, this.onPlayerDied, this);
      EventBus.off(GameEvent.SCORE_CHANGED, this.onScoreChanged, this);
      EventBus.off(GameEvent.TAB_TOGGLE, this.onTabToggle, this);
      EventBus.off(GameEvent.BOSS_HP_CHANGED, this.onBossHpChanged, this);
      EventBus.off('enemy-selected', this.onEnemySelected, this);
      EventBus.off('inventory-ready', this.onInventoryReady, this);
      EventBus.off(GameEvent.DOCUMENT_COLLECTED, this.onDocumentCollected, this);
      EventBus.off(GameEvent.DOCUMENTS_MERGED, this.onDocumentsMerged, this);
      EventBus.off('kills-changed', this.onKillsChanged, this);
      EventBus.off(GameEvent.CHEST_OPENED, this.onChestOpened, this);
      EventBus.off('open-settings', this.onOpenSettings, this);
      EventBus.off('close-settings', this.onCloseSettings, this);
      EventBus.off('tutorial-active', this.onTutorialActive, this);
      EventBus.off('boss-slain', this.onBossSlain, this);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // SKILL slots
  // ═══════════════════════════════════════════════════════════════════

  private createSkillSlots(): void {
    const slotSize = 44;
    const gap = 8;
    const startX = M;
    const y = SKILL_Y;

    // ── Slot 0: Weapon slot ──────────────────────────────────────
    const weaponBg = this.add.graphics().setDepth(8);
    weaponBg.fillStyle(0x111122, 0.85);
    weaponBg.fillRoundedRect(startX, y, slotSize, slotSize, 4);
    weaponBg.lineStyle(2, 0xffd700, 0.75); // Gold border for weapon
    weaponBg.strokeRoundedRect(startX, y, slotSize, slotSize, 4);

    this.weaponSlotIconText = this.add.text(startX + slotSize / 2, y + slotSize / 2, '⚔', {
      fontSize: '22px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.add.text(startX + slotSize / 2, y + slotSize + 8, 'VŨ KHÍ', {
      fontSize: '8px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    // Weapon slot interactive zone
    const weaponZone = this.add.zone(startX + slotSize / 2, y + slotSize / 2, slotSize, slotSize)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    weaponZone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      this.showTooltip('weapon', pointer.x, pointer.y);
    });
    weaponZone.on('pointerout', () => {
      this.hideTooltip();
    });

    // ── Slots 1-4: Action/Skill slots (Q, E, Shift, F) ──────────
    const skillsConfig = [
      { id: 'fireball', key: 'Q', label: 'CẦU LỬA', color: 0xff6600 },
      { id: 'slow', key: 'E', label: 'BĂNG PHONG', color: 0x00bfff },
      { id: 'dash', key: 'Shift', label: 'LƯỚT', color: 0xaaaaaa },
      { id: 'ultimate', key: 'F', label: 'BỘC PHÁ', color: 0x9900ff },
    ];

    skillsConfig.forEach((item, index) => {
      const x = startX + (index + 1) * (slotSize + gap);

      const bg = this.add.graphics().setDepth(8);
      bg.fillStyle(0x111122, 0.85);
      bg.fillRoundedRect(x, y, slotSize, slotSize, 4);
      bg.lineStyle(2, item.color, 0.6);
      bg.strokeRoundedRect(x, y, slotSize, slotSize, 4);

      const overlay = this.add.graphics().setDepth(9);

      const keyFontSize = item.key === 'Shift' ? '12px' : '16px';
      const label = this.add.text(x + slotSize / 2, y + (item.key === 'Shift' ? 14 : 12), item.key, {
        fontSize: keyFontSize, color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);

      const cdText = this.add.text(x + slotSize / 2, y + slotSize - 10, '', {
        fontSize: '10px', color: '#ffaaaa',
      }).setOrigin(0.5).setDepth(10);

      const nameText = this.add.text(x + slotSize / 2, y + slotSize + 8, item.label, {
        fontSize: '8px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);

      this.skillSlots.set(item.id, { bg, overlay, label, cdText, nameText });

      // Skill slot interactive zone
      const skillZone = this.add.zone(x + slotSize / 2, y + slotSize / 2, slotSize, slotSize)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      skillZone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        this.showTooltip(item.id, pointer.x, pointer.y);
      });
      skillZone.on('pointerout', () => {
        this.hideTooltip();
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // INVENTORY
  // ═══════════════════════════════════════════════════════════════════

  private inventoryItemTexts: Phaser.GameObjects.Text[] = [];
  private inventoryGoldText!: Phaser.GameObjects.Text;
  private inventoryDescText!: Phaser.GameObjects.Text;

  private createInventoryPanel(camW: number, camH: number): void {
    const panelW = 340;
    const panelH = 420;
    const px = (camW - panelW) / 2;
    const py = (camH - panelH) / 2;

    this.inventoryContainer = this.add.container(0, 0).setDepth(50).setVisible(false);

    // Background panel
    const panel = this.add.graphics();
    panel.fillStyle(0x0a0a1a, 0.94);
    panel.fillRoundedRect(px, py, panelW, panelH, 8);
    panel.lineStyle(2, 0x4fc3f7, 0.5);
    panel.strokeRoundedRect(px, py, panelW, panelH, 8);

    // Title
    const title = this.add.text(camW / 2, py + 18, '📦 TRANG BỊ & VẬT PHẨM', {
      fontSize: '16px', color: '#4fc3f7', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Gold display
    this.inventoryGoldText = this.add.text(px + panelW - 20, py + 18, '💰 0', {
      fontSize: '13px', color: '#f1c40f', fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    // Divider
    const div1 = this.add.graphics();
    div1.lineStyle(1, 0x4fc3f7, 0.2);
    div1.lineBetween(px + 15, py + 38, px + panelW - 15, py + 38);

    // Item list area — create 16 text slots for dynamic content
    this.inventoryItemTexts = [];
    for (let i = 0; i < 16; i++) {
      const t = this.add.text(px + 18, py + 44 + i * 19, '', {
        fontSize: '13px', color: '#cccccc',
      });
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.onInventoryItemHover(i));
      t.on('pointerout', () => this.onInventoryItemOut(i));
      t.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onInventoryItemClick(i, pointer));
      this.inventoryItemTexts.push(t);
    }

    // Description area at bottom
    const div2 = this.add.graphics();
    div2.lineStyle(1, 0x4fc3f7, 0.2);
    div2.lineBetween(px + 15, py + panelH - 70, px + panelW - 15, py + panelH - 70);

    this.inventoryDescText = this.add.text(px + 18, py + panelH - 60, '', {
      fontSize: '11px', color: '#999999', wordWrap: { width: panelW - 36 },
      lineSpacing: 3,
    });

    // Close hint
    const closeHint = this.add.text(camW / 2, py + panelH - 16, 'Nhấn B để đóng', {
      fontSize: '10px', color: '#666666',
    }).setOrigin(0.5);

    this.inventoryContainer.add([
      panel, title, this.inventoryGoldText, div1, div2,
      ...this.inventoryItemTexts, this.inventoryDescText, closeHint,
    ]);
  }

  /** Refresh inventory display from InventorySystem data */
  private refreshInventoryDisplay(): void {
    if (!this.inventoryRef) return;

    const slots = this.inventoryRef.getSlots();

    // Gold
    this.inventoryGoldText.setText(`💰 ${this.inventoryRef.getGold()}`);

    // Clear line metadata
    this.inventoryLineData = Array(16).fill(null);

    let line = 0;

    // Section: Equipment
    if (line < this.inventoryItemTexts.length) {
      this.inventoryItemTexts[line].setText('── TRANG BỊ ──');
      this.inventoryItemTexts[line].setColor('#4fc3f7');
      this.inventoryItemTexts[line].setFontStyle('bold');
      this.inventoryItemTexts[line].setData('origColor', '#4fc3f7');
      this.inventoryLineData[line] = { type: 'section', id: '' };
      line++;
    }

    // Equipped weapon
    const equippedId = this.inventoryRef.getEquippedWeapon();
    for (const slot of slots) {
      if (line >= this.inventoryItemTexts.length) break;
      const def = ITEM_REGISTRY[slot.itemId];
      if (!def || def.category !== 'weapon') continue;

      const equipped = slot.itemId === equippedId ? ' [E]' : '';
      const color = RARITY_COLORS[def.rarity] || '#cccccc';
      this.inventoryItemTexts[line].setText(`  ${def.icon} ${def.name}${equipped}`);
      this.inventoryItemTexts[line].setColor(color);
      this.inventoryItemTexts[line].setFontStyle('normal');
      this.inventoryItemTexts[line].setData('origColor', color);
      this.inventoryLineData[line] = { type: 'weapon', id: slot.itemId };
      line++;
    }

    // Section: Consumables
    const consumables = slots.filter(s => {
      const d = ITEM_REGISTRY[s.itemId];
      return d && d.category === 'consumable';
    });

    if (consumables.length > 0 && line < this.inventoryItemTexts.length) {
      this.inventoryItemTexts[line].setText('── TIÊU HAO ──');
      this.inventoryItemTexts[line].setColor('#4fc3f7');
      this.inventoryItemTexts[line].setFontStyle('bold');
      this.inventoryItemTexts[line].setData('origColor', '#4fc3f7');
      this.inventoryLineData[line] = { type: 'section', id: '' };
      line++;

      for (const slot of consumables) {
        if (line >= this.inventoryItemTexts.length) break;
        const def = ITEM_REGISTRY[slot.itemId];
        this.inventoryItemTexts[line].setText(`  ${def.icon} ${def.name} x${slot.quantity}`);
        this.inventoryItemTexts[line].setColor(RARITY_COLORS[def.rarity] || '#cccccc');
        this.inventoryItemTexts[line].setFontStyle('normal');
        this.inventoryItemTexts[line].setData('origColor', RARITY_COLORS[def.rarity] || '#cccccc');
        this.inventoryLineData[line] = { type: 'consumable', id: slot.itemId };
        line++;
      }
    }

    // Section: Collected Documents
    const collectedDocs = this.inventoryRef.getCollectedDocuments();
    if (collectedDocs.length > 0 && line < this.inventoryItemTexts.length) {
      this.inventoryItemTexts[line].setText('── TÀI LIỆU ──');
      this.inventoryItemTexts[line].setColor('#ffd700'); // gold
      this.inventoryItemTexts[line].setFontStyle('bold');
      this.inventoryItemTexts[line].setData('origColor', '#ffd700');
      this.inventoryLineData[line] = { type: 'section', id: '' };
      line++;

      for (const docId of collectedDocs) {
        if (line >= this.inventoryItemTexts.length) break;
        const def = DOCUMENT_REGISTRY[docId];
        if (def) {
          const iconStr = docId === 'merged_doc' ? '' : `${def.icon} `;
          this.inventoryItemTexts[line].setText(`  ${iconStr}${def.title}`);
          this.inventoryItemTexts[line].setColor('#f1c40f'); // light gold
          this.inventoryItemTexts[line].setFontStyle('normal');
          this.inventoryItemTexts[line].setData('origColor', '#f1c40f');
          this.inventoryLineData[line] = { type: 'document', id: docId };
          line++;
        }
      }
    }

    // Clear remaining lines
    for (let i = line; i < this.inventoryItemTexts.length; i++) {
      this.inventoryItemTexts[i].setText('');
      this.inventoryItemTexts[i].setData('origColor', '#cccccc');
    }

    // Default description: show first item or document description
    let firstDescribed = false;
    for (let i = 0; i < 16; i++) {
      const data = this.inventoryLineData[i];
      if (data && data.type !== 'section') {
        if (data.type === 'document') {
          const docDef = DOCUMENT_REGISTRY[data.id];
          if (docDef) {
            this.inventoryDescText.setText(`${docDef.title}\n📜 Click chuột PHẢI để đọc.`);
            this.inventoryDescText.setColor('#f1c40f');
            firstDescribed = true;
          }
        } else {
          const itemDef = ITEM_REGISTRY[data.id];
          if (itemDef) {
            this.inventoryDescText.setText(itemDef.description);
            this.inventoryDescText.setColor('#999999');
            firstDescribed = true;
          }
        }
        break;
      }
    }

    if (!firstDescribed) {
      this.inventoryDescText.setText('Túi đồ trống.');
      this.inventoryDescText.setColor('#999999');
    }
  }

  private onInventoryItemHover(index: number): void {
    const data = this.inventoryLineData[index];
    if (!data || data.type === 'section') return;

    // Highlight text
    const text = this.inventoryItemTexts[index];
    text.setColor('#ffffff');

    // Update description text
    if (data.type === 'document') {
      const docDef = DOCUMENT_REGISTRY[data.id];
      if (docDef) {
        this.inventoryDescText.setText(`${docDef.title}\n📜 Click chuột PHẢI để đọc.`);
        this.inventoryDescText.setColor('#f1c40f'); // gold
      }
    } else {
      const itemDef = ITEM_REGISTRY[data.id];
      if (itemDef) {
        this.inventoryDescText.setText(itemDef.description);
        this.inventoryDescText.setColor('#999999');
      }
    }
  }

  private onInventoryItemOut(index: number): void {
    const data = this.inventoryLineData[index];
    if (!data || data.type === 'section') return;

    // Restore text color
    const text = this.inventoryItemTexts[index];
    const origColor = text.getData('origColor') || '#cccccc';
    text.setColor(origColor);
  }

  private onInventoryItemClick(index: number, pointer?: Phaser.Input.Pointer): void {
    const data = this.inventoryLineData[index];
    if (!data || data.type === 'section') return;

    if (data.type === 'document') {
      if (pointer && pointer.button !== 2) {
        this.inventoryDescText.setText(`${DOCUMENT_REGISTRY[data.id].title}\n👉 Click chuột PHẢI để đọc.`);
        return;
      }

      AudioManager.getInstance().playSFX('ui-click');

      // Close inventory panel
      EventBus.emit(GameEvent.INVENTORY_TOGGLE, { open: false });
      
      const docDef = DOCUMENT_REGISTRY[data.id];
      if (docDef) {
        // Pause the game scene
        EventBus.emit(GameEvent.GAME_PAUSED);
        
        // Open document viewer
        this.openDocumentViewer(docDef);
      }
    } else if (data.type === 'weapon') {
      if (pointer && pointer.button !== 0) return; // Left click only

      const gameScene = this.scene.get(SceneKey.GAME) as any;
      if (gameScene && gameScene.player && this.inventoryRef) {
        const weaponSystem = gameScene.player.weaponSystem;
        const targetWeaponId = data.id === 'iron_sword' ? 'basic_sword' : 'basic_gun';
        if (weaponSystem.equip(targetWeaponId, gameScene.player.level)) {
          this.inventoryRef.setEquippedWeapon(data.id);
          AudioManager.getInstance().playSFX('ui-click');
          this.refreshInventoryDisplay();
        }
      }
    } else if (data.type === 'consumable') {
      if (pointer && pointer.button !== 0) return; // Left click only

      const gameScene = this.scene.get(SceneKey.GAME) as any;
      if (gameScene && gameScene.player && this.inventoryRef) {
        const player = gameScene.player;
        if (data.id === 'health_potion') {
          if (player.currentHp >= player.maxHp) {
            this.inventoryDescText.setText('Máu đã đầy!');
            this.inventoryDescText.setColor('#e74c3c');
            return;
          }
          player.healHp(30);
          this.inventoryRef.removeItem('health_potion', 1);
          AudioManager.getInstance().playSFX('item-pickup');
          this.refreshInventoryDisplay();
        } else if (data.id === 'mana_potion') {
          if (player.stats.currentMp >= player.stats.maxMp) {
            this.inventoryDescText.setText('Mana đã đầy!');
            this.inventoryDescText.setColor('#3498db');
            return;
          }
          player.restoreMp(20);
          this.inventoryRef.removeItem('mana_potion', 1);
          AudioManager.getInstance().playSFX('item-pickup');
          this.refreshInventoryDisplay();
        }
      }
    }
  }

  private createDocumentViewer(camW: number, camH: number): void {
    // Backdrop overlay — darker for scroll focus
    this.documentOverlay = this.add.graphics().setDepth(90);
    this.documentOverlay.fillStyle(0x000000, 0.7);
    this.documentOverlay.fillRect(0, 0, camW, camH);
    this.documentOverlay.setVisible(false);

    // ── Scroll dimensions ────────────────────────────────────────
    const scrollW = 480;
    const scrollH = 520;
    const sx = (camW - scrollW) / 2;
    const sy = (camH - scrollH) / 2;
    const rollerH = 18;    // wooden roller height
    const edgeInset = 12;  // torn parchment edge inset

    this.documentViewerContainer = this.add.container(0, 0).setDepth(91).setVisible(false);

    const scrollGfx = this.add.graphics();

    // ── Shadow behind scroll ─────────────────────────────────────
    scrollGfx.fillStyle(0x000000, 0.35);
    scrollGfx.fillRoundedRect(sx + 6, sy + 6, scrollW, scrollH, 4);

    // ── Main parchment body ──────────────────────────────────────
    // Base parchment color
    scrollGfx.fillStyle(0xf5e6c8, 1);
    scrollGfx.fillRect(sx, sy + rollerH, scrollW, scrollH - rollerH * 2);

    // Aged parchment texture — darker patches
    scrollGfx.fillStyle(0xe8d5a8, 0.5);
    scrollGfx.fillRect(sx + 20, sy + 40, 120, 80);
    scrollGfx.fillRect(sx + scrollW - 140, sy + 120, 100, 60);
    scrollGfx.fillRect(sx + 60, sy + scrollH - 160, 140, 70);
    scrollGfx.fillRect(sx + scrollW - 100, sy + scrollH - 120, 80, 50);

    // Lighter highlights
    scrollGfx.fillStyle(0xfcf3e0, 0.4);
    scrollGfx.fillRect(sx + 40, sy + 80, 80, 40);
    scrollGfx.fillRect(sx + scrollW - 120, sy + 60, 60, 30);
    scrollGfx.fillRect(sx + 100, sy + scrollH - 200, 100, 50);

    // ── Torn/aged edges ──────────────────────────────────────────
    scrollGfx.fillStyle(0xe0c99a, 1);
    // Left edge irregularities
    for (let ey = sy + rollerH; ey < sy + scrollH - rollerH; ey += 12) {
      const indent = Math.sin(ey * 0.15) * 3 + 2;
      scrollGfx.fillRect(sx, ey, indent, 12);
    }
    // Right edge irregularities
    for (let ey = sy + rollerH; ey < sy + scrollH - rollerH; ey += 14) {
      const indent = Math.cos(ey * 0.12) * 3 + 2;
      scrollGfx.fillRect(sx + scrollW - indent, ey, indent, 14);
    }

    // ── Parchment inner border (ink line) ────────────────────────
    scrollGfx.lineStyle(1, 0xc4a265, 0.4);
    scrollGfx.strokeRect(
      sx + edgeInset, sy + rollerH + edgeInset,
      scrollW - edgeInset * 2, scrollH - rollerH * 2 - edgeInset * 2
    );
    // Double line inner border
    scrollGfx.lineStyle(1, 0xc4a265, 0.2);
    scrollGfx.strokeRect(
      sx + edgeInset + 3, sy + rollerH + edgeInset + 3,
      scrollW - edgeInset * 2 - 6, scrollH - rollerH * 2 - edgeInset * 2 - 6
    );

    // ── Top wooden roller ────────────────────────────────────────
    // Roller body
    scrollGfx.fillStyle(0x6d4c2a, 1);
    scrollGfx.fillRect(sx - 10, sy, scrollW + 20, rollerH);
    // Wood grain highlight
    scrollGfx.fillStyle(0x8b6914, 0.4);
    scrollGfx.fillRect(sx - 10, sy + 3, scrollW + 20, 3);
    scrollGfx.fillRect(sx - 10, sy + 9, scrollW + 20, 2);
    // Top highlight
    scrollGfx.fillStyle(0x9b7b3a, 0.6);
    scrollGfx.fillRect(sx - 10, sy, scrollW + 20, 2);
    // Bottom shadow
    scrollGfx.fillStyle(0x3e2a14, 0.5);
    scrollGfx.fillRect(sx - 10, sy + rollerH - 2, scrollW + 20, 2);
    // Roller end caps (decorative knobs)
    scrollGfx.fillStyle(0x5a3a1a, 1);
    scrollGfx.fillCircle(sx - 6, sy + rollerH / 2, 8);
    scrollGfx.fillCircle(sx + scrollW + 6, sy + rollerH / 2, 8);
    scrollGfx.fillStyle(0xdaa520, 1);
    scrollGfx.fillCircle(sx - 6, sy + rollerH / 2, 4);
    scrollGfx.fillCircle(sx + scrollW + 6, sy + rollerH / 2, 4);

    // ── Bottom wooden roller ─────────────────────────────────────
    const bottomY = sy + scrollH - rollerH;
    scrollGfx.fillStyle(0x6d4c2a, 1);
    scrollGfx.fillRect(sx - 10, bottomY, scrollW + 20, rollerH);
    scrollGfx.fillStyle(0x8b6914, 0.4);
    scrollGfx.fillRect(sx - 10, bottomY + 3, scrollW + 20, 3);
    scrollGfx.fillRect(sx - 10, bottomY + 9, scrollW + 20, 2);
    scrollGfx.fillStyle(0x9b7b3a, 0.6);
    scrollGfx.fillRect(sx - 10, bottomY, scrollW + 20, 2);
    scrollGfx.fillStyle(0x3e2a14, 0.5);
    scrollGfx.fillRect(sx - 10, bottomY + rollerH - 2, scrollW + 20, 2);
    // End caps
    scrollGfx.fillStyle(0x5a3a1a, 1);
    scrollGfx.fillCircle(sx - 6, bottomY + rollerH / 2, 8);
    scrollGfx.fillCircle(sx + scrollW + 6, bottomY + rollerH / 2, 8);
    scrollGfx.fillStyle(0xdaa520, 1);
    scrollGfx.fillCircle(sx - 6, bottomY + rollerH / 2, 4);
    scrollGfx.fillCircle(sx + scrollW + 6, bottomY + rollerH / 2, 4);

    // ── Wax seal decoration (bottom-right) ───────────────────────
    const sealX = sx + scrollW - 55;
    const sealY = bottomY - 32;
    // Ribbon
    scrollGfx.fillStyle(0x8b0000, 0.7);
    scrollGfx.fillRect(sealX - 2, sealY - 16, 4, 18);
    scrollGfx.fillRect(sealX + 6, sealY - 12, 4, 14);
    // Seal body
    scrollGfx.fillStyle(0xb22222, 1);
    scrollGfx.fillCircle(sealX + 4, sealY, 12);
    // Seal highlight
    scrollGfx.fillStyle(0xd44444, 0.6);
    scrollGfx.fillCircle(sealX + 2, sealY - 3, 5);
    // Seal emblem (star shape)
    scrollGfx.fillStyle(0x8b0000, 1);
    scrollGfx.fillRect(sealX + 1, sealY - 4, 6, 8);
    scrollGfx.fillRect(sealX - 1, sealY - 1, 10, 3);

    // ── Corner decorations (ink flourishes) ──────────────────────
    const cornerColor = 0x8b6914;
    const ci = edgeInset + 4;
    // Top-left corner
    scrollGfx.lineStyle(2, cornerColor, 0.5);
    scrollGfx.lineBetween(sx + ci, sy + rollerH + ci, sx + ci + 25, sy + rollerH + ci);
    scrollGfx.lineBetween(sx + ci, sy + rollerH + ci, sx + ci, sy + rollerH + ci + 25);
    // Top-right corner
    scrollGfx.lineBetween(sx + scrollW - ci, sy + rollerH + ci, sx + scrollW - ci - 25, sy + rollerH + ci);
    scrollGfx.lineBetween(sx + scrollW - ci, sy + rollerH + ci, sx + scrollW - ci, sy + rollerH + ci + 25);
    // Bottom-left corner
    scrollGfx.lineBetween(sx + ci, bottomY - ci, sx + ci + 25, bottomY - ci);
    scrollGfx.lineBetween(sx + ci, bottomY - ci, sx + ci, bottomY - ci - 25);

    // ── Title text (ink calligraphy style) ───────────────────────
    this.docTitleText = this.add.text(camW / 2, sy + rollerH + 32, '', {
      fontSize: '16px',
      color: '#3e2723',
      fontStyle: 'bold',
      fontFamily: 'Cinzel, Georgia, serif',
      stroke: '#c4a265',
      strokeThickness: 0.5,
    }).setOrigin(0.5);

    // ── Decorative divider under title ───────────────────────────
    const dividerGfx = this.add.graphics();
    const divY = sy + rollerH + 52;
    dividerGfx.lineStyle(1, 0x8b6914, 0.5);
    dividerGfx.lineBetween(sx + 60, divY, sx + scrollW - 60, divY);
    // Small diamond at center
    dividerGfx.fillStyle(0x8b6914, 0.6);
    dividerGfx.fillRect(camW / 2 - 3, divY - 3, 6, 6);

    // ── Document icon ────────────────────────────────────────────
    this.docIconText = this.add.text(camW / 2, sy + rollerH + 75, '📜', {
      fontSize: '24px',
    }).setOrigin(0.5);

    // ── Document content text (ink on parchment) ─────────────────
    this.docContentText = this.add.text(camW / 2, sy + rollerH + 125, '', {
      fontSize: '13px',
      color: '#3e2723',          // dark brown ink
      fontFamily: 'Georgia, "Times New Roman", serif',
      wordWrap: { width: scrollW - 70 },
      align: 'left',
      lineSpacing: 7,
    }).setOrigin(0.5, 0);

    // Content mask
    this.maskRect = this.add.rectangle(
      camW / 2,
      sy + rollerH + edgeInset + (scrollH - rollerH * 2 - edgeInset * 2) / 2,
      scrollW - 40,
      scrollH - rollerH * 2 - edgeInset * 2,
      0xffffff
    );
    this.children.remove(this.maskRect);
    this.docContentText.enableFilters();
    this.docContentText.filters!.external.addMask(this.maskRect);

    // ── Close instruction (ink style) ────────────────────────────
    const btnClose = this.add.text(camW / 2, bottomY - 18, '〔 NHẤN G HOẶC CLICK ĐỂ ĐÓNG 〕', {
      fontSize: '10px',
      color: '#8b6914',
      fontStyle: 'italic',
      fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);

    btnClose.setInteractive({ useHandCursor: true });
    btnClose.on('pointerover', () => btnClose.setColor('#3e2723'));
    btnClose.on('pointerout', () => btnClose.setColor('#8b6914'));
    btnClose.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('ui-click');
      this.closeDocumentViewer();
    });

    this.documentViewerContainer.add([
      scrollGfx, dividerGfx,
      this.docTitleText, this.docIconText, this.docContentText, btnClose,
    ]);

    // Listen to keyboard keys G and ESC to close
    this.keyG = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this.keyEsc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.input.keyboard!.on('keydown-G', () => {
      if (this.documentViewerContainer.visible) {
        this.closeDocumentViewer();
      }
    });

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.documentViewerContainer.visible) {
        this.closeDocumentViewer();
      }
    });

    // Listen to mouse wheel events for scrolling the document text
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any[], deltaX: number, deltaY: number, deltaZ: number) => {
      if (this.documentViewerContainer.visible) {
        this.scrollDocumentText(deltaY * 0.4);
      }
    });
  }

  private scrollDocumentText(amount: number): void {
    const viewportH = this.docViewportH;
    const textH = this.docContentText.height;
    
    if (textH <= viewportH) {
      this.docContentText.y = this.docContentInitialY;
      return;
    }

    const minY = this.docContentInitialY - (textH - viewportH);
    const maxY = this.docContentInitialY;

    let newY = this.docContentText.y - amount;
    if (newY < minY) newY = minY;
    if (newY > maxY) newY = maxY;

    this.docContentText.y = newY;
  }

  private openDocumentViewer(def: { id?: string; title: string; content: string; icon: string }): void {
    this.docTitleText.setText(def.title.toUpperCase());
    this.docContentText.setText(def.content);
    this.docIconText.setText(def.icon || '📜');

    const scrollW = 480;
    const scrollH = 520;
    const rollerH = 18;
    const edgeInset = 12;
    const sy = (this.cameras.main.height - scrollH) / 2;
    const sx = (this.cameras.main.width - scrollW) / 2;
    const camCX = this.cameras.main.width / 2;

    if (def.id === 'merged_doc') {
      this.docIconText.setVisible(false);
      this.docContentText.setOrigin(0.5, 0);
      this.docContentText.setPosition(camCX, sy + rollerH + 60);
      this.docContentText.setAlign('left');
      this.docContentText.setFontSize('12px');
      this.docContentText.setColor('#3e2723');
      this.docContentText.setLineSpacing(7);
      this.docContentText.setWordWrapWidth(scrollW - 80);
      this.docContentInitialY = sy + rollerH + 60;
      this.docViewportH = scrollH - rollerH * 2 - edgeInset * 2 - 30;
    } else {
      this.docIconText.setVisible(true);
      this.docIconText.setPosition(camCX, sy + rollerH + 72);
      this.docContentText.setOrigin(0.5, 0);
      this.docContentText.setPosition(camCX, sy + rollerH + 110);
      this.docContentText.setAlign('left');
      this.docContentText.setFontSize('13px');
      this.docContentText.setColor('#3e2723');
      this.docContentText.setLineSpacing(7);
      this.docContentText.setWordWrapWidth(scrollW - 80);
      this.docContentInitialY = sy + rollerH + 110;
      this.docViewportH = scrollH - rollerH * 2 - edgeInset * 2 - 80;
    }

    // Dynamically update mask shape bounds
    if (this.maskRect) {
      const maskY = def.id === 'merged_doc'
        ? sy + rollerH + edgeInset
        : sy + rollerH + edgeInset;
      const maskH = scrollH - rollerH * 2 - edgeInset * 2;
      this.maskRect.setPosition(camCX, maskY + maskH / 2);
      this.maskRect.setSize(scrollW - 40, maskH);
    }

    // Reset position when opened
    this.docContentText.y = this.docContentInitialY;

    this.documentOverlay.setVisible(true);
    this.documentViewerContainer.setVisible(true);
  }

  private closeDocumentViewer(): void {
    this.documentOverlay.setVisible(false);
    this.documentViewerContainer.setVisible(false);

    // Emit event to resume GameScene physics and update
    EventBus.emit(GameEvent.GAME_RESUMED);
  }

  private onDocumentCollected(data: { id: string; title: string; content: string; icon: string }): void {
    if (!this.sys.isActive()) return;
    this.openDocumentViewer(data);

    if (this.inventoryRef && this.inventoryRef.getCollectedDocuments().length === 3) {
      this.unlockAchievement('collect_all_pages');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PAUSE MENU
  // ═══════════════════════════════════════════════════════════════════

  private createPauseMenu(camW: number, camH: number): void {
    // Dark overlay covering entire screen
    this.pauseOverlay = this.add.graphics().setDepth(90);
    this.pauseOverlay.fillStyle(0x000000, 0.6);
    this.pauseOverlay.fillRect(0, 0, camW, camH);
    this.pauseOverlay.setVisible(false);

    // Panel
    const panelW = 280;
    const panelH = 290;
    const px = (camW - panelW) / 2;
    const py = (camH - panelH) / 2;

    this.pausePanel = this.add.graphics().setDepth(91);
    this.pausePanel.fillStyle(0x0d0d1a, 0.95);
    this.pausePanel.fillRoundedRect(px, py, panelW, panelH, 10);
    this.pausePanel.lineStyle(2, 0x4fc3f7, 0.4);
    this.pausePanel.strokeRoundedRect(px, py, panelW, panelH, 10);
    // Inner glow line
    this.pausePanel.lineStyle(1, 0x4fc3f7, 0.15);
    this.pausePanel.strokeRoundedRect(px + 4, py + 4, panelW - 8, panelH - 8, 8);
    this.pausePanel.setVisible(false);

    // Title
    this.pauseTitle = this.add.text(camW / 2, py + 30, 'TẠM DỪNG', {
      fontSize: '22px', color: '#4fc3f7', fontStyle: 'bold',
      fontFamily: 'Cinzel, serif',
    }).setOrigin(0.5).setDepth(92).setVisible(false);

    // Buttons
    const btnStyle = {
      fontSize: '16px', color: '#cccccc', fontStyle: 'bold',
      backgroundColor: '#1a1a2e', padding: { x: 10, y: 10 },
      fixedWidth: 200, align: 'center',
    };

    // Button 1: Resume
    this.btnResume = this.add.text(camW / 2, py + 80, 'Tiếp tục', btnStyle)
      .setOrigin(0.5).setDepth(92).setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.btnResume.setColor('#4fc3f7'))
      .on('pointerout', () => this.btnResume.setColor('#cccccc'))
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('ui-click');
        EventBus.emit(GameEvent.GAME_RESUMED);
      });

    // Button 2: Settings (Opens settingsContainer)
    this.btnSettings = this.add.text(camW / 2, py + 130, 'Cài đặt', btnStyle)
      .setOrigin(0.5).setDepth(92).setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.btnSettings.setColor('#4fc3f7'))
      .on('pointerout', () => this.btnSettings.setColor('#cccccc'))
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('ui-click');
        this.showPauseMenuElements(false);
        EventBus.emit('open-settings');
      });

    // Button 3: Achievements (Opens achievementsContainer)
    this.btnAchievements = this.add.text(camW / 2, py + 180, 'Thành tích', btnStyle)
      .setOrigin(0.5).setDepth(92).setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.btnAchievements.setColor('#4fc3f7'))
      .on('pointerout', () => this.btnAchievements.setColor('#cccccc'))
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('ui-click');
        this.showPauseMenuElements(false);
        this.populateAchievementsList();
        this.achievementsContainer.setVisible(true);
      });

    // Button 4: Exit
    this.btnExit = this.add.text(camW / 2, py + 230, 'Thoát ra Menu', {
      ...btnStyle, color: '#ff6666',
    })
      .setOrigin(0.5).setDepth(92).setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.btnExit.setColor('#ff3333'))
      .on('pointerout', () => this.btnExit.setColor('#ff6666'))
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('ui-click');
        this.exitToMenu();
      });
  }

  // ═══════════════════════════════════════════════════════════════════
  // SETTINGS PANEL
  // ═══════════════════════════════════════════════════════════════════

  private createSettingsPanel(camW: number, camH: number): void {
    const panelW = 400;
    const panelH = 450;
    const px = (camW - panelW) / 2;
    const py = (camH - panelH) / 2;

    this.settingsContainer = this.add.container(0, 0).setDepth(95).setVisible(false);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0c0c14, 0.98);
    bg.fillRoundedRect(px, py, panelW, panelH, 10);
    bg.lineStyle(2, 0x4fc3f7, 0.5);
    bg.strokeRoundedRect(px, py, panelW, panelH, 10);

    // Title
    const title = this.add.text(camW / 2, py + 25, 'CÀI ĐẶT & HƯỚNG DẪN', {
      fontSize: '20px', color: '#4fc3f7', fontStyle: 'bold',
      fontFamily: 'Cinzel, serif',
    }).setOrigin(0.5);

    // ── BGM Option ────────────────────────────────────────────────
    const bgmLabel = this.add.text(px + 30, py + 70, 'NHẠC NỀN:', {
      fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    const bgmBtnStyle = {
      fontSize: '12px', fontStyle: 'bold', padding: { x: 14, y: 6 },
    };

    this.btnBgmOn = this.add.text(px + 160, py + 70, 'BẬT', bgmBtnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('ui-click');
        this.isMusicOn = true;
        this.sound.mute = false;
        EventBus.emit('audio-mute', false);
        this.updateSettingsButtonsVisuals();
      });

    this.btnBgmOff = this.add.text(px + 220, py + 70, 'TẮT', bgmBtnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('ui-click');
        this.isMusicOn = false;
        this.sound.mute = true;
        EventBus.emit('audio-mute', true);
        this.updateSettingsButtonsVisuals();
      });

    // ── Font Size Option ──────────────────────────────────────────
    const fontLabel = this.add.text(px + 30, py + 115, 'CỠ CHỮ UI:', {
      fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    const fontBtnStyle = {
      fontSize: '11px', fontStyle: 'bold', padding: { x: 10, y: 6 },
    };

    this.btnFontLow = this.add.text(px + 150, py + 115, 'NHỎ', fontBtnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('ui-click');
        this.applyFontSizeSetting('low');
        this.updateSettingsButtonsVisuals();
      });

    this.btnFontMedium = this.add.text(px + 215, py + 115, 'VỪA', fontBtnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('ui-click');
        this.applyFontSizeSetting('medium');
        this.updateSettingsButtonsVisuals();
      });

    this.btnFontHigh = this.add.text(px + 285, py + 115, 'LỚN', fontBtnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('ui-click');
        this.applyFontSizeSetting('high');
        this.updateSettingsButtonsVisuals();
      });

    // Divider Line
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x4fc3f7, 0.2);
    divider.lineBetween(px + 20, py + 145, px + panelW - 20, py + 145);

    // ── Controls Guide Section ────────────────────────────────────
    const guideHeader = this.add.text(camW / 2, py + 165, 'HƯỚNG DẪN ĐIỀU KHIỂN', {
      fontSize: '13px', color: '#4fc3f7', fontStyle: 'bold',
    }).setOrigin(0.5);

    const controls = [
      { key: 'A / D', action: 'Di chuyển trái / phải' },
      { key: 'Space', action: 'Nhảy' },
      { key: 'Shift', action: 'Lướt nhanh (Dash)' },
      { key: 'Chuột trái', action: 'Đánh cận chiến / Bắn súng' },
      { key: 'Phím 1 / 2', action: 'Đổi vũ khí (Kiếm / Súng)' },
      { key: 'Phím R', action: 'Nạp đạn (khi dùng súng)' },
      { key: 'Phím Q / E / F', action: 'Cầu lửa / Chậm / Bộc phá' },
      { key: 'Phím B', action: 'Mở / Đóng rương đồ (Inventory)' },
      { key: 'TAB', action: 'Bảng thống kê nhân vật' },
      { key: 'Phím G', action: 'Tương tác (mở rương kho báu)' },
    ];

    const textElements: Phaser.GameObjects.Text[] = [];
    controls.forEach((item, index) => {
      const lineY = py + 195 + index * 20;

      const keyTxt = this.add.text(px + 35, lineY, item.key, {
        fontSize: '11px', color: '#ffd700', fontStyle: 'bold',
      }).setOrigin(0, 0.5);

      const actionTxt = this.add.text(px + 145, lineY, `: ${item.action}`, {
        fontSize: '11px', color: '#cccccc',
      }).setOrigin(0, 0.5);

      textElements.push(keyTxt, actionTxt);
    });

    // Back Button
    const btnBack = this.add.text(camW / 2, py + panelH - 30, 'Quay lại', {
      fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#1a1a2e', padding: { x: 20, y: 8 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => btnBack.setColor('#4fc3f7'))
      .on('pointerout', () => btnBack.setColor('#ffffff'))
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('ui-click');
        this.settingsContainer.setVisible(false);
        this.showPauseMenuElements(true);
      });

    this.settingsContainer.add([
      bg, title, bgmLabel, this.btnBgmOn, this.btnBgmOff,
      fontLabel, this.btnFontLow, this.btnFontMedium, this.btnFontHigh,
      divider, guideHeader, ...textElements, btnBack
    ]);

    // Apply initial button highlights
    this.updateSettingsButtonsVisuals();
  }

  private updateSettingsButtonsVisuals(): void {
    const activeStyle = { backgroundColor: '#4fc3f7', color: '#0a0a0f' };
    const inactiveStyle = { backgroundColor: '#1a1a2e', color: '#cccccc' };

    if (this.isMusicOn) {
      this.btnBgmOn.setStyle(activeStyle);
      this.btnBgmOff.setStyle(inactiveStyle);
    } else {
      this.btnBgmOn.setStyle(inactiveStyle);
      this.btnBgmOff.setStyle(activeStyle);
    }

    this.btnFontLow.setStyle(this.fontSizeSetting === 'low' ? activeStyle : inactiveStyle);
    this.btnFontMedium.setStyle(this.fontSizeSetting === 'medium' ? activeStyle : inactiveStyle);
    this.btnFontHigh.setStyle(this.fontSizeSetting === 'high' ? activeStyle : inactiveStyle);
  }

  private applyFontSizeSetting(size: 'low' | 'medium' | 'high'): void {
    this.fontSizeSetting = size;

    let labelSize = '12px';
    let valSize = '10px';
    let titleSize = '12px';
    let killSize = '13px';
    let weaponSize = '14px';
    let ammoSize = '12px';
    let reloadSize = '11px';

    if (size === 'low') {
      labelSize = '10px';
      valSize = '8px';
      titleSize = '10px';
      killSize = '11px';
      weaponSize = '12px';
      ammoSize = '10px';
      reloadSize = '9px';
    } else if (size === 'high') {
      labelSize = '15px';
      valSize = '12px';
      titleSize = '15px';
      killSize = '16px';
      weaponSize = '17px';
      ammoSize = '15px';
      reloadSize = '13px';
    }

    this.levelText.setFontSize(titleSize);
    this.hpLabel.setFontSize(labelSize);
    this.mpLabel.setFontSize(labelSize);
    this.expLabel.setFontSize(labelSize);
    this.hpValueText.setFontSize(valSize);
    this.mpValueText.setFontSize(valSize);
    this.expPctText.setFontSize(valSize);
    this.weaponNameText.setFontSize(weaponSize);
    this.ammoText.setFontSize(ammoSize);
    this.reloadText.setFontSize(reloadSize);
  }

  private showPauseMenuElements(show: boolean): void {
    this.pausePanel.setVisible(show);
    this.pauseTitle.setVisible(show);
    this.btnResume.setVisible(show);
    this.btnSettings.setVisible(show);
    this.btnAchievements.setVisible(show);
    this.btnExit.setVisible(show);
  }

  private showPauseMenu(): void {
    this.gamePaused = true;
    this.pauseOverlay.setVisible(true);
    this.showPauseMenuElements(true);
  }

  private hidePauseMenu(): void {
    this.gamePaused = false;
    this.pauseOverlay.setVisible(false);
    this.showPauseMenuElements(false);
    this.settingsContainer.setVisible(false);
    this.achievementsContainer.setVisible(false);
  }

  // ═══════════════════════════════════════════════════════════════════
  // TOOLTIP & TARGET FRAME HUD
  // ═══════════════════════════════════════════════════════════════════

  private createTargetFrame(camW: number, _camH: number): void {
    // Position at top-right, replacing kills/score space
    const x = camW - 126;
    const y = 16;

    this.targetFrameContainer = this.add.container(x, y).setDepth(20).setVisible(false);

    // Background panel
    const bg = this.add.graphics();
    bg.fillStyle(0x0c0c14, 0.88);
    bg.fillRoundedRect(-110, 0, 220, 70, 6);
    bg.lineStyle(1.5, 0xe74c3c, 0.6);
    bg.strokeRoundedRect(-110, 0, 220, 70, 6);

    // Category badge (Small / Elite / Boss)
    this.targetCategoryText = this.add.text(-100, 4, 'SMALL', {
      fontSize: '8px', color: '#888888', fontStyle: 'bold',
    });

    // Name text
    this.targetNameText = this.add.text(0, 4, 'Target Name', {
      fontSize: '12px', color: '#ffaaaa', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // Stats text (HP and Shield values)
    this.targetHpText = this.add.text(0, 20, 'HP: 100/100', {
      fontSize: '9px', color: '#ffffff',
    }).setOrigin(0.5, 0);

    // HP Bar Background
    this.targetHpBarBg = this.add.graphics();
    this.targetHpBarBg.fillStyle(0x000000, 0.65);
    this.targetHpBarBg.fillRoundedRect(-95, 34, 190, 8, 2);

    // HP Bar Fill
    this.targetHpBarFill = this.add.graphics();

    // Shield Bar Background
    this.targetShieldBarBg = this.add.graphics();
    this.targetShieldBarBg.fillStyle(0x000000, 0.65);
    this.targetShieldBarBg.fillRoundedRect(-95, 48, 190, 8, 2);

    // Shield Bar Fill
    this.targetShieldBarFill = this.add.graphics();

    this.targetFrameContainer.add([
      bg,
      this.targetCategoryText,
      this.targetNameText,
      this.targetHpText,
      this.targetHpBarBg,
      this.targetHpBarFill,
      this.targetShieldBarBg,
      this.targetShieldBarFill,
    ]);
  }

  private updateTargetFrame(): void {
    if (!this.selectedEnemy) return;

    const enemy = this.selectedEnemy;
    const maxHp = enemy.maxHp;
    const currentHp = enemy.currentHp;
    const maxShield = enemy.maxShield ?? 0;
    const shield = enemy.shield ?? 0;

    this.targetNameText.setText(enemy.config?.name || 'Enemy');

    // Category badge with color
    const category = enemy.config?.category || 'small';
    const catColors: Record<string, string> = {
      small: '#888888', elite: '#f39c12', boss: '#e74c3c',
    };
    const catLabels: Record<string, string> = {
      small: 'SMALL', elite: '⭐ ELITE', boss: '💀 BOSS',
    };
    this.targetCategoryText.setText(catLabels[category] || category.toUpperCase());
    this.targetCategoryText.setColor(catColors[category] || '#888888');

    // Draw target HP bar
    this.targetHpBarFill.clear();
    const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    if (hpPct > 0) {
      const hpColor = hpPct > 0.5 ? 0xe74c3c : hpPct > 0.25 ? 0xf39c12 : 0xff4444;
      this.targetHpBarFill.fillStyle(hpColor, 1);
      this.targetHpBarFill.fillRoundedRect(-95, 34, 190 * hpPct, 8, 2);
    }

    // Draw target Shield bar
    this.targetShieldBarBg.setVisible(maxShield > 0);
    this.targetShieldBarFill.clear();
    if (maxShield > 0) {
      const shieldPct = Math.max(0, Math.min(1, shield / maxShield));
      if (shieldPct > 0) {
        this.targetShieldBarFill.fillStyle(0xf1c40f, 1);
        this.targetShieldBarFill.fillRoundedRect(-95, 48, 190 * shieldPct, 8, 2);
      }
      this.targetHpText.setText(`HP: ${Math.ceil(currentHp)}/${maxHp} | SHIELD: ${Math.ceil(shield)}/${maxShield}`);
    } else {
      this.targetHpText.setText(`HP: ${Math.ceil(currentHp)}/${maxHp}`);
    }
  }

  private createTooltip(camW: number, camH: number): void {
    this.tooltipContainer = this.add.container(0, 0).setDepth(200).setVisible(false);

    this.tooltipBg = this.add.graphics();
    // Glassmorphic dark background
    this.tooltipBg.fillStyle(0x0c0c14, 0.95);
    this.tooltipBg.fillRoundedRect(0, 0, 200, 110, 6);
    this.tooltipBg.lineStyle(1.5, 0x4fc3f7, 0.6);
    this.tooltipBg.strokeRoundedRect(0, 0, 200, 110, 6);

    this.tooltipText = this.add.text(10, 10, '', {
      fontSize: '11px',
      color: '#ffffff',
      lineSpacing: 4,
      fontFamily: 'Arial',
    });

    this.tooltipContainer.add([this.tooltipBg, this.tooltipText]);

    // Hide tooltip on clicking anywhere on the screen
    this.input.on('pointerdown', () => {
      this.hideTooltip();
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // TAB STATS PANEL
  // ═══════════════════════════════════════════════════════════════════

  private createTabPanel(camW: number, camH: number): void {
    const panelW = 280;
    const panelH = 340;
    const px = (camW - panelW) / 2;
    const py = (camH - panelH) / 2;

    this.tabPanelContainer = this.add.container(0, 0).setDepth(55).setVisible(false);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.92);
    bg.fillRoundedRect(px, py, panelW, panelH, 8);
    bg.lineStyle(2, 0xe74c3c, 0.5);
    bg.strokeRoundedRect(px, py, panelW, panelH, 8);

    // Title
    const title = this.add.text(camW / 2, py + 18, 'THỐNG KÊ NHÂN VẬT', {
      fontSize: '16px', color: '#e74c3c', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Stats text lines
    const lineHeight = 22;
    const startY = py + 48;
    const labels = [
      '── CHỈ SỐ ──',
      '',   // Level
      '',   // HP
      '',   // MP
      '',   // ATK
      '',   // DEF
      '',   // separator
      '── CHIẾN ĐẤU ──',
      '',   // Total Kills
      '',   // Slime kills
      '',   // Bat kills
      '',   // Goblin kills
      '',   // Score
    ];

    this.tabStatsTexts = [];
    for (let i = 0; i < labels.length; i++) {
      const isHeader = labels[i].startsWith('──');
      const t = this.add.text(px + 20, startY + i * lineHeight, labels[i], {
        fontSize: isHeader ? '11px' : '13px',
        color: isHeader ? '#888888' : '#cccccc',
        fontStyle: isHeader ? 'bold' : 'normal',
      });
      this.tabStatsTexts.push(t);
    }

    this.tabPanelContainer.add([bg, title, ...this.tabStatsTexts]);
  }

  private updateTabPanel(): void {
    const t = this.tabStatsTexts;
    if (t.length < 13) return;

    // Stats section
    t[0].setText('── CHỈ SỐ ──');
    t[1].setText(`  Cấp độ: ${this.playerLevel}`);
    t[2].setText(`  Máu (HP): ${this.currentHp} / ${this.maxHp}`);
    t[3].setText(`  Năng lượng (MP): ${this.currentMp} / ${this.maxMp}`);
    t[4].setText(`  Sát thương (ATK): ${10 + (this.playerLevel - 1) * 2}`);
    t[5].setText(`  Phòng thủ (DEF): ${3 + (this.playerLevel - 1) * 1}`);
    t[6].setText('');

    // Combat section
    t[7].setText('── CHIẾN ĐẤU ──');
    t[8].setText(`  Tổng hạ gục: ${this.killCount}`);
    t[9].setText(`  Slime: ${this.killsByType.get('slime') ?? 0}`);
    t[10].setText(`  Dơi: ${this.killsByType.get('bat') ?? 0}`);
    t[11].setText(`  Goblin: ${this.killsByType.get('goblin') ?? 0}`);
    t[12].setText(`  Điểm số: ${this.totalScore}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BOSS HP BAR
  // ═══════════════════════════════════════════════════════════════════

  private createBossBar(camW: number, camH: number): void {
    const barW = 400;
    const barH = 16;
    const x = camW / 2;
    const y = 38;

    this.bossBarContainer = this.add.container(0, 0).setDepth(30).setVisible(false);

    // Background panel
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.9);
    bg.fillRoundedRect(x - barW / 2 - 10, y - 28, barW + 20, 55, 6);
    bg.lineStyle(2, 0xe74c3c, 0.7);
    bg.strokeRoundedRect(x - barW / 2 - 10, y - 28, barW + 20, 55, 6);

    // Boss name
    this.bossNameText = this.add.text(x, y - 18, '💀 BOSS', {
      fontSize: '14px', color: '#e74c3c', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    // HP bar background
    this.bossHpBarBg = this.add.graphics();
    this.bossHpBarBg.fillStyle(0x1a1a2e, 1);
    this.bossHpBarBg.fillRoundedRect(x - barW / 2, y, barW, barH, 4);

    // HP bar fill
    this.bossHpBarFill = this.add.graphics();

    // HP percentage text
    this.bossHpPctText = this.add.text(x, y + barH / 2, '100%', {
      fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    this.bossBarContainer.add([
      bg, this.bossNameText, this.bossHpBarBg, this.bossHpBarFill, this.bossHpPctText,
    ]);
  }

  private updateBossBar(name: string, current: number, max: number): void {
    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;
    const barW = 400;
    const y = 38;
    const x = camW / 2;

    this.bossNameText.setText(`💀 ${name}`);

    const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;

    this.bossHpBarFill.clear();
    if (pct > 0) {
      const color = pct > 0.5 ? 0xe74c3c : pct > 0.25 ? 0xf39c12 : 0xff2222;
      this.bossHpBarFill.fillStyle(color, 1);
      this.bossHpBarFill.fillRoundedRect(x - barW / 2, y, barW * pct, 16, 4);
    }

    this.bossHpPctText.setText(`${Math.ceil(pct * 100)}%`);
  }

  private onBossHpChanged(data: { name: string; current: number; max: number; visible: boolean }): void {
    if (!this.sys.isActive()) return;
    this.bossBarContainer.setVisible(data.visible);
    if (data.visible) {
      this.updateBossBar(data.name, data.current, data.max);
    }
  }

  private showTooltip(id: string, x: number, y: number): void {
    let content = '';

    if (id === 'weapon') {
      if (this.weaponType === 'melee') {
        content = `⚔ KIẾM SẮT\n` +
                  `• Sát thương: 15 (+ ATK scaling)\n` +
                  `• Mana tiêu hao: 0\n` +
                  `• Phạm vi: Cận chiến\n` +
                  `• Loại: Đa mục tiêu`;
      } else {
        content = `🔫 SÚNG LỤC\n` +
                  `• Sát thương: 10\n` +
                  `• Đạn: 10 viên / băng\n` +
                  `• Chí mạng: 40%\n` +
                  `• Phạm vi: Tầm xa (500px)\n` +
                  `• Loại: Đơn mục tiêu`;
      }
    } else if (id === 'fireball') {
      if (this.weaponType === 'melee') {
        content = `🔥 CẦU LỬA (Q)\n` +
                  `• Sát thương: 40\n` +
                  `• Mana tiêu hao: 15 MP\n` +
                  `• Phạm vi: Tầm xa\n` +
                  `• Loại: Đơn mục tiêu`;
      } else {
        content = `⚡ CHOÁNG (Q)\n` +
                  `• Sát thương: 20\n` +
                  `• Mana tiêu hao: 10 MP\n` +
                  `• Choáng: 1.5 giây\n` +
                  `• Phạm vi: AoE (120px)\n` +
                  `• Loại: Đa mục tiêu`;
      }
    } else if (id === 'slow') {
      content = `❄ BĂNG PHONG (E)\n` +
                `• Sát thương: 0 (Làm chậm 70%)\n` +
                `• Mana tiêu hao: 20 MP\n` +
                `• Phạm vi: AoE (180px)\n` +
                `• Loại: Đa mục tiêu`;
    } else if (id === 'dash') {
      const dashCd = this.weaponType === 'melee' ? '1.0' : '0.75';
      content = `⚡ LƯỚT NHANH (Shift)\n` +
                `• Sát thương: 0 (Bất tử khi lướt)\n` +
                `• Mana tiêu hao: 0 MP\n` +
                `• Hồi chiêu: ${dashCd}s\n` +
                `• Loại: Bản thân`;
    } else if (id === 'ultimate') {
      content = `💥 BỘC PHÁ (F)\n` +
                `• Sát thương: 80\n` +
                `• Mana tiêu hao: 40 MP\n` +
                `• Phạm vi: AoE (250px)\n` +
                `• Loại: Đa mục tiêu`;
    }

    this.tooltipText.setText(content);

    // Adjust position to stay on screen
    const tooltipWidth = 200;
    const tooltipHeight = 110;
    let tx = x + 15;
    let ty = y - tooltipHeight - 15;

    if (tx + tooltipWidth > this.cameras.main.width) {
      tx = x - tooltipWidth - 15;
    }
    if (ty < 0) {
      ty = y + 15;
    }

    this.tooltipContainer.setPosition(tx, ty);
    this.tooltipContainer.setVisible(true);
  }

  private hideTooltip(): void {
    this.tooltipContainer.setVisible(false);
  }

  update(): void {
    if (this.selectedEnemy) {
      if (!this.selectedEnemy.active || this.selectedEnemy.isDead) {
        this.selectedEnemy = null;
        this.targetFrameContainer.setVisible(false);
      } else {
        this.updateTargetFrame();
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BAR DRAWING & HUD EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  private onHpChanged(data: { current: number; max: number }): void {
    if (!this.sys.isActive()) return;
    this.currentHp = data.current;
    this.maxHp = data.max;
    this.drawAllBars();
  }

  private onMpChanged(data: { current: number; max: number }): void {
    if (!this.sys.isActive()) return;
    this.currentMp = data.current;
    this.maxMp = data.max;
    this.drawAllBars();
  }

  private onLevelUp(data: { level: number }): void {
    if (!this.sys.isActive()) return;
    this.playerLevel = data.level;
    this.levelText.setText(`LEVEL ${this.playerLevel}`);
    this.cameras.main.flash(300, 255, 215, 0, false);

    if (this.playerLevel >= 5) this.unlockAchievement('reach_lvl_5');
    if (this.playerLevel >= 10) this.unlockAchievement('reach_lvl_10');
  }

  private onExpChanged(data: { current: number; toNext: number }): void {
    if (!this.sys.isActive()) return;
    this.currentExp = data.current;
    this.expToNext = data.toNext;
    this.drawAllBars();
  }

  private onEnemyKilled(data: { type?: string }): void {
    if (!this.sys.isActive()) return;
    this.killCount++;

    // Track per-type kills
    if (data.type) {
      const prev = this.killsByType.get(data.type) ?? 0;
      this.killsByType.set(data.type, prev + 1);
    }

    // Update TAB panel if open
    if (this.tabOpen) this.updateTabPanel();

    if (this.killCount >= 1) this.unlockAchievement('first_kill');
    if (this.killCount >= 25) this.unlockAchievement('kill_25');
    if (this.killCount >= 50) this.unlockAchievement('kill_50');
    if (this.killCount >= 100) this.unlockAchievement('kill_100');

    if (data && data.type === 'ancient_knight') {
      this.unlockAchievement('first_boss_kill');
    }
  }

  private onScoreChanged(data: { score: number }): void {
    if (!this.sys.isActive()) return;
    this.totalScore = data.score;
  }

  private onTabToggle(): void {
    if (!this.sys.isActive()) return;
    this.tabOpen = !this.tabOpen;
    if (this.tabOpen) {
      this.updateTabPanel();
    }
    this.tabPanelContainer.setVisible(this.tabOpen);
  }

  private onWeaponSwitched(data: { name: string; type: string }): void {
    if (!this.sys.isActive()) return;
    this.weaponName = data.name;
    this.weaponType = data.type;
    this.updateWeaponDisplay();

    // Update Q skill label based on weapon type
    const fireballSlot = this.skillSlots.get('fireball');
    if (fireballSlot) {
      fireballSlot.nameText.setText(data.type === 'melee' ? 'CẦU LỬA' : 'CHOÁNG');
    }
  }

  private onAmmoChanged(data: { magazine: number; maxMagazine: number }): void {
    if (!this.sys.isActive()) return;
    this.magazine = data.magazine;
    this.maxMagazine = data.maxMagazine;
    this.updateWeaponDisplay();
  }

  private onReloadStart(): void {
    if (!this.sys.isActive()) return;
    this.isReloading = true;
    this.updateWeaponDisplay();
  }

  private onReloadEnd(): void {
    if (!this.sys.isActive()) return;
    this.isReloading = false;
    this.updateWeaponDisplay();
  }

  private onSkillCooldown(data: { id: string; progress: number; remainingMs: number }): void {
    if (!this.sys.isActive()) return;
    this.updateSkillSlot(data.id, data.progress, data.remainingMs);
  }

  private onInventoryToggle(data: { open: boolean }): void {
    if (!this.sys.isActive()) return;
    if (data.open) {
      this.refreshInventoryDisplay();
    }
    this.inventoryContainer.setVisible(data.open);
  }

  private onInventoryReady(inventory: InventorySystem): void {
    this.inventoryRef = inventory;
  }

  private onGamePaused(data?: { manual?: boolean }): void {
    if (!this.sys.isActive()) return;
    if (this.documentViewerContainer && this.documentViewerContainer.visible) {
      return;
    }
    if (this.isReactTutorialOpen) {
      return;
    }
    // Only show pause menu if the pause is manual (ESC key)
    if (!data || data.manual !== true) {
      return;
    }
    this.showPauseMenu();
  }

  private onGameResumed(): void {
    if (!this.sys.isActive()) return;
    this.hidePauseMenu();
  }

  private onOpenSettings(): void {
    this.isReactSettingsOpen = true;
  }

  private onCloseSettings(): void {
    this.isReactSettingsOpen = false;
    if (!this.sys.isActive()) return;
    if (this.gamePaused) {
      this.showPauseMenuElements(true);
    }
  }

  private onTutorialActive(active: boolean): void {
    this.isReactTutorialOpen = active;
  }

  public isSettingsOpen(): boolean {
    return this.isReactSettingsOpen || (this.settingsContainer && this.settingsContainer.visible);
  }

  public isAchievementsOpen(): boolean {
    return this.achievementsContainer && this.achievementsContainer.visible;
  }

  public isDocumentViewerOpen(): boolean {
    return this.documentViewerContainer && this.documentViewerContainer.visible;
  }

  public isPortfolioOpen(): boolean {
    return this.portfolioViewerContainer && this.portfolioViewerContainer.visible;
  }

  public isInventoryOpen(): boolean {
    return this.inventoryContainer && this.inventoryContainer.visible;
  }

  public isTutorialOpen(): boolean {
    return this.isReactTutorialOpen;
  }

  public hasActiveOverlay(): boolean {
    return this.isSettingsOpen() ||
           this.isAchievementsOpen() ||
           this.isDocumentViewerOpen() ||
           this.isPortfolioOpen() ||
           this.isInventoryOpen() ||
           this.isTutorialOpen() ||
           this.tabOpen;
  }

  private updateSkillSlot(skillId: string, progress: number, remainingMs: number): void {
    // stun_blast shares the Q slot with fireball
    const resolvedId = skillId === 'stun_blast' ? 'fireball' : skillId;
    const slot = this.skillSlots.get(resolvedId);
    if (!slot || !slot.cdText || !slot.cdText.active) return;

    const slotSize = 44;
    const gap = 8;
    const skillsIdsList = ['fireball', 'slow', 'dash', 'ultimate'];
    const idx = skillsIdsList.indexOf(resolvedId);
    if (idx < 0) return;

    const x = M + (idx + 1) * (slotSize + gap);
    const y = SKILL_Y;

    slot.overlay.clear();
    if (progress < 1) {
      const coverH = slotSize * (1 - progress);
      slot.overlay.fillStyle(0x000000, 0.6);
      slot.overlay.fillRoundedRect(x, y, slotSize, coverH, { tl: 4, tr: 4, bl: 0, br: 0 });
      slot.cdText.setText(`${Math.ceil(remainingMs / 1000)}s`);
      slot.label.setAlpha(0.4);
    } else {
      slot.cdText.setText('');
      slot.label.setAlpha(1);
    }
  }

  private updateWeaponDisplay(): void {
    const icon = this.weaponType === 'melee' ? '⚔' : '🔫';
    this.weaponNameText.setText(`${icon} ${this.weaponName}`);
    if (this.weaponSlotIconText) {
      this.weaponSlotIconText.setText(icon);
    }

    if (this.weaponType === 'ranged') {
      this.ammoText.setText(`Ammo: ${this.magazine} / ${this.maxMagazine}`);
      this.reloadText.setText(this.isReloading ? 'RELOADING...' : (this.magazine === 0 ? 'Press R to reload' : ''));
    } else {
      this.ammoText.setText('');
      this.reloadText.setText('');
    }
  }

  private drawAllBars(): void {
    const row1 = M + 22;
    const row2 = row1 + BAR_H + ROW_GAP;
    const row3 = row2 + BAR_H + ROW_GAP;

    this.drawBar(this.hpBarBg, this.hpBarFill, BAR_COL, row1,
      this.currentHp, this.maxHp, 0xe74c3c);
    this.hpValueText.setText(`${Math.ceil(this.currentHp)} / ${this.maxHp}`);

    this.drawBar(this.mpBarBg, this.mpBarFill, BAR_COL, row2,
      this.currentMp, this.maxMp, 0x3498db);
    this.mpValueText.setText(`${Math.ceil(this.currentMp)} / ${this.maxMp}`);

    this.drawBar(this.expBarBg, this.expBarFill, BAR_COL, row3,
      this.currentExp, this.expToNext, 0xf39c12);
    const pct = this.expToNext > 0
      ? Math.floor((this.currentExp / this.expToNext) * 100)
      : 0;
    this.expPctText.setText(`${pct}%`);
  }

  private drawBar(
    bgGfx: Phaser.GameObjects.Graphics,
    fillGfx: Phaser.GameObjects.Graphics,
    x: number, y: number,
    current: number, max: number,
    fillColor: number,
  ): void {
    const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;

    bgGfx.clear();
    bgGfx.fillStyle(0x000000, 0.7);
    bgGfx.fillRoundedRect(x, y, BAR_W, BAR_H, BAR_R);
    bgGfx.lineStyle(1, 0xffffff, 0.12);
    bgGfx.strokeRoundedRect(x, y, BAR_W, BAR_H, BAR_R);

    fillGfx.clear();
    const fw = (BAR_W - 4) * pct;
    if (fw > 0) {
      fillGfx.fillStyle(fillColor, 1);
      fillGfx.fillRoundedRect(x + 2, y + 2, fw, BAR_H - 4, BAR_R - 1);
      fillGfx.fillStyle(0xffffff, 0.18);
      fillGfx.fillRoundedRect(x + 2, y + 2, fw, (BAR_H - 4) / 2, { tl: BAR_R - 1, tr: BAR_R - 1, bl: 0, br: 0 });
      fillGfx.fillStyle(fillColor, 0.25);
      fillGfx.fillRoundedRect(x, y - 1, fw + 4, BAR_H + 2, BAR_R);
    }
  }

  private createGameOverPanel(camW: number, camH: number): void {
    const panelW = 340;
    const panelH = 320;
    const px = (camW - panelW) / 2;
    const py = (camH - panelH) / 2;

    this.gameOverContainer = this.add.container(0, 0).setDepth(100).setVisible(false);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x3a0505, 0.75);
    overlay.fillRect(0, 0, camW, camH);

    const panel = this.add.graphics();
    panel.fillStyle(0x0d0202, 0.95);
    panel.fillRoundedRect(px, py, panelW, panelH, 10);
    panel.lineStyle(2, 0xe74c3c, 0.5);
    panel.strokeRoundedRect(px, py, panelW, panelH, 10);

    const title = this.add.text(camW / 2, py + 25, 'BẠN ĐÃ TỬ TRẬN', {
      fontSize: '18px', color: '#e74c3c', fontStyle: 'bold',
      fontFamily: 'Press Start 2P, VT323, monospace',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    const namePromptText = this.add.text(camW / 2, py + 60, 'NHẬP TÊN CỦA BẠN:', {
      fontSize: '12px', color: '#4fc3f7', fontStyle: 'bold',
      fontFamily: 'Press Start 2P, VT323, monospace',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5);

    // Name input background
    const inputBg = this.add.graphics();
    inputBg.fillStyle(0x1a1a2e, 0.9);
    inputBg.fillRect(px + 20, py + 85, panelW - 40, 35);
    inputBg.lineStyle(2, 0x4fc3f7, 0.8);
    inputBg.strokeRect(px + 20, py + 85, panelW - 40, 35);

    const inputText = this.add.text(px + 30, py + 102, '', {
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
      fontFamily: 'Press Start 2P, VT323, monospace',
    }).setOrigin(0, 0.5);

    const defaultName = LeaderboardHelper.getLastName();
    inputText.setText(defaultName);
    let isEditing = true;

    // Cursor indicator
    const cursorText = this.add.text(px + 30 + inputText.width + 4, py + 102, '▌', {
      fontSize: '14px', color: '#4fc3f7',
      fontFamily: 'Press Start 2P, VT323, monospace',
    }).setOrigin(0, 0.5);

    // Blinking cursor animation
    this.tweens.add({
      targets: cursorText,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // Instruction text
    const instructionText = this.add.text(camW / 2, py + 140, 'NHẤN ENTER ĐỂ XÁC NHẬN', {
      fontSize: '10px', color: '#888888', fontStyle: 'bold',
      fontFamily: 'Press Start 2P, VT323, monospace',
    }).setOrigin(0.5);

    const btnStyle = {
      fontSize: '13px', color: '#cccccc', fontStyle: 'bold',
      backgroundColor: '#2a0a0a', padding: { x: 12, y: 8 },
      fixedWidth: 140, align: 'center',
      fontFamily: 'Press Start 2P, VT323, monospace',
    };

    const btnConfirm = this.add.text(camW / 2, py + 200, 'XÁC NHẬN', btnStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => btnConfirm.setColor('#ffffff').setStyle({ backgroundColor: '#4fc3f7' }))
      .on('pointerout', () => btnConfirm.setColor('#cccccc').setStyle({ backgroundColor: '#2a0a0a' }))
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('ui-click');
        isEditing = false;
        const playerName = inputText.text.trim() || defaultName;
        LeaderboardHelper.saveEntry(playerName, this.playerLevel, this.totalScore, this.killCount);
        this.gameOverContainer.setVisible(false);
        
        // If boss is defeated, continue playing; otherwise, exit to menu
        if (!this.bossDefeated) {
          // Exit to main menu
          this.exitToMenu();
        }
      });

    // Keyboard input handling
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (!isEditing) return;
      
      if (event.key === 'Enter') {
        isEditing = false;
        const playerName = inputText.text.trim() || defaultName;
        LeaderboardHelper.saveEntry(playerName, this.playerLevel, this.totalScore, this.killCount);
        this.gameOverContainer.setVisible(false);

        // If boss is defeated, continue playing; otherwise, exit to menu
        if (!this.bossDefeated) {
          // Exit to main menu
          this.exitToMenu();
        }
      } else if (event.key === 'Backspace') {
        inputText.setText(inputText.text.slice(0, -1));
        cursorText.x = px + 30 + inputText.width + 4;
      } else if (event.key.length === 1 && inputText.text.length < 20) {
        inputText.setText(inputText.text + event.key);
        cursorText.x = px + 30 + inputText.width + 4;
      }
    });

    this.gameOverContainer.add([overlay, panel, title, namePromptText, inputBg, inputText, cursorText, instructionText, btnConfirm]);
  }

  private onPlayerDied(): void {
    if (!this.sys.isActive()) return;

    // Show pixel-art styled game over panel with name input
    this.gameOverContainer.setVisible(true);
  }

  private onBossSlain(): void {
    if (!this.sys.isActive()) return;
    this.bossDefeated = true;
  }

  private onEnemySelected(enemy: Enemy | null): void {
    if (!this.sys.isActive()) return;
    this.selectedEnemy = enemy;
    if (enemy) {
      this.targetFrameContainer.setVisible(true);
      this.updateTargetFrame();
    } else {
      this.targetFrameContainer.setVisible(false);
    }
  }

  private createPortfolioViewer(camW: number, camH: number): void {
    // Backdrop overlay
    this.portfolioOverlay = this.add.graphics().setDepth(90);
    this.portfolioOverlay.fillStyle(0x000000, 0.75);
    this.portfolioOverlay.fillRect(0, 0, camW, camH);
    this.portfolioOverlay.setVisible(false);

    // Modal Panel
    const panelW = 460;
    const panelH = 360; // Increased height slightly
    const px = (camW - panelW) / 2;
    const py = (camH - panelH) / 2;

    this.portfolioViewerContainer = this.add.container(0, 0).setDepth(91).setVisible(false);

    const panel = this.add.graphics();
    panel.fillStyle(0x0c0c14, 0.98);
    panel.fillRoundedRect(px, py, panelW, panelH, 10);
    panel.lineStyle(2, 0xf1c40f, 0.75);
    panel.strokeRoundedRect(px, py, panelW, panelH, 10);
    panel.lineStyle(1, 0xf1c40f, 0.25);
    panel.strokeRoundedRect(px + 4, py + 4, panelW - 8, panelH - 8, 8);

    const mainTitle = this.add.text(camW / 2, py + 25, 'HỒ SƠ NĂNG LỰC CÁ NHÂN', {
      fontSize: '15px', color: '#f1c40f', fontStyle: 'bold',
      fontFamily: 'Cinzel, serif',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    // ── Tab buttons ──────────────────────────────────────────────────
    const tabs = ['HỒ SƠ', 'DỰ ÁN', 'KỸ NĂNG', 'MỤC TIÊU'];
    const tabW = 100;
    const tabGap = 6;
    const startTabX = px + 22;

    this.portfolioTabButtons = [];
    this.portfolioTabContents = [];

    tabs.forEach((tabName, index) => {
      const tx = startTabX + index * (tabW + tabGap) + tabW / 2;
      const ty = py + 65;

      const btn = this.add.text(tx, ty, tabName, {
        fontSize: '11px', color: '#888888', fontStyle: 'bold',
        backgroundColor: '#161626', padding: { x: 8, y: 8 },
        fixedWidth: tabW, align: 'center',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      
      btn.on('pointerover', () => { if (this.activePortfolioTab !== index) btn.setColor('#ffffff'); });
      btn.on('pointerout', () => { if (this.activePortfolioTab !== index) btn.setColor('#888888'); });
      btn.on('pointerdown', () => {
        AudioManager.getInstance().playSFX('ui-click');
        this.selectPortfolioTab(index);
      });

      this.portfolioTabButtons.push(btn);
    });

    const textStyle = { fontSize: '12px', color: '#e0e0e0', lineSpacing: 6 };
    const contentY = py + 105;

    // ── Tab 0: Profile ───────────────────────────────────────────────
    const tab0Container = this.add.container(0, 0);
    
    const nameText = this.add.text(px + 30, contentY, 'Họ và tên: Trọng (Trần Văn Trọng)', {
      ...textStyle, fontStyle: 'bold', color: '#f1c40f', fontSize: '13px'
    });
    const eduText = this.add.text(px + 30, contentY + 30, 'Học vấn: Sinh viên ngành Công nghệ Thông tin', textStyle);
    const gpaText = this.add.text(px + 30, contentY + 55, 'GPA: 7.4 / 10', textStyle);
    const skillSumText = this.add.text(px + 30, contentY + 80, 'Kỹ năng nổi bật: Phát triển phần mềm đa nền tảng,\nTích hợp AI, Quản lý quy trình (Git/GitHub).', textStyle);

    tab0Container.add([nameText, eduText, gpaText, skillSumText]);
    this.portfolioTabContents.push(tab0Container);

    // ── Tab 1: Projects ──────────────────────────────────────────────
    const tab1Container = this.add.container(0, 0);

    const p1 = this.add.text(px + 30, contentY, '1. NeoMart', { fontSize: '13px', color: '#f1c40f', fontStyle: 'bold' });
    const p1Desc = this.add.text(px + 30, contentY + 18, 'Hệ thống thương mại điện tử hiện đại.', textStyle);

    const p2 = this.add.text(px + 30, contentY + 50, '2. Android Product Manager', { fontSize: '13px', color: '#f1c40f', fontStyle: 'bold' });
    const p2Desc = this.add.text(px + 30, contentY + 68, 'Ứng dụng quản lý sản phẩm trên nền tảng Android.', textStyle);

    const p3 = this.add.text(px + 30, contentY + 100, '3. iOS Warehouse Manager', { fontSize: '13px', color: '#f1c40f', fontStyle: 'bold' });
    const p3Desc = this.add.text(px + 30, contentY + 118, 'Hệ thống quản lý kho hàng chuẩn cho thiết bị iOS.', textStyle);

    const p4 = this.add.text(px + 30, contentY + 150, '4. Cinema Management .NET', { fontSize: '13px', color: '#f1c40f', fontStyle: 'bold' });
    const p4Desc = this.add.text(px + 30, contentY + 168, 'Phần mềm quản lý rạp chiếu phim tích hợp .NET.', textStyle);

    tab1Container.add([p1, p1Desc, p2, p2Desc, p3, p3Desc, p4, p4Desc]);
    this.portfolioTabContents.push(tab1Container);

    // ── Tab 2: Skills ────────────────────────────────────────────────
    const tab2Container = this.add.container(0, 0);

    const langLabel = this.add.text(px + 30, contentY, 'Ngôn ngữ lập trình:', { fontSize: '12px', color: '#4fc3f7', fontStyle: 'bold' });
    const langList = this.add.text(px + 30, contentY + 18, 'C#, HTML, CSS, JavaScript, Java, Kotlin, Swift, Python', textStyle);

    const fwLabel = this.add.text(px + 30, contentY + 50, 'Framework:', { fontSize: '12px', color: '#4fc3f7', fontStyle: 'bold' });
    const fwList = this.add.text(px + 30, contentY + 68, 'Laravel', textStyle);

    const toolLabel = this.add.text(px + 30, contentY + 100, 'Công cụ (Tools):', { fontSize: '12px', color: '#4fc3f7', fontStyle: 'bold' });
    const toolList = this.add.text(px + 30, contentY + 118, 'Git, GitHub', textStyle);

    const aiLabel = this.add.text(px + 30, contentY + 150, 'AI Tools:', { fontSize: '12px', color: '#4fc3f7', fontStyle: 'bold' });
    const aiList = this.add.text(px + 30, contentY + 168, 'ChatGPT, Claude, Gemini, DeepSeek, Grok, v0', textStyle);

    tab2Container.add([langLabel, langList, fwLabel, fwList, toolLabel, toolList, aiLabel, aiList]);
    this.portfolioTabContents.push(tab2Container);

    // ── Tab 3: Career Goals ──────────────────────────────────────────
    const tab3Container = this.add.container(0, 0);

    const gLabel1 = this.add.text(px + 30, contentY, 'Mục Tiêu Phát Triển:', { fontSize: '13px', color: '#f1c40f', fontStyle: 'bold' });
    const gList1 = this.add.text(px + 45, contentY + 22, '• Backend Developer\n• .NET Developer', { ...textStyle, lineSpacing: 10 });

    const gDesc = this.add.text(px + 30, contentY + 80, 'Hướng tới việc xây dựng các hệ thống Backend mạnh mẽ, xử lý dữ liệu\nlớn và thiết kế kiến trúc phần mềm hiệu quả bằng công nghệ .NET.', textStyle);

    tab3Container.add([gLabel1, gList1, gDesc]);
    this.portfolioTabContents.push(tab3Container);

    // ── Close / Exit Button ──────────────────────────────────────────
    const btnVictoryExit = this.add.text(camW / 2, py + panelH - 32, 'QUAY LẠI MENU CHÍNH', {
      fontSize: '10px', color: '#f1c40f', fontStyle: 'bold',
      backgroundColor: '#221a0f', padding: { x: 14, y: 8 },
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5);

    btnVictoryExit.setInteractive({ useHandCursor: true });
    btnVictoryExit.on('pointerover', () => btnVictoryExit.setColor('#ffffff').setStyle({ backgroundColor: '#d4af37' }));
    btnVictoryExit.on('pointerout', () => btnVictoryExit.setColor('#f1c40f').setStyle({ backgroundColor: '#221a0f' }));
    btnVictoryExit.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('ui-click');
      
      this.closePortfolioViewer();
      this.exitToMenu();
    });

    // Add all to container
    this.portfolioViewerContainer.add([
      panel, mainTitle, ...this.portfolioTabButtons, 
      tab0Container, tab1Container, tab2Container, tab3Container, btnVictoryExit
    ]);

    // Initial state: select tab 0
    this.selectPortfolioTab(0);
  }

  private selectPortfolioTab(tabIndex: number): void {
    this.activePortfolioTab = tabIndex;

    this.portfolioTabButtons.forEach((btn, index) => {
      if (index === tabIndex) {
        btn.setColor('#f1c40f');
        btn.setStyle({ backgroundColor: '#2b2b3d' });
      } else {
        btn.setColor('#888888');
        btn.setStyle({ backgroundColor: '#161626' });
      }
    });

    this.portfolioTabContents.forEach((container, index) => {
      container.setVisible(index === tabIndex);
    });
  }

  private openPortfolioViewer(): void {
    this.portfolioOverlay.setVisible(true);
    this.portfolioViewerContainer.setVisible(true);
    this.selectPortfolioTab(0);
  }

  private closePortfolioViewer(): void {
    this.portfolioOverlay.setVisible(false);
    this.portfolioViewerContainer.setVisible(false);
  }

  private onDocumentsMerged(): void {
    if (!this.sys.isActive()) return;
    this.unlockAchievement('complete_game');

    if (this.inventoryRef) {
      this.inventoryRef.mergeDocuments();
      this.refreshInventoryDisplay();
    }

    // Pause the game scene
    EventBus.emit(GameEvent.GAME_PAUSED);

    // Open document viewer with the completed CV
    const def = DOCUMENT_REGISTRY['merged_doc'];
    if (def) {
      this.openDocumentViewer(def);
    }
  }

  private onKillsChanged(data: { kills: number }): void {
    if (!this.sys.isActive()) return;
    this.killCount = data.kills;
    if (this.tabOpen) this.updateTabPanel();
  }

  private exitToMenu(): void {
    EventBus.emit(GameEvent.GAME_RESUMED);
    EventBus.emit(GameEvent.EXIT_TO_MENU);
  }

  private createAchievementsPanel(camW: number, camH: number): void {
    const panelW = 420;
    const panelH = 460;
    const px = (camW - panelW) / 2;
    const py = (camH - panelH) / 2;

    this.achievementsContainer = this.add.container(0, 0).setDepth(95).setVisible(false);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0c0c14, 0.98);
    bg.fillRoundedRect(px, py, panelW, panelH, 10);
    bg.lineStyle(2, 0xd4af37, 0.6); // Gold border
    bg.strokeRoundedRect(px, py, panelW, panelH, 10);

    // Title
    const title = this.add.text(camW / 2, py + 25, 'THÀNH TÍCH ĐẠT ĐƯỢC', {
      fontSize: '16px', color: '#ffd700', fontStyle: 'bold',
      fontFamily: 'Cinzel, serif',
    }).setOrigin(0.5);

    // Back Button
    const btnBack = this.add.text(camW / 2, py + panelH - 30, 'Quay lại', {
      fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#1a1a2e', padding: { x: 20, y: 8 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => btnBack.setColor('#ffd700'))
      .on('pointerout', () => btnBack.setColor('#ffffff'))
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('ui-click');
        this.achievementsContainer.setVisible(false);
        this.showPauseMenuElements(true);
      });

    this.achievementsContainer.add([bg, title, btnBack]);
  }

  private populateAchievementsList(): void {
    this.achievementListGroup.forEach(obj => obj.destroy());
    this.achievementListGroup = [];

    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;
    const panelW = 420;
    const px = (camW - panelW) / 2;
    const py = (camH - 460) / 2;

    const statsContainerY = py + 120;

    // Kills Card Background
    const killsCard = this.add.graphics();
    killsCard.fillStyle(0x1a1a2e, 0.85);
    killsCard.fillRoundedRect(px + 40, statsContainerY, panelW - 80, 80, 6);
    killsCard.lineStyle(2, 0xe74c3c, 0.6); // Red glow for kills
    killsCard.strokeRoundedRect(px + 40, statsContainerY, panelW - 80, 80, 6);
    this.achievementsContainer.add(killsCard);
    this.achievementListGroup.push(killsCard);

    // Kills Title Text
    const killsTitle = this.add.text(px + 60, statsContainerY + 15, 'TỔNG HẠ GỤC', {
      fontSize: '14px', color: '#ff6666', fontStyle: 'bold',
    });
    this.achievementsContainer.add(killsTitle);
    this.achievementListGroup.push(killsTitle);

    // Kills Value Text
    const killsVal = this.add.text(px + panelW - 60, statsContainerY + 40, `${this.killCount}`, {
      fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
      fontFamily: 'Cinzel, serif',
    }).setOrigin(1, 0.5);
    this.achievementsContainer.add(killsVal);
    this.achievementListGroup.push(killsVal);

    // Score Card Background
    const scoreContainerY = statsContainerY + 120;
    const scoreCard = this.add.graphics();
    scoreCard.fillStyle(0x1a1a2e, 0.85);
    scoreCard.fillRoundedRect(px + 40, scoreContainerY, panelW - 80, 80, 6);
    scoreCard.lineStyle(2, 0xf1c40f, 0.6); // Gold glow for score
    scoreCard.strokeRoundedRect(px + 40, scoreContainerY, panelW - 80, 80, 6);
    this.achievementsContainer.add(scoreCard);
    this.achievementListGroup.push(scoreCard);

    // Score Title Text
    const scoreTitle = this.add.text(px + 60, scoreContainerY + 15, 'ĐIỂM ĐẠT ĐƯỢC', {
      fontSize: '14px', color: '#ffd700', fontStyle: 'bold',
    });
    this.achievementsContainer.add(scoreTitle);
    this.achievementListGroup.push(scoreTitle);

    // Score Value Text
    const scoreVal = this.add.text(px + panelW - 60, scoreContainerY + 40, `${this.totalScore}`, {
      fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
      fontFamily: 'Cinzel, serif',
    }).setOrigin(1, 0.5);
    this.achievementsContainer.add(scoreVal);
    this.achievementListGroup.push(scoreVal);
  }

  private unlockAchievement(id: string): void {
    const ach = this.achievements.find(a => a.id === id);
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      this.showAchievementPopup(ach);
    }
  }

  private showAchievementPopup(ach: Achievement): void {
    const camW = this.cameras.main.width;
    const toastW = 260;
    const toastH = 50;
    const tx = (camW - toastW) / 2;
    const tyStart = -toastH - 10;
    const tyEnd = 50;

    const container = this.add.container(tx, tyStart).setDepth(200);

    const bg = this.add.graphics();
    bg.fillStyle(0x0c0c14, 0.95);
    bg.fillRoundedRect(0, 0, toastW, toastH, 6);
    bg.lineStyle(2, 0xd4af37, 0.8);
    bg.strokeRoundedRect(0, 0, toastW, toastH, 6);

    const icon = this.add.text(12, 10, '🏆', { fontSize: '24px' });
    const banner = this.add.text(48, 8, 'THÀNH TỰU ĐẠT ĐƯỢC!', {
      fontSize: '10px', color: '#ffd700', fontStyle: 'bold',
    });
    const title = this.add.text(48, 22, ach.title, {
      fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
    });

    container.add([bg, icon, banner, title]);

    AudioManager.getInstance().playSFX('achievement');

    this.tweens.add({
      targets: container,
      y: tyEnd,
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(3000, () => {
          this.tweens.add({
            targets: container,
            y: tyStart,
            duration: 400,
            ease: 'Power2.easeIn',
            onComplete: () => {
              container.destroy();
            }
          });
        });
      }
    });
  }

  public getAchievementsState(): string[] {
    return this.achievements.filter(a => a.unlocked).map(a => a.id);
  }

  public setAchievementsState(unlockedIds: string[]): void {
    this.achievements.forEach(ach => {
      ach.unlocked = unlockedIds.includes(ach.id);
    });

    // Retroactively unlock achievements on load if they meet the criteria
    if (this.killCount >= 1) this.achievements.find(a => a.id === 'first_kill')!.unlocked = true;
    if (this.killCount >= 25) this.achievements.find(a => a.id === 'kill_25')!.unlocked = true;
    if (this.killCount >= 50) this.achievements.find(a => a.id === 'kill_50')!.unlocked = true;
    if (this.killCount >= 100) this.achievements.find(a => a.id === 'kill_100')!.unlocked = true;
    if (this.playerLevel >= 5) this.achievements.find(a => a.id === 'reach_lvl_5')!.unlocked = true;
    if (this.playerLevel >= 10) this.achievements.find(a => a.id === 'reach_lvl_10')!.unlocked = true;
    if (this.inventoryRef) {
      const docs = this.inventoryRef.getCollectedDocuments();
      if (docs.length === 3 || docs.includes('merged_doc')) {
        this.achievements.find(a => a.id === 'collect_all_pages')!.unlocked = true;
      }
    }
    const gameScene = this.scene.get(SceneKey.GAME) as any;
    if (gameScene && gameScene.bossDefeated) {
      this.achievements.find(a => a.id === 'first_boss_kill')!.unlocked = true;
    }
  }

  private onChestOpened(): void {
    this.unlockAchievement('first_treasure');
  }

  private applyFontSizeScale(scale: number): void {
    const labelSize = Math.round(12 * scale);
    const valSize = Math.round(10 * scale);
    const titleSize = Math.round(12 * scale);
    const killSize = Math.round(13 * scale);
    const weaponSize = Math.round(14 * scale);
    const ammoSize = Math.round(12 * scale);
    const reloadSize = Math.round(11 * scale);

    if (this.levelText) this.levelText.setFontSize(`${titleSize}px`);
    if (this.hpLabel) this.hpLabel.setFontSize(`${labelSize}px`);
    if (this.mpLabel) this.mpLabel.setFontSize(`${labelSize}px`);
    if (this.expLabel) this.expLabel.setFontSize(`${labelSize}px`);
    if (this.hpValueText) this.hpValueText.setFontSize(`${valSize}px`);
    if (this.mpValueText) this.mpValueText.setFontSize(`${valSize}px`);
    if (this.expPctText) this.expPctText.setFontSize(`${valSize}px`);
    if (this.weaponNameText) this.weaponNameText.setFontSize(`${weaponSize}px`);
    if (this.ammoText) this.ammoText.setFontSize(`${ammoSize}px`);
    if (this.reloadText) this.reloadText.setFontSize(`${reloadSize}px`);
  }

}
