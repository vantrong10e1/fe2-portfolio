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
            SHADOW BLADE
          </h1>
          <p className="text-sm tracking-[0.3em] uppercase"
             style={{ color: '#8888aa', fontFamily: 'Cinzel, serif' }}>
            Cuộc phiêu lưu giả tưởng tăm tối
          </p>
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
        <p className="mt-8 text-xs opacity-30"
           style={{ fontFamily: 'Inter, sans-serif' }}>
          Được tạo bởi Trần Văn Trọng
        </p>
      </div>

      {/* Leaderboard Overlay */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg p-6 game-panel border border-soul-blue/30 rounded-lg shadow-2xl relative flex flex-col gap-6 animate-slide-up">
            {/* Title */}
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-wider font-display"
                  style={{
                    fontFamily: 'Cinzel, serif',
                    background: 'linear-gradient(135deg, #ffd700, #f1c40f, #ffffff)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 10px rgba(241, 196, 15, 0.3))',
                  }}>
                BẢNG XẾP HẠNG
              </h2>
              <p className="text-xs tracking-widest uppercase text-soul-blue mt-1 font-display">
                TOP 5 CAO THỦ SHADOW
              </p>
            </div>

            {/* Decorative divider */}
            <div className="w-full h-px opacity-30 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent" />

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-mist text-xs uppercase tracking-wider">
                    <th className="py-2 px-3 text-center">Hạng</th>
                    <th className="py-2 px-3">Người chơi</th>
                    <th className="py-2 px-3 text-center">Cấp</th>
                    <th className="py-2 px-3 text-center">Kills</th>
                    <th className="py-2 px-3 text-right">Điểm số</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardEntries.length > 0 ? (
                    leaderboardEntries.map((entry, idx) => {
                      let rankColor = 'text-light';
                      let rankBg = 'bg-white/5';
                      let rankIcon = '';
                      if (idx === 0) {
                        rankColor = 'text-[#ffd700] font-bold';
                        rankBg = 'bg-[#ffd700]/10 border border-[#ffd700]/30';
                        rankIcon = '🏆 ';
                      } else if (idx === 1) {
                        rankColor = 'text-[#c0c0c0] font-bold';
                        rankBg = 'bg-white/10 border border-white/20';
                        rankIcon = '🥈 ';
                      } else if (idx === 2) {
                        rankColor = 'text-[#cd7f32] font-bold';
                        rankBg = 'bg-[#cd7f32]/10 border border-[#cd7f32]/20';
                        rankIcon = '🥉 ';
                      }

                      return (
                        <tr key={idx} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${rankColor}`}>
                          <td className="py-3 px-3 text-center font-bold">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${rankBg}`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-medium truncate max-w-[140px]">
                            {rankIcon}{entry.name}
                          </td>
                          <td className="py-3 px-3 text-center font-mono">{entry.level}</td>
                          <td className="py-3 px-3 text-center font-mono">{entry.kills}</td>
                          <td className="py-3 px-3 text-right font-bold text-soul-glow font-mono">
                            {entry.score.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-mist italic text-xs">
                        Chưa có kỷ lục nào được ghi nhận.<br />
                        Hãy tham gia chiến đấu để ghi danh bảng vàng!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Date detail */}
            {leaderboardEntries.length > 0 && (
              <p className="text-[10px] text-center text-mist/40 italic">
                Cập nhật lúc: {leaderboardEntries[0]?.date}
              </p>
            )}

            {/* Close Button */}
            <button
              onClick={() => {
                AudioManager.getInstance().playSFX('ui-click');
                setShowLeaderboard(false);
              }}
              className="btn-primary w-full cursor-pointer mt-2"
            >
              Đóng
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
