import { useState } from 'react';
import { AudioManager } from '../../game/managers/AudioManager';

interface TutorialPopupProps {
  onClose: () => void;
}

export function TutorialPopup({ onClose }: TutorialPopupProps) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    AudioManager.getInstance().playSFX('ui-click');
    setStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    AudioManager.getInstance().playSFX('ui-click');
    setStep((prev) => prev - 1);
  };

  const handleStart = () => {
    AudioManager.getInstance().playSFX('ui-click');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none pointer-events-auto">
      <div className="w-full max-w-lg bg-[#0c0c14]/95 border border-soul-blue/40 rounded-xl shadow-[0_0_40px_rgba(79,195,247,0.3)] p-6 relative flex flex-col gap-6 animate-scale-up">
        
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-wider font-display"
              style={{
                fontFamily: 'Cinzel, serif',
                background: 'linear-gradient(135deg, #4fc3f7, #81d4fa, #ffffff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 10px rgba(79, 195, 247, 0.35))'
              }}>
            HƯỚNG DẪN TÂN THỦ
          </h2>
          <p className="text-[10px] tracking-widest uppercase text-soul-blue mt-1">
            Bước {step + 1} / 3: {step === 0 && 'Cốt truyện & Mục tiêu'} {step === 1 && 'Hệ thống di chuyển'} {step === 2 && 'Cơ chế chiến đấu'}
          </p>
        </div>

        {/* Decorative divider */}
        <div className="w-full h-px opacity-30 bg-gradient-to-r from-transparent via-soul-blue to-transparent" />

        {/* Content Body */}
        <div className="min-h-[220px] text-sm text-silver flex flex-col justify-center leading-relaxed">
          {step === 0 && (
            <div className="space-y-4 text-center">
              <div className="text-5xl">⚔️</div>
              <p className="font-semibold text-light text-base">Chào mừng bạn đến với vương quốc Shadow!</p>
              <p className="text-xs text-mist">
                Bạn sẽ vào vai chiến binh bóng đêm quả cảm, thâm nhập vào các vùng đất hoang tàn bị xâm chiếm bởi thế lực Void.
              </p>
              <p className="text-xs text-mist">
                Nhiệm vụ của bạn là tiêu diệt quái vật để gia tăng cấp độ sức mạnh, nhặt các cuộn giấy cổ bị thất lạc để giải mã lời tiên tri, và khiêu chiến với Hộ Vệ Cổ Đại (Ancient Knight) ở cuối bản đồ!
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="font-semibold text-light mb-2 text-center">Các phím di chuyển cơ bản:</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/5">
                  <kbd className="px-2 py-0.5 bg-[#161626] border border-[#4fc3f7]/45 rounded font-mono font-bold text-soul-blue shadow-[0_2px_0_rgba(79,195,247,0.25)]">A</kbd>
                  <span>Di chuyển sang TRÁI</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/5">
                  <kbd className="px-2 py-0.5 bg-[#161626] border border-[#4fc3f7]/45 rounded font-mono font-bold text-soul-blue shadow-[0_2px_0_rgba(79,195,247,0.25)]">D</kbd>
                  <span>Di chuyển sang PHẢI</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/5">
                  <kbd className="px-2 py-0.5 bg-[#161626] border border-[#4fc3f7]/45 rounded font-mono font-bold text-soul-blue shadow-[0_2px_0_rgba(79,195,247,0.25)]">W</kbd>
                  <span>Nhảy lên (Jump)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/5">
                  <kbd className="px-1.5 py-0.5 bg-[#161626] border border-[#4fc3f7]/45 rounded font-mono font-bold text-soul-blue text-[9px] shadow-[0_2px_0_rgba(79,195,247,0.25)]">SHIFT</kbd>
                  <span>Lướt nhanh (Dash - né đòn)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/5">
                  <kbd className="px-2 py-0.5 bg-[#161626] border border-[#ffd700]/45 rounded font-mono font-bold text-[#ffd700] shadow-[0_2px_0_rgba(255,215,0,0.25)]">B</kbd>
                  <span>Mở Túi đồ (Inventory)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/5">
                  <kbd className="px-2 py-0.5 bg-[#161626] border border-[#4fc3f7]/45 rounded font-mono font-bold text-soul-blue shadow-[0_2px_0_rgba(79,195,247,0.25)]">ESC</kbd>
                  <span>Tạm dừng (Pause Menu)</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="font-semibold text-light mb-2 text-center">Kỹ năng chiến đấu & Vũ khí:</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 p-1.5 rounded bg-white/5 border border-white/5">
                  <span className="text-soul-blue font-bold">CLICK / SPACE</span>
                  <span>Tấn công thường</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-white/5 border border-white/5">
                  <kbd className="px-2 py-0.5 bg-[#161626] border border-[#4fc3f7]/45 rounded font-mono font-bold text-soul-blue shadow-[0_2px_0_rgba(79,195,247,0.25)]">1</kbd>
                  <kbd className="px-2 py-0.5 bg-[#161626] border border-[#4fc3f7]/45 rounded font-mono font-bold text-soul-blue shadow-[0_2px_0_rgba(79,195,247,0.25)]">2</kbd>
                  <span>Đổi vũ khí Kiếm/Súng</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-white/5 border border-white/5">
                  <kbd className="px-2 py-0.5 bg-[#161626] border border-[#4fc3f7]/45 rounded font-mono font-bold text-soul-blue shadow-[0_2px_0_rgba(79,195,247,0.25)]">R</kbd>
                  <span>Nạp đạn súng (Reload)</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-white/5 border border-white/5">
                  <kbd className="px-2 py-0.5 bg-[#161626] border border-[#4fc3f7]/45 rounded font-mono font-bold text-soul-blue shadow-[0_2px_0_rgba(79,195,247,0.25)]">Q</kbd>
                  <span>Chiêu 1 (Cầu lửa / Đạn điện)</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-white/5 border border-white/5">
                  <kbd className="px-2 py-0.5 bg-[#161626] border border-[#4fc3f7]/45 rounded font-mono font-bold text-soul-blue shadow-[0_2px_0_rgba(79,195,247,0.25)]">E</kbd>
                  <span>Chiêu 2 (Vùng làm chậm)</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-white/5 border border-white/5">
                  <kbd className="px-2 py-0.5 bg-[#161626] border border-[#4fc3f7]/45 rounded font-mono font-bold text-soul-blue shadow-[0_2px_0_rgba(79,195,247,0.25)]">F</kbd>
                  <span>Chiêu cuối (Bộc phá AoE)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex justify-between mt-2">
          {step > 0 ? (
            <button
              onClick={handlePrev}
              className="px-4 py-2 border border-soul-blue/30 text-soul-blue hover:bg-soul-blue/10 rounded font-bold text-xs transition-all cursor-pointer"
            >
              Quay lại
            </button>
          ) : (
            <div />
          )}

          {step < 2 ? (
            <button
              onClick={handleNext}
              className="px-5 py-2 bg-soul-blue text-void font-bold rounded text-xs transition-all hover:bg-soul-glow hover:shadow-[0_0_12px_rgba(79,195,247,0.4)] cursor-pointer"
            >
              Tiếp theo
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="px-6 py-2 bg-gradient-to-r from-soul-blue to-soul-glow text-void font-extrabold rounded text-xs transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(79,195,247,0.6)] cursor-pointer"
            >
              Bắt đầu Chiến đấu
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
