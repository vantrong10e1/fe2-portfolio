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
// import { TutorialPopup } from '../components/ui/TutorialPopup'; // Tutorial removed
import { AudioManager } from '../game/managers/AudioManager';

export function GamePage() {
  const navigate = useNavigate();
  const gameRef = useRef<Phaser.Game | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleGameReady = useCallback((game: Phaser.Game) => {
    gameRef.current = game;
    // Tutorial removed
  }, []);

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

      {/* Tutorial removed */}
    </div>
  );
}
