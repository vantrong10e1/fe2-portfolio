/**
 * Root Application Component
 * Manages routing between menu and game pages, and applies global accessibility settings (Color Blind, Scaling).
 */
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainMenuPage } from '../pages/MainMenuPage';
import { GamePage } from '../pages/GamePage';
import { useSettingsStore } from '../stores/settingsStore';

export function App() {
  const colorBlindMode = useSettingsStore((state) => state.colorBlindMode);
  const uiScale = useSettingsStore((state) => state.uiScale);
  const fontScale = useSettingsStore((state) => state.fontScale);

  useEffect(() => {
    // Sync color blind mode to #root wrapper
    const root = document.getElementById('root');
    if (root) {
      // Remove existing color blind classes
      root.classList.remove('filter-protanopia', 'filter-deuteranopia', 'filter-tritanopia');
      if (colorBlindMode !== 'none') {
        root.classList.add(`filter-${colorBlindMode}`);
      }
    }
  }, [colorBlindMode]);

  useEffect(() => {
    // Sync scaling variables to CSS root
    const documentRoot = document.documentElement;
    documentRoot.style.setProperty('--ui-scale', uiScale.toString());
    documentRoot.style.setProperty('--font-scale', fontScale.toString());
  }, [uiScale, fontScale]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenuPage />} />
        <Route path="/play" element={<GamePage />} />
      </Routes>

      {/* SVG Color Blindness Matrix Filters */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        <defs>
          <filter id="protanopia-filter">
            <feColorMatrix type="matrix" values="0.567, 0.433, 0, 0, 0, 0.558, 0.442, 0, 0, 0, 0, 0.242, 0.758, 0, 0, 0, 0, 0, 1, 0" />
          </filter>
          <filter id="deuteranopia-filter">
            <feColorMatrix type="matrix" values="0.625, 0.375, 0, 0, 0, 0.7, 0.3, 0, 0, 0, 0, 0.3, 0.7, 0, 0, 0, 0, 0, 1, 0" />
          </filter>
          <filter id="tritanopia-filter">
            <feColorMatrix type="matrix" values="0.95, 0.05, 0, 0, 0, 0, 0.433, 0.567, 0, 0, 0, 0.475, 0.525, 0, 0, 0, 0, 0, 1, 0" />
          </filter>
        </defs>
      </svg>
    </BrowserRouter>
  );
}
