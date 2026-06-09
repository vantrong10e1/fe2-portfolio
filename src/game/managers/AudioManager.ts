import EventBus from '../EventBus';
import { useSettingsStore } from '../../stores/settingsStore';

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  
  private masterVolume: number = 1;
  private musicVolume: number = 0.8;
  private sfxVolume: number = 1;

  private currentBgmKey: string = '';
  private sequencerInterval: any = null;
  private stepCounter: number = 0;
  private bossPhase: number = 0;

  private constructor() {
    const init = () => {
      this.initContext();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('click', init, { once: false });
      window.addEventListener('keydown', init, { once: false });
    }

    // Sync with settings store
    const settings = useSettingsStore.getState();
    this.masterVolume = settings.masterVolume;
    this.musicVolume = settings.musicVolume;
    this.sfxVolume = settings.sfxVolume;

    useSettingsStore.subscribe((state) => {
      this.masterVolume = state.masterVolume;
      this.musicVolume = state.musicVolume;
      this.sfxVolume = state.sfxVolume;
      this.updateVolumes();
    });

    EventBus.on('audio-mute', (mute: boolean) => {
      this.isMuted = mute;
      this.updateVolumes();
      if (mute) {
        this.stopSequencer();
      } else if (this.currentBgmKey) {
        this.playBgm(this.currentBgmKey);
      }
    });
  }

  private updateVolumes(): void {
    if (!this.masterGain || !this.ctx) return;
    const finalMaster = this.isMuted ? 0 : this.masterVolume;
    this.masterGain.gain.setValueAtTime(finalMaster, this.ctx.currentTime);
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private initContext(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // MUSIC SEQUENCER (BGM Arpeggiator)
  // ══════════════════════════════════════════════════════════════════════

  public playBgm(key: string): void {
    this.initContext();
    this.currentBgmKey = key;
    if (this.isMuted) return;

    this.stopSequencer();

    let bpm = 120;
    if (key === 'menu') bpm = 100;
    if (key === 'boss') {
      if (this.bossPhase === 1) bpm = 145;
      else if (this.bossPhase === 2) bpm = 170;
      else bpm = 120;
    }

    const stepMs = (60000 / bpm) / 2; // eighth notes
    this.stepCounter = 0;

    this.sequencerInterval = setInterval(() => {
      this.tickSequencer();
    }, stepMs);
  }

  public setBossPhase(phase: number): void {
    if (this.bossPhase !== phase) {
      this.bossPhase = phase;
      if (this.currentBgmKey === 'boss') {
        this.playBgm('boss');
      }
    }
  }

  public stopBgm(): void {
    this.bossPhase = 0;
    this.stopSequencer();
  }

  private stopSequencer(): void {
    if (this.sequencerInterval) {
      clearInterval(this.sequencerInterval);
      this.sequencerInterval = null;
    }
  }

  private tickSequencer(): void {
    if (!this.ctx || this.ctx.state === 'suspended' || this.isMuted) return;

    const t = this.ctx.currentTime;
    const step = this.stepCounter % 8;
    this.stepCounter++;

    if (this.currentBgmKey === 'menu') {
      // Slow arpeggio in A minor (Triangle wave pad)
      const menuNotes = [110.00, 130.81, 164.81, 220.00, 261.63, 329.63, 261.63, 220.00]; // A2, C3, E3, A3, C4, E4, C4, A3
      const freq = menuNotes[step];
      this.playSynthNote(freq, 'triangle', 0.16, 0.28, t);

    } else if (this.currentBgmKey === 'gameplay') {
      // E minor bassline + hi-hat tick
      const baseNotes = [82.41, 82.41, 98.00, 110.00, 82.41, 82.41, 73.42, 73.42]; // E2, E2, G2, A2, E2, E2, D2, D2
      const freq = baseNotes[step];
      
      // Bass note (triangle)
      this.playSynthNote(freq, 'triangle', 0.22, 0.25, t);

      // Hi-hat tick on off-beats (steps 2, 4, 6, 8)
      if (step % 2 === 1) {
        this.playNoiseTick(0.04, 0.03, t);
      }

    } else if (this.currentBgmKey === 'boss') {
      // Frantic D minor arpeggio (Sawtooth wave + high pitch bass)
      const bossNotes = [146.83, 174.61, 220.00, 293.66, 349.23, 293.66, 220.00, 174.61]; // D3, F3, A3, D4, F4, D4, A3, F3
      const freq = bossNotes[step];

      // Sawtooth lead
      this.playSynthNote(freq, 'sawtooth', 0.08, 0.15, t);

      // Heavy pulsing bass note on beat
      if (step % 4 === 0) {
        this.playSynthNote(73.42, 'sawtooth', 0.25, 0.35, t); // D2
      }
      
      // Fast hi-hat ticker
      this.playNoiseTick(0.03, 0.02, t);
    }
  }

  private playSynthNote(freq: number, type: OscillatorType, volume: number, duration: number, startTime: number, isSFX: boolean = false): void {
    if (!this.ctx || !this.masterGain) return;

    const finalVolume = volume * (isSFX ? this.sfxVolume : this.musicVolume);
    if (finalVolume <= 0.0001) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(finalVolume, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  private playNoiseTick(volume: number, duration: number, startTime: number, isSFX: boolean = false): void {
    if (!this.ctx || !this.masterGain) return;

    const finalVolume = volume * (isSFX ? this.sfxVolume : this.musicVolume);
    if (finalVolume <= 0.0001) return;

    // Create a very short buffer of white noise
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(finalVolume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SOUND EFFECTS GENERATORS
  // ══════════════════════════════════════════════════════════════════════

  public playSFX(key: string): void {
    this.initContext();
    if (!this.ctx || this.ctx.state === 'suspended' || this.isMuted || !this.masterGain) return;
    if (this.sfxVolume <= 0.0001) return;

    const t = this.ctx.currentTime;

    switch (key) {
      case 'sword-attack':
        this.synthWhoosh(t);
        break;
      case 'gun-shot':
        this.synthShot(t);
        break;
      case 'reload':
        this.synthReload(t);
        break;
      case 'fireball':
        this.synthFireball(t);
        break;
      case 'dash':
        this.synthDash(t);
        break;
      case 'inventory':
        this.synthPluck(600, 0.15, 0.15, t);
        break;
      case 'item-pickup':
        this.synthPluck(800, 0.25, 0.12, t);
        this.synthPluck(1200, 0.25, 0.15, t + 0.08);
        break;
      case 'ui-click':
        this.synthPluck(1000, 0.25, 0.08, t);
        break;
      case 'enemy-hit':
        this.synthPunch(t);
        break;
      case 'enemy-death':
        this.synthDeathDesc(t);
        break;
      case 'boss-skill':
        this.synthChargeRumble(t);
        break;
      case 'boss-death':
        this.synthBossMeltdown(t);
        break;
      case 'victory':
        this.synthVictoryChords(t);
        break;
      case 'achievement':
        this.synthAchievementUnlock(t);
        break;
    }
  }

  private synthWhoosh(startTime: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, startTime);
    osc.frequency.exponentialRampToValueAtTime(800, startTime + 0.12);

    gain.gain.setValueAtTime(0.35 * this.sfxVolume, startTime);
    gain.gain.linearRampToValueAtTime(0.0001, startTime + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.16);
  }

  private synthShot(startTime: number): void {
    if (!this.ctx || !this.masterGain) return;

    // Shot noise buffer
    const duration = 0.12;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, startTime);
    filter.frequency.exponentialRampToValueAtTime(200, startTime + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6 * this.sfxVolume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  private synthReload(startTime: number): void {
    // Two quick high clicks
    this.synthPluck(1500, 0.2, 0.05, startTime);
    this.synthPluck(1200, 0.2, 0.05, startTime + 0.15);
  }

  private synthFireball(startTime: number): void {
    if (!this.ctx || !this.masterGain) return;
    // Rising sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, startTime);
    osc.frequency.exponentialRampToValueAtTime(500, startTime + 0.25);

    gain.gain.setValueAtTime(0.25 * this.sfxVolume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.3);
  }

  private synthDash(startTime: number): void {
    if (!this.ctx || !this.masterGain) return;
    // Fast whoosh noise
    const duration = 0.22;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, startTime);
    filter.frequency.exponentialRampToValueAtTime(2500, startTime + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35 * this.sfxVolume, startTime);
    gain.gain.linearRampToValueAtTime(0.0001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  private synthPluck(freq: number, volume: number, duration: number, startTime: number): void {
    if (!this.ctx || !this.masterGain) return;
    const finalVolume = volume * this.sfxVolume;
    if (finalVolume <= 0.0001) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(finalVolume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  private synthPunch(startTime: number): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.sfxVolume <= 0.0001) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, startTime);
    osc.frequency.exponentialRampToValueAtTime(45, startTime + 0.12);

    gain.gain.setValueAtTime(0.45 * this.sfxVolume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.15);
  }

  private synthDeathDesc(startTime: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, startTime);
    osc.frequency.linearRampToValueAtTime(40, startTime + 0.45);

    gain.gain.setValueAtTime(0.3 * this.sfxVolume, startTime);
    gain.gain.linearRampToValueAtTime(0.0001, startTime + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.46);
  }

  private synthChargeRumble(startTime: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, startTime);
    osc.frequency.linearRampToValueAtTime(180, startTime + 0.35);

    gain.gain.setValueAtTime(0.4 * this.sfxVolume, startTime);
    gain.gain.linearRampToValueAtTime(0.0001, startTime + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.36);
  }

  private synthBossMeltdown(startTime: number): void {
    // Chain of descending rumble explosions
    for (let i = 0; i < 5; i++) {
      this.synthPunch(startTime + i * 0.18);
    }
  }

  private synthVictoryChords(startTime: number): void {
    // ascending major chord notes C4, E4, G4, C5, E5, G5
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      this.playSynthNote(freq, 'triangle', 0.22, 0.6, startTime + idx * 0.08);
    });
  }

  private synthAchievementUnlock(startTime: number): void {
    // ascending celebratory chiptune arpeggio C5 -> E5 -> G5 -> C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      this.playSynthNote(freq, 'triangle', 0.2, 0.4, startTime + idx * 0.08);
    });
  }
}
