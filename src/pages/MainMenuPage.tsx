/**
 * Main Menu Page — Immersive dark fantasy menu
 * First screen the player sees
 */
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { AudioManager } from '../game/managers/AudioManager';
import { LeaderboardHelper } from '../game/utils/LeaderboardHelper';
import type { LeaderboardEntry } from '../game/utils/LeaderboardHelper';
import { SettingsOverlay } from '../components/ui/SettingsOverlay';

export function MainMenuPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  // Animated particle background
  useEffect(() => {
    AudioManager.getInstance().playBgm('menu');

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Floating particles
    const particles: { x: number; y: number; size: number; speed: number; opacity: number }[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.1,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw particles
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(79, 195, 247, ${p.opacity})`;
        ctx.fill();

        p.y -= p.speed;
        p.x += Math.sin(p.y * 0.01) * 0.3;

        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
      });

      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center h-screen w-screen overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center bottom, #1a1a2e 0%, #0a0a0f 70%)' }}>

      {/* Particle canvas background */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Game Title */}
        <div className="text-center animate-fade-in">
          <h1 className="text-6xl font-bold tracking-wider mb-2"
            style={{
              fontFamily: 'Cinzel, serif',
              background: 'linear-gradient(135deg, #4fc3f7, #81d4fa, #e8e8f0)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: 'none',
              filter: 'drop-shadow(0 0 20px rgba(79, 195, 247, 0.3))',
            }}>
            DARK KNIGHT
          </h1>
        </div>

        {/* Decorative divider */}
        <div className="w-48 h-px opacity-30"
          style={{ background: 'linear-gradient(90deg, transparent, #4fc3f7, transparent)' }} />

        {/* Menu Buttons */}
        <div className="flex flex-col gap-4 items-center animate-slide-up"
          style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
          <button
            onClick={() => {
              AudioManager.getInstance().playSFX('ui-click');
              localStorage.setItem('shadow_blade_load_mode', 'new');
              navigate('/play');
            }}
            className="btn-primary w-56 animate-pulse-glow cursor-pointer"
          >
            Trò chơi mới
          </button>

          <button
            onClick={() => {
              AudioManager.getInstance().playSFX('ui-click');
              const entries = LeaderboardHelper.getEntries();
              setLeaderboardEntries(entries);
              setShowLeaderboard(true);
            }}
            className="btn-primary w-56 animate-pulse-glow cursor-pointer"
          >
            Bảng xếp hạng
          </button>

          <button
            onClick={() => {
              AudioManager.getInstance().playSFX('ui-click');
              setShowSettings(true);
            }}
            className="btn-primary w-56 animate-pulse-glow cursor-pointer"
          >
            Cài đặt
          </button>

          <button
            onClick={() => {
              AudioManager.getInstance().playSFX('ui-click');
              if (window.confirm('Bạn có muốn thoát game không?')) {
                window.close();
              }
            }}
            className="btn-primary w-56 cursor-pointer"
          >
            Thoát
          </button>
        </div>

        {/* Creator */}
        <p className="mt-8 text-xl opacity-30"
          style={{ fontFamily: 'Inter, sans-serif' }}>
          Created By Tran Van Trong
        </p>
      </div>

      {/* Leaderboard Overlay */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-2xl p-8 relative flex flex-col gap-6 animate-slide-up"
            style={{
              backgroundColor: '#0a0a1a',
              border: '3px solid #9b9999',
              boxShadow: '0 0 20px rgba(158, 157, 154, 0.3), inset 0 0 20px rgba(255, 215, 0, 0.1)',
              fontFamily: 'VT323, "Courier New", monospace',
            }}>

            {/* Top decorative line */}
            <div className="w-full h-1" style={{ background: 'linear-gradient(90deg, #b8b7b4, #d6d6d4, #e9e9e9)', boxShadow: '0 0 10px #ecece9' }} />

            {/* Title */}
            <div className="text-center">
              <h2 className="text-4xl font-bold uppercase tracking-widest"
                style={{
                  fontFamily: 'VT323, monospace',
                  color: '#00b7ff',
                  textShadow: '3px 3px 0px #000000, -1px -1px 0px rgba(255,215,0,0.5)',
                  letterSpacing: '4px',
                }}>
                THÀNH TÍCH NGƯỜI CHƠI
              </h2>
              <p className="text-xl uppercase tracking-widest mt-2" style={{ color: '#4fc3f7', textShadow: '2px 2px 0px #000000' }}>
                TOP CAO THỦ DARK KNIGHT
              </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse" style={{ fontFamily: 'VT323, monospace' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ffd700' }}>
                    <th className="py-3 px-3 text-center text-xl" style={{ color: '#e6e6e6', textShadow: '2px 2px 0px #000000' }}>HẠ</th>
                    <th className="py-3 px-3  text-xl" style={{ color: '#e6e6e6', textShadow: '2px 2px 0px #000000' }}>NGƯỜI CHƠI</th>
                    <th className="py-3 px-3 text-center  text-xl" style={{ color: '#e6e6e6', textShadow: '2px 2px 0px #000000' }}>CẤP</th>
                    <th className="py-3 px-3 text-center  text-xl" style={{ color: '#e6e6e6', textShadow: '2px 2px 0px #000000' }}>BOSS</th>
                    <th className="py-3 px-3 text-center  text-xl" style={{ color: '#e6e6e6', textShadow: '2px 2px 0px #000000' }}>KILLS</th>
                    <th className="py-3 px-3 text-right  text-xl" style={{ color: '#e6e6e6', textShadow: '2px 2px 0px #000000' }}>ĐIỂM</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardEntries.length > 0 ? (
                    leaderboardEntries.map((entry, idx) => {
                      let bgColor = '#0a0a1a';
                      let borderColor = '#444444';
                      let textColor = '#c4c4c4';
                      let medal = '';

                      if (idx === 0) {
                        bgColor = '#2a2a0a';
                        borderColor = '#ffd700';
                        textColor = '#ffd700';
                        medal = '🥇';
                      } else if (idx === 1) {
                        bgColor = '#1a1a2a';
                        borderColor = '#eeeeee';
                        textColor = '#eeeeee';
                        medal = '🥈';
                      } else if (idx === 2) {
                        bgColor = '#2a1a0a';
                        borderColor = '#cd7f32';
                        textColor = '#cd7f32';
                        medal = '🥉';
                      }

                      return (
                        <tr key={idx} style={{ backgroundColor: bgColor, borderBottom: `1px solid ${borderColor}` }}>
                          <td className="text-base py-3 px-3 text-center font-bold text-xl" style={{ color: textColor, textShadow: '1px 1px 0px #000000' }}>
                            {medal} {idx + 1}
                          </td>
                          <td className="py-3 px-3 font-bold max-w-xs truncate text-base" style={{ color: textColor, textShadow: '1px 1px 0px #000000' }}>
                            {entry.name.toUpperCase()}
                          </td>
                          <td className="py-3 px-3 text-center text-base" style={{ color: '#ffffff', textShadow: '1px 1px 0px #000000' }}>
                            LV {entry.level}
                          </td>
                          <td className="py-3 px-3 text-center text-base" style={{ color: entry.bossKilled ? '#00ff00' : '#ff0000', textShadow: '1px 1px 0px #000000' }}>
                            {entry.bossKilled ? '✓ YES' : '~ NO'}
                          </td>
                          <td className="py-3 px-3 text-center text-base" style={{ color: '#ffffff', textShadow: '1px 1px 0px #000000' }}>
                            {entry.kills}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-base" style={{ color: textColor, textShadow: '1px 1px 0px #000000' }}>
                            {entry.score.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center italic" style={{ color: '#888888', textShadow: '1px 1px 0px #000000' }}>
                        ╭─ CHƯA CÓ KỶ LỤC ─╮<br />
                        HÃY VÀO CHIẾN ĐẤU ĐỂ GHI DANH!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Date detail */}
            {leaderboardEntries.length > 0 && (
              <p className="text-xl text-center" style={{ color: '#888888', textShadow: '1px 1px 0px #000000' }}>
                ↻ CẬP NHẬT: {leaderboardEntries[0]?.date}
              </p>
            )}

            {/* Close Button */}
            <button
              onClick={() => {
                AudioManager.getInstance().playSFX('ui-click');
                setShowLeaderboard(false);
              }}
              className="w-full py-3 font-bold uppercase tracking-widest cursor-pointer transition-all hover:scale-105"
              style={{
                backgroundColor: '#757573',
                color: '#00d0f500',
                border: '3px solid #000000',
                fontFamily: 'VT323, monospace',
                textShadow: '1px 1px 0px rgb(43, 187, 206)',
                boxShadow: '4px 4px 0px #000000, 0 0 10px rgba(255,215,0,0.3)',
              }}
            >
              QUAY LẠI
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsOverlay onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
