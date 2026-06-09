/**
 * PhaserGame - React component that hosts the Phaser canvas.
 *
 * Architecture Decision:
 * The Phaser.Game instance lives entirely within a React ref and is
 * created / destroyed via useEffect.  This keeps React in charge of
 * the DOM lifecycle while Phaser manages the canvas internally.
 * A forwarded ref + callback prop expose the game instance to parent
 * React components when needed (e.g. for dev tools or store wiring).
 *
 * The component is memoised to prevent unnecessary re-renders; Phaser
 * handles its own frame loop.
 */
import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  memo,
} from 'react';
import Phaser from 'phaser';
import gameConfig from './config';

// ── Types ────────────────────────────────────────────────────────────

export interface PhaserGameHandle {
  /** Direct access to the underlying Phaser.Game instance (may be null before mount) */
  game: Phaser.Game | null;
}

export interface PhaserGameProps {
  /** Optional callback fired once the game instance has been created */
  onGameReady?: (game: Phaser.Game) => void;
}

// ── Component ────────────────────────────────────────────────────────

const PhaserGame = memo(
  forwardRef<PhaserGameHandle, PhaserGameProps>(function PhaserGame(
    { onGameReady },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);

    // Expose the game instance to parent via ref
    useImperativeHandle(ref, () => ({
      get game() {
        return gameRef.current;
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      // Create Phaser game, parented to our div
      const game = new Phaser.Game({
        ...gameConfig,
        parent: containerRef.current,
      });

      gameRef.current = game;
      onGameReady?.(game);

      // Create a ResizeObserver to monitor the parent element size changes
      const resizeObserver = new ResizeObserver(() => {
        if (game && game.scale) {
          game.scale.refresh();
        }
      });
      resizeObserver.observe(containerRef.current);

      // Cleanup on unmount
      return () => {
        resizeObserver.disconnect();
        game.destroy(true);
        gameRef.current = null;
      };
      // We intentionally run this effect only on mount/unmount
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div
        ref={containerRef}
        id="phaser-container"
        style={{ width: '100%', height: '100%' }}
      />
    );
  }),
);

export default PhaserGame;
