import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface KeyBindings {
  up: string;
  down: string;
  left: string;
  right: string;
  attack: string;
  skill1: string; // Q
  skill2: string; // E
  dash: string; // Space
  ultimate: string; // F
  inventory: string; // I
  interact: string; // E / Enter
}

export interface SettingsState {
  // Audio
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;

  // Graphics
  fullscreen: boolean;
  resolutionScale: number; // 1 = 100%, 2 = 200%, etc.
  vSync: boolean;

  // Gameplay
  showDamageNumber: boolean;
  showCriticalEffect: boolean;
  screenShake: boolean;

  // Controls
  mouseSensitivity: number;
  keyBindings: KeyBindings;

  // Accessibility
  uiScale: number;
  fontScale: number;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

  // Actions
  setAudio: (updates: Partial<{ masterVolume: number; musicVolume: number; sfxVolume: number }>) => void;
  setGraphics: (updates: Partial<{ fullscreen: boolean; resolutionScale: number; vSync: boolean }>) => void;
  setGameplay: (updates: Partial<{ showDamageNumber: boolean; showCriticalEffect: boolean; screenShake: boolean }>) => void;
  setControls: (updates: Partial<{ mouseSensitivity: number; keyBindings: KeyBindings }>) => void;
  setAccessibility: (updates: Partial<{ uiScale: number; fontScale: number; colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' }>) => void;
  resetToDefaults: () => void;
}

const defaultKeyBindings: KeyBindings = {
  up: 'SPACE',
  down: 'S',
  left: 'A',
  right: 'D',
  attack: 'LCLICK',
  skill1: 'Q',
  skill2: 'E',
  dash: 'SHIFT',
  ultimate: 'F',
  inventory: 'B',
  interact: 'E',
};

const defaultSettings = {
  masterVolume: 1,
  musicVolume: 0.8,
  sfxVolume: 1,
  fullscreen: false,
  resolutionScale: 1,
  vSync: true,
  showDamageNumber: true,
  showCriticalEffect: true,
  screenShake: true,
  mouseSensitivity: 1,
  keyBindings: defaultKeyBindings,
  uiScale: 1.0,
  fontScale: 1.0,
  colorBlindMode: 'none' as const,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setAudio: (updates) => set((state) => ({ ...state, ...updates })),
      setGraphics: (updates) => set((state) => ({ ...state, ...updates })),
      setGameplay: (updates) => set((state) => ({ ...state, ...updates })),
      setControls: (updates) => set((state) => ({ ...state, ...updates })),
      setAccessibility: (updates) => set((state) => ({ ...state, ...updates })),
      resetToDefaults: () => set(() => ({ ...defaultSettings })),
    }),
    {
      name: 'shadow_blade_settings',
    }
  )
);
