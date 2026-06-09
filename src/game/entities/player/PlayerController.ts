/**
 * PlayerController - Input handler for the player entity.
 * Dynamic bindings synced with useSettingsStore.
 */
import Phaser from 'phaser';
import { useSettingsStore } from '../../../stores/settingsStore';

export interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
  dash: boolean;
  weapon1: boolean;
  weapon2: boolean;
  reload: boolean;
  skillQ: boolean;
  skillE: boolean;
  skillF: boolean;
  inventoryToggle: boolean;
  tabToggle: boolean;
  interact: boolean;
  pause: boolean;
}

export class PlayerController {
  private scene: Phaser.Scene;
  public locked: boolean = false;
  private unsubscribe: () => void;

  // Dynamic keys
  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private keyAttack!: Phaser.Input.Keyboard.Key;
  private keyDash!: Phaser.Input.Keyboard.Key;
  private keySkill1!: Phaser.Input.Keyboard.Key;
  private keySkill2!: Phaser.Input.Keyboard.Key;
  private keyUltimate!: Phaser.Input.Keyboard.Key;
  private keyInventory!: Phaser.Input.Keyboard.Key;
  private keyInteract!: Phaser.Input.Keyboard.Key;

  // Hardcoded keys & fallback
  private keyWeapon1!: Phaser.Input.Keyboard.Key;
  private keyWeapon2!: Phaser.Input.Keyboard.Key;
  private keyReload!: Phaser.Input.Keyboard.Key;
  private keyTab!: Phaser.Input.Keyboard.Key;
  private keyPause!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  private mouseLeftJustDown: boolean = false;
  private mouseRightJustDown: boolean = false;
  private lastUpdateFrame: number = -1;
  private cachedInput!: PlayerInput;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.updateBindings();

    // Subscribe to settings changes
    this.unsubscribe = useSettingsStore.subscribe((state, prevState) => {
      if (JSON.stringify(state.keyBindings) !== JSON.stringify(prevState.keyBindings)) {
        this.updateBindings();
      }
    });

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) {
        this.mouseLeftJustDown = true;
      } else if (pointer.button === 2) {
        this.mouseRightJustDown = true;
      }
    });
  }

  private isActionDown(binding: string, key: Phaser.Input.Keyboard.Key): boolean {
    if (binding === 'LCLICK') {
      return this.scene.input.activePointer.leftButtonDown();
    }
    if (binding === 'RCLICK') {
      return this.scene.input.activePointer.rightButtonDown();
    }
    return key ? key.isDown : false;
  }

  private isActionJustDown(binding: string, key: Phaser.Input.Keyboard.Key): boolean {
    if (binding === 'LCLICK') {
      return this.mouseLeftJustDown;
    }
    if (binding === 'RCLICK') {
      return this.mouseRightJustDown;
    }
    return key ? Phaser.Input.Keyboard.JustDown(key) : false;
  }

  private updateBindings(): void {
    const kb = this.scene.input.keyboard!;
    const bindings = useSettingsStore.getState().keyBindings;

    // Helper to map key strings to Phaser KeyCodes
    const getKeyCode = (keyString: string): number => {
      const upper = keyString.toUpperCase();
      if (upper === 'LCLICK' || upper === 'RCLICK') {
        // Return dummy key code for mouse actions
        return Phaser.Input.Keyboard.KeyCodes.F12;
      }
      if (upper === 'SPACE') return Phaser.Input.Keyboard.KeyCodes.SPACE;
      if (upper === 'SHIFT') return Phaser.Input.Keyboard.KeyCodes.SHIFT;
      if (upper === 'ENTER') return Phaser.Input.Keyboard.KeyCodes.ENTER;
      if (upper === 'ESC' || upper === 'ESCAPE') return Phaser.Input.Keyboard.KeyCodes.ESC;
      if (upper === 'CTRL' || upper === 'CONTROL') return Phaser.Input.Keyboard.KeyCodes.CTRL;
      if (upper === 'ALT') return Phaser.Input.Keyboard.KeyCodes.ALT;

      const code = (Phaser.Input.Keyboard.KeyCodes as any)[upper];
      return code !== undefined ? code : Phaser.Input.Keyboard.KeyCodes.SPACE;
    };

    this.keyLeft = kb.addKey(getKeyCode(bindings.left));
    this.keyRight = kb.addKey(getKeyCode(bindings.right));
    this.keyUp = kb.addKey(getKeyCode(bindings.up));
    this.keyDown = kb.addKey(getKeyCode(bindings.down));
    this.keyAttack = kb.addKey(getKeyCode(bindings.attack));
    this.keyDash = kb.addKey(getKeyCode(bindings.dash));
    this.keySkill1 = kb.addKey(getKeyCode(bindings.skill1));
    this.keySkill2 = kb.addKey(getKeyCode(bindings.skill2));
    this.keyUltimate = kb.addKey(getKeyCode(bindings.ultimate));
    this.keyInventory = kb.addKey(getKeyCode(bindings.inventory));
    this.keyInteract = kb.addKey(getKeyCode(bindings.interact));

    // Hardcoded keys
    this.keyWeapon1 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.keyWeapon2 = kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.keyReload = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyTab = kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.keyPause = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  getInput(): PlayerInput {
    // Cache inputs per frame because Phaser.Input.Keyboard.JustDown resets state on evaluation.
    const currentFrame = this.scene.game.loop.frame;
    if (this.lastUpdateFrame === currentFrame) {
      return this.cachedInput;
    }

    this.lastUpdateFrame = currentFrame;

    if (this.locked) {
      this.cachedInput = {
        left: false, right: false, jump: false, attack: false, dash: false,
        weapon1: false, weapon2: false, reload: false, skillQ: false, skillE: false, skillF: false,
        inventoryToggle: false, tabToggle: false, interact: false, pause: false
      };
      this.mouseLeftJustDown = false;
      this.mouseRightJustDown = false;
      return this.cachedInput;
    }
    const bindings = useSettingsStore.getState().keyBindings;
    const isSpaceJump = bindings.attack !== 'SPACE';

    this.cachedInput = {
      left: this.isActionDown(bindings.left, this.keyLeft),
      right: this.isActionDown(bindings.right, this.keyRight),
      jump: this.isActionJustDown(bindings.up, this.keyUp) || (isSpaceJump && Phaser.Input.Keyboard.JustDown(this.keySpace)),
      attack: this.isActionDown(bindings.attack, this.keyAttack),
      dash: this.isActionJustDown(bindings.dash, this.keyDash),
      weapon1: Phaser.Input.Keyboard.JustDown(this.keyWeapon1),
      weapon2: Phaser.Input.Keyboard.JustDown(this.keyWeapon2),
      reload: Phaser.Input.Keyboard.JustDown(this.keyReload),
      skillQ: this.isActionJustDown(bindings.skill1, this.keySkill1),
      skillE: this.isActionJustDown(bindings.skill2, this.keySkill2),
      skillF: this.isActionJustDown(bindings.ultimate, this.keyUltimate),
      inventoryToggle: this.isActionJustDown(bindings.inventory, this.keyInventory),
      tabToggle: Phaser.Input.Keyboard.JustDown(this.keyTab),
      interact: this.isActionJustDown(bindings.interact, this.keyInteract),
      pause: Phaser.Input.Keyboard.JustDown(this.keyPause),
    };

    this.mouseLeftJustDown = false;
    this.mouseRightJustDown = false;
    return this.cachedInput;
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
