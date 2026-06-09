/**
 * Game Page — Renders Phaser canvas + React HUD overlay
 * This is the main gameplay screen
 */
import { useRef, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhaserGame from '../game/PhaserGame';
import { HUD } from '../components/ui/HUD';
import type Phaser from 'phaser';
import EventBus from '../game/EventBus';
import { GameEvent } from '../types/game.types';
import { SettingsOverlay } from '../components/ui/SettingsOverlay';
import { TutorialPopup } from '../components/ui/TutorialPopup';
import { AudioManager } from '../game/managers/AudioManager';

export function GamePage() {
  const navigate = useNavigate();
  const gameRef = useRef<Phaser.Game | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const handleGameReady = useCallback((game: Phaser.Game) => {
    gameRef.current = game;

    // Trigger tutorial guide if starting a new game
    const isNew = localStorage.getItem('shadow_blade_load_mode') === 'new';
    const shown = localStorage.getItem('shadow_blade_tutorial_shown') === 'true';
    if (isNew && !shown) {
      setShowTutorial(true);
      EventBus.emit('tutorial-active', true);
      // Brief delay to allow scenes to setup before pausing
      setTimeout(() => {
        EventBus.emit(GameEvent.GAME_PAUSED);
      }, 200);
    }
  }, []);

  const handleCloseTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('shadow_blade_tutorial_shown', 'true');
    EventBus.emit('tutorial-active', false);
    EventBus.emit(GameEvent.GAME_RESUMED);
  };

  useEffect(() => {
    const handleOpenSettings = () => {
      setShowSettings(true);
    };

    EventBus.on('open-settings', handleOpenSettings);

    return () => {
      EventBus.off('open-settings', handleOpenSettings);
    };
  }, []);

  useEffect(() => {
    const handleExitToMenu = () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      navigate('/');
    };

    EventBus.on(GameEvent.EXIT_TO_MENU, handleExitToMenu);

    return () => {
      EventBus.off(GameEvent.EXIT_TO_MENU, handleExitToMenu);
    };
  }, [navigate]);

  return (
    <div className="relative w-screen h-screen overflow-hidden"
         style={{ background: '#0a0a0f' }}>
      {/* Phaser Game Canvas */}
      <PhaserGame onGameReady={handleGameReady} />

      {/* React HUD Overlay */}
      <HUD />

      {/* React Settings Overlay */}
      {showSettings && (
        <SettingsOverlay
          onClose={() => {
            setShowSettings(false);
            EventBus.emit('close-settings');
          }}
        />
      )}

      {/* First Time Tutorial Popup */}
      {showTutorial && (
        <TutorialPopup onClose={handleCloseTutorial} />
      )}
    </div>
  );
}
