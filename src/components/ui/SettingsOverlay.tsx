import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import type { KeyBindings } from '../../stores/settingsStore';
import { AudioManager } from '../../game/managers/AudioManager';

interface SettingsOverlayProps {
  onClose: () => void;
}

export function SettingsOverlay({ onClose }: SettingsOverlayProps) {
  const settings = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'audio' | 'graphics' | 'gameplay' | 'controls' | 'guide'>('audio');
  const [rebindingKey, setRebindingKey] = useState<keyof KeyBindings | null>(null);

  // Keyboard & Mouse listener for rebinding
  useEffect(() => {
    if (!rebindingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      
      // Cancel with Escape
      if (e.key === 'Escape') {
        setRebindingKey(null);
        AudioManager.getInstance().playSFX('ui-click');
        return;
      }

      // Convert key name to user-friendly and Phaser-compatible string
      let keyName = e.key.toUpperCase();
      if (keyName === ' ') keyName = 'SPACE';
      if (keyName === 'ARROWUP') keyName = 'UP';
      if (keyName === 'ARROWDOWN') keyName = 'DOWN';
      if (keyName === 'ARROWLEFT') keyName = 'LEFT';
      if (keyName === 'ARROWRIGHT') keyName = 'RIGHT';

      const updatedBindings = { ...settings.keyBindings, [rebindingKey]: keyName };
      settings.setControls({ keyBindings: updatedBindings });
      
      setRebindingKey(null);
      AudioManager.getInstance().playSFX('ui-click');
    };

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      let keyName = '';
      if (e.button === 0) {
        keyName = 'LCLICK';
      } else if (e.button === 2) {
        keyName = 'RCLICK';
      } else {
        return; // Ignore other buttons
      }

      const updatedBindings = { ...settings.keyBindings, [rebindingKey]: keyName };
      settings.setControls({ keyBindings: updatedBindings });

      setRebindingKey(null);
      AudioManager.getInstance().playSFX('ui-click');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Delay adding listeners slightly to avoid capturing the button click that opened the rebinder
    const timer = setTimeout(() => {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('contextmenu', handleContextMenu);
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [rebindingKey, settings]);

  // Sync fullscreen change with document status
  const handleFullscreenToggle = async (checked: boolean) => {
    try {
      if (checked) {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      }
      settings.setGraphics({ fullscreen: checked });
      AudioManager.getInstance().playSFX('ui-click');
    } catch (err) {
      console.error('Failed to toggle fullscreen:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6 select-none pointer-events-auto">
      <style>{`
        /* Pixelated Scrollbar */
        .settings-scrollbar::-webkit-scrollbar {
          width: 12px;
        }
        .settings-scrollbar::-webkit-scrollbar-track {
          background: #08080c;
          border-left: 2px solid #bf953f;
        }
        .settings-scrollbar::-webkit-scrollbar-thumb {
          background: #bf953f;
          border: 2px solid #08080c;
        }
        .settings-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #ffd700;
        }

        /* Retro range slider */
        input[type="range"].pixel-slider {
          -webkit-appearance: none;
          appearance: none;
          background: #161626;
          height: 10px;
          border: 2px solid #4fc3f7;
          outline: none;
        }
        input[type="range"].pixel-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          background: #bf953f;
          border: 2px solid #0c0c14;
          cursor: pointer;
          box-shadow: 0 0 0 2px #bf953f;
        }
        input[type="range"].pixel-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #bf953f;
          border: 2px solid #0c0c14;
          cursor: pointer;
          box-shadow: 0 0 0 2px #bf953f;
        }

        /* Retro checkbox */
        input[type="checkbox"].pixel-checkbox {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          background: #161626;
          border: 2px solid #4fc3f7;
          cursor: pointer;
          position: relative;
          outline: none;
        }
        input[type="checkbox"].pixel-checkbox:checked {
          background: #bf953f;
          border-color: #bf953f;
        }
        input[type="checkbox"].pixel-checkbox:checked::after {
          content: '';
          position: absolute;
          top: 1px;
          left: 5px;
          width: 6px;
          height: 10px;
          border: solid #0c0c14;
          border-width: 0 3px 3px 0;
          transform: rotate(45deg);
        }

        /* Retro dropdown select */
        select.pixel-select {
          -webkit-appearance: none;
          appearance: none;
          background: #161626;
          color: #4fc3f7;
          border: 2px solid #4fc3f7;
          padding: 6px 32px 6px 12px;
          font-family: 'VT323', monospace;
          font-size: 18px;
          cursor: pointer;
          outline: none;
          border-radius: 0;
          background-image: url("data:image/svg+xml;utf8,<svg fill='%234fc3f7' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>");
          background-repeat: no-repeat;
          background-position: right 8px center;
        }
        select.pixel-select:focus {
          border-color: #bf953f;
          color: #ffd700;
        }

        /* Retro mechanical keycaps */
        kbd.pixel-kbd {
          font-family: 'Press Start 2P', monospace;
          font-size: 8px;
          background: #161626;
          color: #ffd700;
          border: 2px solid #bf953f;
          padding: 6px 10px;
          display: inline-block;
          box-shadow: 0 4px 0 #8a6524;
          margin-bottom: 4px;
          border-radius: 0;
        }

        /* Hover effect for buttons */
        .pixel-btn-hover:hover {
          transform: scale(1.03);
          box-shadow: 0 0 12px rgba(79, 195, 247, 0.4);
        }
        .pixel-btn-danger-hover:hover {
          transform: scale(1.03);
          box-shadow: 0 0 12px rgba(255, 102, 102, 0.4);
        }
      `}</style>

      <div 
        className="w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-up"
        style={{
          fontFamily: "'VT323', monospace",
          background: '#0c0c14',
          backgroundImage: 'radial-gradient(circle at center, rgba(20, 20, 36, 1) 0%, rgba(8, 8, 12, 1) 100%)',
          border: '4px solid #bf953f',
          boxShadow: '0 0 0 4px #0c0c14, 0 0 0 8px #4fc3f7, 0 15px 40px rgba(0, 0, 0, 0.95)',
          padding: '24px',
          borderRadius: '0px',
          position: 'relative'
        }}
      >
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '16px' }}>
          <div>
            <h2 style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '18px',
              color: '#ffd700',
              textShadow: '2px 2px 0px #000000',
              margin: '0',
              letterSpacing: '1px'
            }}>
              CÀI ĐẶT & HƯỚNG DẪN
            </h2>
            <p style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '8px',
              color: '#4fc3f7',
              margin: '6px 0 0 0',
              letterSpacing: '1px'
            }}>
              TÙY CHỈNH & HỌC CÁCH CHƠI GAME
            </p>
          </div>
          <button
            onClick={() => {
              AudioManager.getInstance().playSFX('ui-click');
              onClose();
            }}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '14px',
              background: 'transparent',
              color: '#bf953f',
              border: '2px solid #bf953f',
              padding: '6px 10px',
              cursor: 'pointer',
              transition: 'all 0.1s ease',
              lineHeight: '1'
            }}
            className="pixel-btn-hover"
          >
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', width: '100%', marginBottom: '16px' }}>
          {(['audio', 'graphics', 'gameplay', 'controls', 'guide'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                AudioManager.getInstance().playSFX('ui-click');
                setActiveTab(tab);
              }}
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '8px',
                padding: '10px 8px',
                cursor: 'pointer',
                textAlign: 'center',
                flex: '1',
                minWidth: '95px',
                border: activeTab === tab ? '2px solid #bf953f' : '2px solid #4fc3f7',
                background: activeTab === tab ? '#bf953f' : '#161626',
                color: activeTab === tab ? '#0c0c14' : '#4fc3f7',
                textShadow: activeTab === tab ? 'none' : '1px 1px 0px #000000',
                transition: 'all 0.15s ease'
              }}
              className="hover:scale-105"
            >
              {tab === 'audio' && 'ÂM THANH'}
              {tab === 'graphics' && 'ĐỒ HỌA'}
              {tab === 'gameplay' && 'LỐI CHƠI'}
              {tab === 'controls' && 'ĐIỀU KHIỂN'}
              {tab === 'guide' && 'HƯỚNG DẪN'}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div 
          className="flex-1 overflow-y-auto settings-scrollbar" 
          style={{
            paddingRight: '8px',
            fontSize: '18px',
            color: '#a0a0b0',
            fontFamily: "'VT323', monospace",
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          {activeTab === 'audio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Master Volume */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Press Start 2P', monospace", fontSize: '9px', marginBottom: '8px' }}>
                  <span style={{ color: '#ffffff' }}>ÂM LƯỢNG TỔNG</span>
                  <span style={{ color: '#4fc3f7' }}>{Math.round(settings.masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.masterVolume}
                  onChange={(e) => settings.setAudio({ masterVolume: parseFloat(e.target.value) })}
                  className="pixel-slider"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Music Volume */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Press Start 2P', monospace", fontSize: '9px', marginBottom: '8px' }}>
                  <span style={{ color: '#ffffff' }}>NHẠC NỀN</span>
                  <span style={{ color: '#4fc3f7' }}>{Math.round(settings.musicVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.musicVolume}
                  onChange={(e) => settings.setAudio({ musicVolume: parseFloat(e.target.value) })}
                  className="pixel-slider"
                  style={{ width: '100%' }}
                />
              </div>

              {/* SFX Volume */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Press Start 2P', monospace", fontSize: '9px', marginBottom: '8px' }}>
                  <span style={{ color: '#ffffff' }}>HIỆU ỨNG ÂM THANH (SFX)</span>
                  <span style={{ color: '#4fc3f7' }}>{Math.round(settings.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.sfxVolume}
                  onChange={(e) => settings.setAudio({ sfxVolume: parseFloat(e.target.value) })}
                  className="pixel-slider"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}

          {activeTab === 'graphics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Fullscreen */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px',
                background: '#161626',
                border: '2px solid #4fc3f7',
                cursor: 'pointer'
              }}>
                <div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', color: '#ffffff' }}>CHẾ ĐỘ TOÀN MÀN HÌNH</div>
                  <div style={{ fontSize: '18px', color: '#a0a0b0', marginTop: '6px' }}>Bật chế độ fullscreen để tăng trải nghiệm nhập vai</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.fullscreen}
                  onChange={(e) => handleFullscreenToggle(e.target.checked)}
                  className="pixel-checkbox"
                />
              </label>

              {/* Resolution Scale */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Press Start 2P', monospace", fontSize: '9px', marginBottom: '8px' }}>
                  <span style={{ color: '#ffffff' }}>TỶ LỆ ĐỘ PHÂN GIẢI</span>
                  <span style={{ color: '#4fc3f7' }}>{settings.resolutionScale * 100}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.25"
                  value={settings.resolutionScale}
                  onChange={(e) => {
                    settings.setGraphics({ resolutionScale: parseFloat(e.target.value) });
                    AudioManager.getInstance().playSFX('ui-click');
                  }}
                  className="pixel-slider"
                  style={{ width: '100%' }}
                />
              </div>

              {/* VSync */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px',
                background: '#161626',
                border: '2px solid #4fc3f7',
                cursor: 'pointer'
              }}>
                <div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', color: '#ffffff' }}>ĐỒNG BỘ DỌC (VSYNC)</div>
                  <div style={{ fontSize: '18px', color: '#a0a0b0', marginTop: '6px' }}>Giúp ngăn hiện tượng xé hình khi di chuyển nhanh</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.vSync}
                  onChange={(e) => {
                    settings.setGraphics({ vSync: e.target.checked });
                    AudioManager.getInstance().playSFX('ui-click');
                  }}
                  className="pixel-checkbox"
                />
              </label>

              <div style={{ borderTop: '2px dashed rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', color: '#4fc3f7', marginBottom: '14px' }}>
                  ♿ HỖ TRỢ TIẾP CẬN (ACCESSIBILITY)
                </div>
                
                {/* UI Scale */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Press Start 2P', monospace", fontSize: '9px', marginBottom: '8px' }}>
                    <span style={{ color: '#ffffff' }}>TỶ LỆ GIAO DIỆN (UI SCALE)</span>
                    <span style={{ color: '#4fc3f7' }}>{Math.round(settings.uiScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.05"
                    value={settings.uiScale}
                    onChange={(e) => {
                      settings.setAccessibility({ uiScale: parseFloat(e.target.value) });
                    }}
                    className="pixel-slider"
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Font Scale */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Press Start 2P', monospace", fontSize: '9px', marginBottom: '8px' }}>
                    <span style={{ color: '#ffffff' }}>TỶ LỆ CHỮ (FONT SCALE)</span>
                    <span style={{ color: '#4fc3f7' }}>{Math.round(settings.fontScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.05"
                    value={settings.fontScale}
                    onChange={(e) => {
                      settings.setAccessibility({ fontScale: parseFloat(e.target.value) });
                    }}
                    className="pixel-slider"
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Color Blind Mode */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px',
                  background: '#161626',
                  border: '2px solid #4fc3f7',
                  marginTop: '16px'
                }}>
                  <div>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', color: '#ffffff' }}>BỘ LỌC MÙ MÀU</div>
                    <div style={{ fontSize: '18px', color: '#a0a0b0', marginTop: '6px' }}>Điều chỉnh gam màu cho người mù màu</div>
                  </div>
                  <select
                    value={settings.colorBlindMode}
                    onChange={(e) => {
                      settings.setAccessibility({ colorBlindMode: e.target.value as any });
                      AudioManager.getInstance().playSFX('ui-click');
                    }}
                    className="pixel-select"
                  >
                    <option value="none">Không</option>
                    <option value="protanopia">Mù màu đỏ (Protanopia)</option>
                    <option value="deuteranopia">Mù màu lục (Deuteranopia)</option>
                    <option value="tritanopia">Mù màu lam (Tritanopia)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gameplay' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Screen Shake */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px',
                background: '#161626',
                border: '2px solid #4fc3f7',
                cursor: 'pointer'
              }}>
                <div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', color: '#ffffff' }}>RUNG MÀN HÌNH</div>
                  <div style={{ fontSize: '18px', color: '#a0a0b0', marginTop: '6px' }}>Tạo hiệu ứng rung giật khi ra đòn hoặc nhận sát thương</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.screenShake}
                  onChange={(e) => {
                    settings.setGameplay({ screenShake: e.target.checked });
                    AudioManager.getInstance().playSFX('ui-click');
                  }}
                  className="pixel-checkbox"
                />
              </label>

              {/* Show Damage Number */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px',
                background: '#161626',
                border: '2px solid #4fc3f7',
                cursor: 'pointer'
              }}>
                <div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', color: '#ffffff' }}>HIỆN SỐ SÁT THƯƠNG</div>
                  <div style={{ fontSize: '18px', color: '#a0a0b0', marginTop: '6px' }}>Hiện các chỉ số sát thương bay lên khi đánh trúng mục tiêu</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showDamageNumber}
                  onChange={(e) => {
                    settings.setGameplay({ showDamageNumber: e.target.checked });
                    AudioManager.getInstance().playSFX('ui-click');
                  }}
                  className="pixel-checkbox"
                />
              </label>

              {/* Show Critical Effect */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px',
                background: '#161626',
                border: '2px solid #4fc3f7',
                cursor: 'pointer'
              }}>
                <div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', color: '#ffffff' }}>HIỆU ỨNG CHÍ MẠNG ĐẶC BIỆT</div>
                  <div style={{ fontSize: '18px', color: '#a0a0b0', marginTop: '6px' }}>Tạo ngọn lửa đỏ rực rỡ khi gây sát thương chí mạng</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showCriticalEffect}
                  onChange={(e) => {
                    settings.setGameplay({ showCriticalEffect: e.target.checked });
                    AudioManager.getInstance().playSFX('ui-click');
                  }}
                  className="pixel-checkbox"
                />
              </label>
            </div>
          )}

          {activeTab === 'controls' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: '18px', color: '#ffd700', marginBottom: '8px' }}>
                * Nhấp vào phím tương ứng để gán lại. Nhấn <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: '#4fc3f7' }}>ESC</span> để hủy.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                {Object.entries(settings.keyBindings).map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: '#161626',
                      border: '2px solid #4fc3f7'
                    }}
                  >
                    <span style={{ fontSize: '18px', textTransform: 'capitalize', color: '#ffffff' }}>
                      {key === 'up' && 'Nhảy lên / Đi lên'}
                      {key === 'down' && 'Đi xuống'}
                      {key === 'left' && 'Di chuyển trái'}
                      {key === 'right' && 'Di chuyển phải'}
                      {key === 'attack' && 'Tấn công / Bắn'}
                      {key === 'skill1' && 'Chiêu 1 (Q)'}
                      {key === 'skill2' && 'Chiêu 2 (E)'}
                      {key === 'dash' && 'Lướt nhanh (Dash)'}
                      {key === 'ultimate' && 'Chiêu cuối (F)'}
                      {key === 'inventory' && 'Túi đồ (B)'}
                      {key === 'interact' && 'Tương tác (G)'}
                    </span>
                    <button
                      onClick={() => {
                        AudioManager.getInstance().playSFX('ui-click');
                        setRebindingKey(key as keyof KeyBindings);
                      }}
                      style={{
                        minWidth: '85px',
                        padding: '6px 10px',
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: '8px',
                        cursor: 'pointer',
                        background: rebindingKey === key ? '#bf953f' : '#0c0c14',
                        color: rebindingKey === key ? '#0c0c14' : '#4fc3f7',
                        border: rebindingKey === key ? '2px solid #bf953f' : '2px solid #4fc3f7',
                        transition: 'all 0.15s ease'
                      }}
                      className="hover:scale-105"
                    >
                      {rebindingKey === key ? '...' : value}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '20px', color: '#a0a0b0' }}>
              
              {/* Section 1: Movement */}
              <div style={{ background: '#161626', border: '2px solid #4fc3f7', padding: '16px' }}>
                <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', color: '#ffd700', marginBottom: '12px', textShadow: '1px 1px 0px #000' }}>
                  🏃 HỆ THỐNG DI CHUYỂN
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <kbd className="pixel-kbd">A</kbd>
                    <span style={{ color: '#ffffff' }}>Di chuyển sang TRÁI</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <kbd className="pixel-kbd">D</kbd>
                    <span style={{ color: '#ffffff' }}>Di chuyển sang PHẢI</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <kbd className="pixel-kbd">SPACE</kbd>
                    <span style={{ color: '#ffffff' }}>Nhảy lên (Jump)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <kbd className="pixel-kbd">SHIFT</kbd>
                    <span style={{ color: '#ffffff' }}>Lướt nhanh (Dash)</span>
                  </div>
                </div>
                <p style={{ fontSize: '16px', color: '#4fc3f7', marginTop: '12px', fontStyle: 'italic', marginLeft: 0, marginRight: 0 }}>
                  * Sử dụng Lướt nhanh (Dash) để né sát thương từ quái và vượt qua các vực sâu hiểm trở!
                </p>
              </div>

              {/* Section 2: Combat */}
              <div style={{ background: '#161626', border: '2px solid #bf953f', padding: '16px' }}>
                <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', color: '#ffd700', marginBottom: '12px', textShadow: '1px 1px 0px #000' }}>
                  ⚔️ CHIẾN ĐẤU & KỸ NĂNG
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: '#ffd700', background: '#0c0c14', padding: '4px 8px', border: '2px solid #bf953f' }}>CHUỘT TRÁI</span>
                    <span style={{ color: '#ffffff' }}>Tấn công thường</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: '#4fc3f7', background: '#0c0c14', padding: '4px 8px', border: '2px solid #4fc3f7' }}>CHUỘT PHẢI</span>
                    <span style={{ color: '#ffffff' }}>Xem thông tin Quái vật</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <kbd className="pixel-kbd">1</kbd>
                    <kbd className="pixel-kbd">2</kbd>
                    <span style={{ color: '#ffffff' }}>Đổi vũ khí (Kiếm / Súng)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <kbd className="pixel-kbd">R</kbd>
                    <span style={{ color: '#ffffff' }}>Nạp đạn Flintlock</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <kbd className="pixel-kbd">Q</kbd>
                    <kbd className="pixel-kbd">E</kbd>
                    <kbd className="pixel-kbd">F</kbd>
                    <span style={{ color: '#ffffff' }}>Kỹ năng Q / E / Kỹ năng cuối F</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <kbd className="pixel-kbd">B</kbd>
                    <span style={{ color: '#ffffff' }}>Mở / Đóng Túi đồ (Inventory)</span>
                  </div>
                </div>
                <p style={{ fontSize: '16px', color: '#bf953f', marginTop: '12px', fontStyle: 'italic', marginLeft: 0, marginRight: 0 }}>
                  * Tấn công cận chiến bằng Kiếm giúp bạn hồi HP (Hút máu) khi chém trúng quái vật!
                </p>
              </div>

              {/* Section 3: Goal & Crafting */}
              <div style={{ background: '#161626', border: '2px solid #4fc3f7', padding: '16px' }}>
                <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', color: '#ffd700', marginBottom: '12px', textShadow: '1px 1px 0px #000' }}>
                  📜 CHẾ TẠO & MỤC TIÊU TỐI HẬU
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: '#ffffff' }}>
                  <p style={{ margin: 0 }}>
                    1. Thu thập đủ <span style={{ color: '#ffd700', fontWeight: 'bold' }}>5 cuộn tài liệu cổ (📜)</span> rải rác trên bản đồ hoặc rơi từ quái vật/boss.
                  </p>
                  <p style={{ margin: 0 }}>
                    2. Tìm và tiêu diệt <span style={{ color: '#ff6666', fontWeight: 'bold' }}>Hộ Vệ Cổ Đại (Ancient Knight)</span> ở cuối bản đồ.
                  </p>
                  <p style={{ margin: 0 }}>
                    3. Sau khi diệt boss, <span style={{ color: '#4fc3f7', fontWeight: 'bold' }}>Bàn chế tạo</span> sẽ xuất hiện. Đứng cạnh Bàn chế tạo và nhấn <kbd className="pixel-kbd">G</kbd> để ghép tài liệu và giành CHIẾN THẮNG!
                  </p>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid rgba(255,255,255,0.1)', paddingTop: '16px', marginTop: '16px' }}>
          <button
            onClick={() => {
              if (window.confirm('Khôi phục tất cả cài đặt về mặc định?')) {
                AudioManager.getInstance().playSFX('ui-click');
                settings.resetToDefaults();
              }
            }}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '8px',
              padding: '10px 16px',
              border: '2px solid #ff6666',
              background: 'transparent',
              color: '#ff6666',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            className="pixel-btn-danger-hover"
          >
            KHÔI PHỤC MẶC ĐỊNH
          </button>
          <button
            onClick={() => {
              AudioManager.getInstance().playSFX('ui-click');
              onClose();
            }}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '8px',
              padding: '10px 20px',
              border: '2px solid #bf953f',
              background: '#bf953f',
              color: '#0c0c14',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            className="pixel-btn-hover"
          >
            LƯU & ĐÓNG
          </button>
        </div>

      </div>
    </div>
  );
}
