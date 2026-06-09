import { useEffect, useState } from 'react';
import EventBus from '../../game/EventBus';

interface BossIntroData {
  name: string;
  title: string;
}

interface BossPhaseData {
  phase: number;
  name: string;
}

export function HUD() {
  const [introData, setIntroData] = useState<BossIntroData | null>(null);
  const [phaseData, setPhaseData] = useState<BossPhaseData | null>(null);
  const [bossSlain, setBossSlain] = useState<boolean>(false);

  useEffect(() => {
    // 1. Boss Intro listener
    const handleBossIntro = (data: BossIntroData) => {
      setIntroData(data);
      // Auto clear after 2.5 seconds
      const timer = setTimeout(() => {
        setIntroData(null);
      }, 2500);
      return () => clearTimeout(timer);
    };

    // 2. Boss Phase transition listener
    const handleBossPhase = (data: BossPhaseData) => {
      setPhaseData(data);
      // Auto clear after 1.8 seconds
      const timer = setTimeout(() => {
        setPhaseData(null);
      }, 1800);
      return () => clearTimeout(timer);
    };

    // 3. Boss Slain listener
    const handleBossSlain = () => {
      setBossSlain(true);
      // Auto clear after 4.5 seconds
      const timer = setTimeout(() => {
        setBossSlain(false);
      }, 4500);
      return () => clearTimeout(timer);
    };

    EventBus.on('boss-intro-start', handleBossIntro);
    EventBus.on('boss-phase-transition', handleBossPhase);
    EventBus.on('boss-slain', handleBossSlain);

    return () => {
      EventBus.off('boss-intro-start', handleBossIntro);
      EventBus.off('boss-phase-transition', handleBossPhase);
      EventBus.off('boss-slain', handleBossSlain);
    };
  }, []);

  return (
    <div className="hud-overlay flex items-center justify-center select-none pointer-events-none">
      
      {/* ── BOSS INTRO OVERLAY ── */}
      {introData && (
        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center z-50 animate-fade-in pointer-events-auto">
          {/* Top/bottom cinematic bars */}
          <div className="absolute top-0 left-0 w-full h-[15vh] bg-black border-b border-soul-blue/20" />
          <div className="absolute bottom-0 left-0 w-full h-[15vh] bg-black border-t border-soul-blue/20" />
          
          <div className="text-center space-y-4 animate-slide-up z-10 p-6">
            <p className="text-xs tracking-[0.5em] text-[#ff3333] font-bold uppercase font-display animate-pulse">
              ⚠️ CẢNH BÁO: PHÁT HIỆN BOSS
            </p>
            <div className="h-px w-48 mx-auto bg-gradient-to-r from-transparent via-[#ff3333] to-transparent" />
            <h1 className="text-5xl md:text-6xl font-bold tracking-widest font-display text-transparent bg-clip-text bg-gradient-to-b from-[#ffd700] via-[#ffd700] to-[#b8860b] filter drop-shadow-[0_0_15px_rgba(255,215,0,0.4)]">
              {introData.name.toUpperCase()}
            </h1>
            <p className="text-sm tracking-[0.4em] text-silver font-display">
              — {introData.title.toUpperCase()} —
            </p>
          </div>
        </div>
      )}

      {/* ── BOSS PHASE TRANSITION ── */}
      {phaseData && (
        <div className="absolute inset-x-0 top-1/3 flex flex-col items-center justify-center z-40 animate-fade-in pointer-events-none">
          <div className="bg-black/60 border-y border-red-500/30 w-full py-4 backdrop-blur-sm flex flex-col items-center justify-center animate-pulse-glow">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-[0.3em] font-display text-red-500 text-center filter drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
              {phaseData.phase === 2 ? '⚠️ BOSS NỔI GIẬN' : '🔥 GIAI ĐOẠN 2: BÙNG NỔ'}
            </h2>
            <p className="text-xs text-mist tracking-widest uppercase mt-1">
              Sức mạnh {phaseData.name} gia tăng vượt bậc!
            </p>
          </div>
        </div>
      )}

      {/* Boss Slain Overlay Removed */}

    </div>
  );
}
