import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Square, Timer, Settings as SettingsIcon, Volume2, VolumeX, X, Wind, Sparkles, Music, Droplets, Sun, Award } from 'lucide-react';

// --- CONSTANTS ---
enum BreathPhase {
  IDLE = 'IDLE',
  INHALE = 'INHALE',
  EXHALE = 'EXHALE',
  HOLD = 'HOLD'
}

type Language = 'fr' | 'en';

const TEXTS = {
  fr: {
    inhale: "Inspirez", exhale: "Expirez", start: "Commencer", stop: "Arrêter",
    settings: "Paramètres", duration: "Durée de séance", character: "Guide Visuel",
    sound: "Ambiance Sonore", sfx: "Signal Respiratoire", sfxEcho: "Écho Marin",
    sfxLight: "Abysses", sfxPulsar: "Pulsar", sfxBubbles: "Bulles",
    theme: "Thème", themeOcean: "Océan", themeMidnight: "Minuit", themeDisco: "Disco", themeAbyss: "Abysses",
    soundDeep: "Grands Fonds", soundTrench: "Profondeurs", stats: "Mon Parcours",
    totalSessions: "Sessions", minutes: "min", notifications: "Rappel Quotidien",
    notificationsOn: "Activé", notificationsOff: "Désactivé", saveSettings: "Sauvegarder",
    plankton: "Guidage Lumineux", animals: { turtle: "Tortue", octopus: "Poulpe", manta: "Raie Manta", jellyfish: "Méduse" } as Record<string, string>,
    guidanceInhale: ["Inspirez par le nez...", "Le ventre se gonfle...", "L'air circule librement...", "Fluide et régulier...", "Ouvrez la cage thoracique..."],
    guidanceExhale: ["Expirez par la bouche...", "Comme dans une paille...", "Videz tout l'air...", "Le rythme ralentit...", "Le cœur s'apaise..."],
    lang: "Langue"
  },
  en: {
    inhale: "Inhale", exhale: "Exhale", start: "Start", stop: "Stop",
    settings: "Settings", duration: "Session Duration", character: "Visual Guide",
    sound: "Soundscape", sfx: "Breathing Cue", sfxEcho: "Ocean Echo",
    sfxLight: "Abyss", sfxPulsar: "Pulsar", sfxBubbles: "Bubbles",
    theme: "Theme", themeOcean: "Ocean", themeMidnight: "Midnight", themeDisco: "Disco", themeAbyss: "Abyss",
    soundDeep: "Deep Sea", soundTrench: "The Trench", stats: "My Journey",
    totalSessions: "Sessions", minutes: "min", notifications: "Daily Reminder",
    notificationsOn: "On", notificationsOff: "Off", saveSettings: "Save Preferences",
    plankton: "Luminous Guidance", animals: { turtle: "Turtle", octopus: "Octopus", manta: "Manta Ray", jellyfish: "Jellyfish" } as Record<string, string>,
    guidanceInhale: ["Inhale through the nose...", "Belly expands...", "Air flows freely...", "Smooth and steady...", "Open your chest..."],
    guidanceExhale: ["Exhale through the mouth...", "Slowly, like through a straw...", "Empty all the air...", "Rhythm slowing down...", "Heart is settling..."],
    lang: "Language"
  }
};

// --- RICH AUDIO SERVICE ---
class AudioService {
  context: AudioContext | null = null;
  ambientGain: GainNode | null = null;
  activeNodes: AudioNode[] = [];
  runningNotes: Set<AudioScheduledSourceNode> = new Set();
  isAmbientMuted = true;
  currentSoundType = 'deep';
  currentSfxType = 'bubbles';
  isBreathing = false;
  schedulerTimer: any = null;
  nextNoteTime = 0;
  nextPhaseIsInhale = true;
  breathConfig = { inhale: 5, exhale: 5 };

  getContext() {
    if (!this.context) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.context = new AudioContextClass();
    }
    return this.context!;
  }

  async resume() {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  async suspend() {
    if (this.context && this.context.state === 'running') {
      await this.context.suspend();
    }
  }

  track(node: AudioScheduledSourceNode) {
    this.runningNotes.add(node);
    node.onended = () => this.runningNotes.delete(node);
    return node;
  }

  stopAllNotes() {
    this.runningNotes.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {
        // Ignore errors if already stopped
      }
    });
    this.runningNotes.clear();
  }

  setSoundType(type: string) { 
    if (this.currentSoundType === type && this.ambientGain) return;
    this.currentSoundType = type; 
    if(!this.isAmbientMuted) this.restartAmbient(); 
  }
  setSfxType(type: string) { this.currentSfxType = type; }

  setAmbientEnabled(enabled: boolean) {
    this.isAmbientMuted = !enabled;
    enabled ? this.startAmbient() : this.stopAmbient();
  }

  startAmbient() {
    if(this.isAmbientMuted || this.ambientGain) return;
    const ctx = this.getContext();
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.0001;
    this.ambientGain.connect(ctx.destination);
    this.ambientGain.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + 2);
    this.createAmbientNodes(ctx);
  }

  restartAmbient() { 
    this.stopAmbient(); 
    setTimeout(() => this.startAmbient(), 650); 
  }

  // Generators
  createPinkNoise(ctx: AudioContext) {
    const bufferSize = 10 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
    }
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    return node;
  }

  createBrownNoise(ctx: AudioContext) {
    const bufferSize = 10 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; 
    }
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    return node;
  }

  createAmbientNodes(ctx: AudioContext) {
    if (this.currentSoundType === 'deep') {
        const noise = this.createBrownNoise(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.08; 
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 60;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = 45;
        const subGain = ctx.createGain();
        subGain.gain.value = 0.15; 

        noise.connect(filter);
        filter.connect(this.ambientGain!);
        sub.connect(subGain);
        subGain.connect(this.ambientGain!);

        noise.start();
        lfo.start();
        sub.start();
        this.activeNodes.push(noise, filter, lfo, lfoGain, sub, subGain);
    } else {
        const noise = this.createPinkNoise(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 120; 
        filter.Q.value = 3; 
        
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.05; 
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 30;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        const sub = ctx.createOscillator();
        sub.type = 'triangle';
        sub.frequency.value = 38;
        const subGain = ctx.createGain();
        subGain.gain.value = 0.12; 

        noise.connect(filter);
        filter.connect(this.ambientGain!);
        sub.connect(subGain);
        subGain.connect(this.ambientGain!);

        noise.start();
        lfo.start();
        sub.start();
        this.activeNodes.push(noise, filter, lfo, lfoGain, sub, subGain);
    }
  }

  stopAmbient() {
    // Prevent creating context just to stop it
    if (!this.context) return; 

    if(this.ambientGain) {
        const g = this.ambientGain;
        const nodes = [...this.activeNodes];
        this.ambientGain = null;
        this.activeNodes = [];
        try { 
            // Aggressive ramp down to prevent popping
            g.gain.cancelScheduledValues(this.context.currentTime);
            g.gain.setValueAtTime(g.gain.value, this.context.currentTime);
            g.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.1); 
        } catch(e){}
        setTimeout(() => { g.disconnect(); nodes.forEach(n => { try { n.disconnect(); (n as any).stop?.(); } catch(e){} }); }, 200);
    }
  }

  startBreathingLoop(inhaleMs: number, exhaleMs: number) {
    this.breathConfig = { inhale: inhaleMs / 1000, exhale: exhaleMs / 1000 };
    if (this.isBreathing) return;
    this.isBreathing = true;
    this.nextPhaseIsInhale = true;
    const ctx = this.getContext();
    // Start slightly in the future to ensure sync
    this.nextNoteTime = ctx.currentTime + 0.1;
    this.scheduler();
  }
  
  stopBreathingLoop() { 
    this.isBreathing = false; 
    if (this.schedulerTimer) {
        clearTimeout(this.schedulerTimer);
        this.schedulerTimer = null;
    }
    // CRITICAL: Stop any scheduled/playing notes immediately
    this.stopAllNotes();
  }

  scheduler() {
    if (!this.isBreathing) return;
    const ctx = this.getContext();
    // Lookahead
    while (this.nextNoteTime < ctx.currentTime + 1.5) {
        this.scheduleNote(this.nextNoteTime);
    }
    this.schedulerTimer = setTimeout(() => this.scheduler(), 250);
  }

  scheduleNote(time: number) {
    if (this.nextPhaseIsInhale) {
        this.playInhale(time);
        this.nextNoteTime += this.breathConfig.inhale;
    } else {
        this.playExhaleCue(time);
        this.nextNoteTime += this.breathConfig.exhale;
    }
    this.nextPhaseIsInhale = !this.nextPhaseIsInhale;
  }

  playInhale(t: number) {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g); g.connect(ctx.destination);
    
    this.track(osc);
    osc.start(t); osc.stop(t+0.2);
  }

  playExhaleCue(t: number) {
    const ctx = this.getContext();
    switch(this.currentSfxType) {
        case 'pulsar': this.playPulsar(ctx, t); break;
        case 'bubbles': this.playBubbles(ctx, t); break;
        case 'light': this.playLightCue(ctx, t); break;
        case 'echo': default: this.playOceanEcho(ctx, t); break;
    }
  }

  playPulsar(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, t); 
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.3); 
    
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(140, t);
    osc2.frequency.exponentialRampToValueAtTime(90, t + 0.3);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1.0, t + 0.05); 
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.linearRampToValueAtTime(0.3, t + 0.05); 
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc.connect(gain); osc2.connect(gain2);
    gain.connect(ctx.destination); gain2.connect(ctx.destination);
    
    this.track(osc);
    this.track(osc2);
    osc.start(t); osc.stop(t + 0.9);
    osc2.start(t); osc2.stop(t + 0.9);
  }

  playBubbles(ctx: AudioContext, t: number) {
    const noise = this.createPinkNoise(ctx);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(0.4, t + 0.1);
    noiseGain.gain.linearRampToValueAtTime(0, t + 0.6);
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(200, t);
    noiseFilter.frequency.linearRampToValueAtTime(100, t + 0.6);

    noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(ctx.destination);
    
    this.track(noise);
    noise.start(t); noise.stop(t + 0.7);

    for(let i=0; i<6; i++) {
        const startOffset = Math.random() * 0.4; 
        const duration = 0.1 + Math.random() * 0.1;
        const startFreq = 200 + Math.random() * 400;
        const endFreq = startFreq + 100 + Math.random() * 200;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, t + startOffset);
        osc.frequency.linearRampToValueAtTime(endFreq, t + startOffset + duration);
        const bGain = ctx.createGain();
        bGain.gain.setValueAtTime(0, t + startOffset);
        bGain.gain.linearRampToValueAtTime(0.15, t + startOffset + (duration*0.2));
        bGain.gain.exponentialRampToValueAtTime(0.001, t + startOffset + duration);
        osc.connect(bGain); bGain.connect(ctx.destination);
        
        this.track(osc);
        osc.start(t + startOffset); osc.stop(t + startOffset + duration + 0.05);
    }
  }

  playLightCue(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(80, t); 
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.8, t + 0.1); 
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2); 
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 600;
    osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    
    this.track(osc);
    osc.start(t); osc.stop(t + 1.3);
  }

  playOceanEcho(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.setValueAtTime(300, t); 
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.2); 
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, t);
    oscGain.gain.linearRampToValueAtTime(0.5, t + 0.15); 
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    const delay = ctx.createDelay(); delay.delayTime.value = 0.4; 
    const feedback = ctx.createGain(); feedback.gain.value = 0.25; 
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 350; 
    osc.connect(oscGain); oscGain.connect(ctx.destination); 
    oscGain.connect(delay); delay.connect(filter); filter.connect(feedback); feedback.connect(delay); delay.connect(ctx.destination); 
    
    this.track(osc);
    osc.start(t); osc.stop(t + 0.6);
    setTimeout(() => { try { delay.disconnect(); } catch(e){} }, 3000);
  }

  playChime() {
    const ctx = this.getContext();
    const t = ctx.currentTime;
    [196, 293, 392].forEach(f => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.1, t+0.5);
        g.gain.exponentialRampToValueAtTime(0.001, t+4);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t+4);
        // We don't track chimes as they are intended to ring out
    });
  }
}

const audioService = new AudioService();

// --- COMPONENTS ---

const Seaweed = ({ delay, x, height, scale, colorClass }: any) => (
  <div className={`absolute bottom-0 animate-sway origin-bottom ${colorClass}`} style={{ left: x, animationDelay: delay, transform: `scale(${scale})` }}>
     <svg width="60" height={height} viewBox="0 0 60 200" preserveAspectRatio="none"><path d="M30 200 Q 60 150 30 100 T 30 0" stroke="currentColor" strokeWidth="20" fill="none" strokeLinecap="round" /></svg>
  </div>
);

const WhiteGlimmer = ({ top, left, delay, size, isDisco }: any) => (
    <div className={`absolute rounded-full animate-glimmer ${isDisco ? 'bg-white shadow-[0_0_15px_rgba(255,255,255,1)]' : 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]'}`} style={{ top, left, width: size, height: size, animationDelay: delay }} />
);

const DiscoParty = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:50px_50px] animate-spin opacity-20 duration-[20s]" />
      <div className="absolute top-[20%] left-[-20%] w-48 h-24 animate-swim-fast opacity-60 text-fuchsia-400">
         <svg viewBox="0 0 100 50" fill="currentColor"><path d="M10,25 Q30,5 60,20 T95,25 Q80,45 50,40 T10,25 M40,20 L45,5 L55,20" /><circle cx="85" cy="22" r="2" fill="white" /></svg>
      </div>
  </div>
);

const AnglerFish = ({ top, delay, duration }: any) => (
    <div className="absolute left-[-50vw] w-32 h-24 animate-drift-pass opacity-90 text-slate-900 z-10" style={{ top, animationDelay: delay, animationDuration: duration }}>
        <svg viewBox="0 0 100 80" fill="currentColor" className="overflow-visible"><path d="M20,40 Q40,10 80,40 Q60,70 20,40" /><path d="M20,40 L10,30 L10,50 Z" /><path d="M70,25 Q80,10 90,15" stroke="currentColor" strokeWidth="1" fill="none" /><circle cx="90" cy="15" r="4" fill="#a5f3fc" className="animate-pulse shadow-[0_0_20px_rgba(165,243,252,1)]" /><circle cx="70" cy="35" r="1.5" fill="#334155" /></svg>
    </div>
);

const GulperEel = ({ top, delay, duration }: any) => (
    <div className="absolute right-[-50vw] w-64 h-16 animate-eel-swim opacity-20 text-slate-900 z-10" style={{ top, animationDelay: delay, animationDuration: duration }}>
        <svg viewBox="0 0 300 60" fill="none" stroke="currentColor"><path d="M280,30 Q250,0 200,20" strokeWidth="2" /><path d="M280,30 Q250,60 200,40" strokeWidth="2" /><path d="M200,20 Q100,20 50,30 Q20,35 0,30" strokeWidth="4" strokeLinecap="round" /><circle cx="0" cy="30" r="3" fill="#f43f5e" stroke="none" className="animate-pulse shadow-[0_0_10px_#f43f5e]" /></svg>
    </div>
);

const Submarine = () => (
    <div className="absolute top-[15%] left-[-30%] w-24 h-12 animate-sub-pass opacity-30 text-slate-800 z-0">
        <svg viewBox="0 0 100 50" fill="currentColor"><ellipse cx="50" cy="25" rx="40" ry="15" /><rect x="40" y="5" width="20" height="10" rx="2" /><rect x="48" y="0" width="4" height="8" /><circle cx="30" cy="25" r="2" fill="#fcd34d" className="animate-pulse opacity-50" /><circle cx="50" cy="25" r="2" fill="#fcd34d" className="animate-pulse opacity-50" /><circle cx="70" cy="25" r="2" fill="#fcd34d" className="animate-pulse opacity-50" /><path d="M10,25 L5,15 L5,35 Z" className="animate-spin origin-[10px_25px]" /></svg>
    </div>
);

const AbyssAmbience = () => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:100px_100px] animate-[float_10s_linear_infinite]" />
        <div className="absolute top-[20%] left-[10%] w-2 h-2 rounded-full bg-cyan-400 blur-sm animate-[pulse_4s_ease-in-out_infinite] opacity-60" />
        <div className="absolute top-[70%] left-[80%] w-3 h-3 rounded-full bg-teal-500 blur-md animate-[pulse_6s_ease-in-out_infinite] opacity-40 animation-delay-2000" />
        <Submarine /><AnglerFish top="35%" delay="5s" duration="45s" /><GulperEel top="70%" delay="15s" duration="50s" />
    </div>
);

const OceanBackground = ({ theme, planktonEnabled, phase }: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    let particles: any[] = [];
    let animId: number;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    resize();

    class Particle {
       x: number; y: number; size: number; speedX: number; speedY: number; opacity: number; hue: number;
       constructor() {
           this.x = Math.random() * canvas!.width;
           this.y = Math.random() * canvas!.height;
           this.size = Math.random() * 2 + 0.5;
           this.speedX = Math.random() * 0.5 - 0.25;
           this.speedY = Math.random() * 0.5 - 0.25;
           this.opacity = Math.random() * 0.5 + 0.1;
           this.hue = Math.random() * 360;
       }
       update() {
           this.x += this.speedX; this.y += this.speedY;
           if(planktonEnabled) {
               const dx = this.x - canvas!.width/2; const dy = this.y - canvas!.height/2;
               const d = Math.sqrt(dx*dx + dy*dy) || 1;
               const speed = 0.5;
               if(phaseRef.current === BreathPhase.INHALE) { this.x += (dx/d)*speed; this.y += (dy/d)*speed; }
               else if(phaseRef.current === BreathPhase.EXHALE) { this.x -= (dx/d)*speed; this.y -= (dy/d)*speed; }
           }
           if(this.x < 0) this.x = canvas!.width; if(this.x > canvas!.width) this.x = 0;
           if(this.y < 0) this.y = canvas!.height; if(this.y > canvas!.height) this.y = 0;
           if(theme === 'disco') this.hue += 2;
       }
       draw() {
           if(theme === 'disco') ctx!.fillStyle = `hsla(${this.hue}, 100%, 70%, ${this.opacity})`;
           else if(theme === 'abyss') ctx!.fillStyle = `rgba(255, 255, 255, ${this.opacity * 0.1})`;
           else ctx!.fillStyle = `rgba(204, 251, 241, ${this.opacity})`;
           ctx!.beginPath(); ctx!.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx!.fill();
       }
    }
    
    const count = theme === 'disco' ? 120 : (theme === 'abyss' ? 60 : 80);
    for(let i=0; i<count; i++) particles.push(new Particle());
    const animate = () => { ctx!.clearRect(0,0,canvas.width, canvas.height); particles.forEach(p => { p.update(); p.draw(); }); animId = requestAnimationFrame(animate); };
    animate();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId); };
  }, [theme, planktonEnabled]);

  const getBg = () => {
     if(theme === 'midnight') return 'bg-gradient-to-b from-slate-950 to-black';
     if(theme === 'disco') return 'bg-gradient-to-br from-indigo-900 to-fuchsia-900';
     if(theme === 'abyss') return 'bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-slate-900 via-black to-[#02040a]';
     return 'bg-gradient-to-b from-[#0f2e40] to-[#020617]';
  }
  
  const isDisco = theme === 'disco';
  const isAbyss = theme === 'abyss';
  const seaweedConfig = isDisco ? { color: 'text-fuchsia-950/40', containerClass: 'bottom-[-60px] blur-[2px]' } : 
                        isAbyss ? { color: 'text-slate-950/80', containerClass: 'bottom-[-120px] blur-sm scale-90 opacity-60' } :
                        { color: 'text-slate-900/30', containerClass: 'bottom-[-60px] blur-[2px]' };

  return (
     <div className={`absolute inset-0 z-0 overflow-hidden transition-colors duration-1000 ${getBg()}`}>
         <div className={`absolute inset-0 bg-gradient-to-t pointer-events-none from-black/60 via-transparent to-transparent`} />
         
         {!isAbyss && (
            <>
                <div className={`absolute top-[-10%] left-[10%] w-[400px] h-[150vh] bg-gradient-to-b transform -rotate-12 blur-3xl pointer-events-none animate-pulse-slow ${isDisco ? 'from-fuchsia-500/20 via-purple-500/10' : 'from-teal-500/5 via-teal-500/2'} to-transparent`} />
                <div className={`absolute top-[-10%] right-[10%] w-[300px] h-[150vh] bg-gradient-to-b transform rotate-12 blur-3xl pointer-events-none ${isDisco ? 'from-cyan-500/20 via-blue-500/10' : 'from-cyan-400/5 via-cyan-400/2'} to-transparent`} />
            </>
         )}
         
         {isDisco && <DiscoParty />}
         {isAbyss && <AbyssAmbience />}

         <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

         {!isAbyss && (
           <>
               <WhiteGlimmer top="20%" left="15%" delay="0s" size="2px" isDisco={isDisco} />
               <WhiteGlimmer top="60%" left="30%" delay="3s" size="2px" isDisco={isDisco} />
               <WhiteGlimmer top="15%" left="60%" delay="4s" size="2px" isDisco={isDisco} />
           </>
         )}

         <div className={`absolute left-0 right-0 h-64 w-full pointer-events-none flex justify-around items-end transition-all duration-1000 ${seaweedConfig.containerClass}`}>
            <Seaweed x="5%" delay="0s" height="300" scale={1.2} colorClass={seaweedConfig.color} />
            <Seaweed x="25%" delay="1s" height="250" scale={1} colorClass={seaweedConfig.color} />
            <Seaweed x="85%" delay="0.5s" height="220" scale={1.1} colorClass={seaweedConfig.color} />
         </div>
     </div>
  );
};

// 2. Animals with Bubbles
const Turtle = ({ phase, theme }: any) => {
  const bubbles = useMemo(() => Array.from({ length: 14 }).map((_, i) => ({
    id: i,
    left: 45 + (Math.random() * 10 - 5),
    delay: i * 0.2 + Math.random() * 0.5,
    duration: 2.5 + Math.random() * 1.5,
    size: 2 + Math.random() * 2
  })), []);
  return (
  <div className={`relative w-64 h-64 md:w-80 md:h-80 transition-transform duration-[5000ms] ${phase === BreathPhase.IDLE ? 'animate-float' : ''}`}>
     <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20 overflow-visible">
        {phase === BreathPhase.EXHALE && bubbles.map((b) => (
          <div key={b.id} className="bubble opacity-0 animate-bubble-rise" style={{ animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s`, left: `${b.left}%`, top: '25%', width: `${b.size * 3}px`, height: `${b.size * 3}px` }} />
        ))}
     </div>
     <svg viewBox="0 0 200 200" fill="none" className="w-full h-full drop-shadow-2xl">
        <circle cx="100" cy="100" r="70" fill="rgba(255,255,255,0.05)" className={`transition-all duration-[5000ms] blur-xl ${phase === BreathPhase.INHALE ? 'scale-110 opacity-60' : 'scale-100 opacity-20'}`} />
        <g stroke={theme === 'disco' ? '#e879f9' : '#fbcfe8'} strokeWidth="1" fill="rgba(255,255,255,0.05)">
           <path d="M65 140 C45 160 25 150 35 130" className={`origin-[65px_130px] transition-transform duration-[5000ms] ${phase === BreathPhase.INHALE ? 'rotate-12' : '-rotate-6'}`} />
           <path d="M135 140 C155 160 175 150 165 130" className={`origin-[135px_130px] transition-transform duration-[5000ms] ${phase === BreathPhase.INHALE ? '-rotate-12' : 'rotate-6'}`} />
           <path d="M50 75 C10 40 5 110 50 95" className={`origin-[50px_85px] transition-all duration-[5000ms] ${phase === BreathPhase.INHALE ? 'rotate-[25deg] translate-y-2' : '-rotate-[5deg] translate-y-[-5px]'}`} />
           <path d="M150 75 C190 40 195 110 150 95" className={`origin-[150px_85px] transition-all duration-[5000ms] ${phase === BreathPhase.INHALE ? '-rotate-[25deg] translate-y-2' : 'rotate-[5deg] translate-y-[-5px]'}`} />
           <path d="M100 65 C 115 65, 120 40, 100 30 C 80 40, 85 65, 100 65" />
           <path d="M60 70 C 60 30, 140 30, 140 70 C 150 110, 140 150, 100 155 C 60 150, 50 110, 60 70" />
        </g>
     </svg>
  </div>
)};

const Octopus = ({ phase, theme }: any) => {
  const bubbles = useMemo(() => Array.from({ length: 16 }).map((_, i) => ({
    id: i,
    left: 50 + (Math.random() * 14 - 7),
    delay: i * 0.15 + Math.random() * 0.3,
    duration: 2.8 + Math.random() * 1.5,
    size: 2 + Math.random() * 2.5
  })), []);
  return (
  <div className={`relative w-64 h-64 md:w-80 md:h-80 transition-transform duration-[5000ms] ${phase === BreathPhase.IDLE ? 'animate-float' : ''}`}>
     <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20 overflow-visible">
        {phase === BreathPhase.EXHALE && bubbles.map((b) => (
          <div key={b.id} className="bubble opacity-0 animate-bubble-rise" style={{ animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s`, left: `${b.left}%`, top: '40%', width: `${b.size * 3}px`, height: `${b.size * 3}px` }} />
        ))}
     </div>
     <svg viewBox="0 0 200 200" fill="none" className="w-full h-full drop-shadow-xl">
       <circle cx="100" cy="80" r="45" className={`fill-purple-300/10 blur-md transition-all duration-[5000ms] ${phase === BreathPhase.INHALE ? 'opacity-60 scale-110' : 'opacity-20 scale-100'}`} />
       <g className={`transition-all duration-[5000ms] ${phase === BreathPhase.INHALE ? 'scale-110' : 'scale-90'}`} style={{transformOrigin: '100px 100px'}}>
         <path d="M80 120 Q 60 160 40 150" stroke="#c4b5fd" strokeOpacity="0.5" className="stroke-[1.5] fill-none animate-sway" />
         <path d="M120 120 Q 140 160 160 150" stroke="#c4b5fd" strokeOpacity="0.5" className="stroke-[1.5] fill-none animate-sway" style={{animationDelay: '1s'}} />
         <path d="M90 130 Q 80 170 90 180" stroke="#c4b5fd" strokeOpacity="0.5" className="stroke-[1.5] fill-none animate-sway" style={{animationDelay: '0.5s'}} />
         <path d="M100 130 C 140 130 150 40 100 30 C 50 40 60 130 100 130" fill="rgba(255,255,255,0.03)" stroke="#c4b5fd" className="stroke-[1]" />
       </g>
     </svg>
  </div>
)};

const MantaRay = ({ phase, theme }: any) => {
  const bubbles = useMemo(() => Array.from({ length: 12 }).map((_, i) => ({
    id: i,
    left: 48 + (Math.random() * 6 - 3),
    delay: i * 0.2 + Math.random() * 0.5,
    duration: 3 + Math.random() * 2,
    size: 2 + Math.random() * 2
  })), []);
  return (
  <div className={`relative w-72 h-72 md:w-96 md:h-96 transition-transform duration-[5000ms] ${phase === BreathPhase.IDLE ? 'animate-float' : ''}`}>
     <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20 overflow-visible">
        {phase === BreathPhase.EXHALE && bubbles.map((b) => (
          <div key={b.id} className="bubble opacity-0 animate-bubble-rise" style={{ animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s`, left: `${b.left}%`, top: '30%', width: `${b.size * 3}px`, height: `${b.size * 3}px` }} />
        ))}
     </div>
     <svg viewBox="0 0 200 200" fill="none" className="w-full h-full drop-shadow-2xl">
        <g stroke="#99f6e4" strokeWidth="1" fill="rgba(153, 246, 228, 0.05)">
           <path d="M100 60 C 80 60, 40 80, 10 110 C 30 140, 80 130, 100 140" className={`origin-[100px_100px] transition-all duration-[5000ms] ${phase === BreathPhase.INHALE ? 'scale-y-[0.9] -rotate-6' : 'scale-y-[1.1] rotate-3'}`} />
           <path d="M100 60 C 120 60, 160 80, 190 110 C 170 140, 120 130, 100 140" className={`origin-[100px_100px] transition-all duration-[5000ms] ${phase === BreathPhase.INHALE ? 'scale-y-[0.9] rotate-6' : 'scale-y-[1.1] -rotate-3'}`} />
           <path d="M85 100 C 85 80, 115 80, 115 100 C 115 130, 85 130, 85 100" />
        </g>
     </svg>
  </div>
)};

const Jellyfish = ({ phase, theme }: any) => {
  const bubbles = useMemo(() => Array.from({ length: 18 }).map((_, i) => ({
    id: i,
    left: 45 + (Math.random() * 10 - 5),
    delay: i * 0.1 + Math.random() * 0.3,
    duration: 3 + Math.random() * 1.5,
    size: 1.5 + Math.random() * 2
  })), []);
  return (
  <div className={`relative w-64 h-64 md:w-80 md:h-80 transition-transform duration-[5000ms] ${phase === BreathPhase.IDLE ? 'animate-float' : ''}`}>
     <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20 overflow-visible">
        {phase === BreathPhase.EXHALE && bubbles.map((b) => (
          <div key={b.id} className="bubble opacity-0 animate-bubble-rise" style={{ animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s`, left: `${b.left}%`, top: '50%', width: `${b.size * 3}px`, height: `${b.size * 3}px` }} />
        ))}
     </div>
     <svg viewBox="0 0 200 200" fill="none" className="w-full h-full drop-shadow-lg">
       <circle cx="100" cy="80" r="50" className={`fill-pink-200/10 blur-xl transition-all duration-[5000ms] ${phase === BreathPhase.INHALE ? 'scale-125 opacity-50' : 'scale-90 opacity-10'}`} />
       <g className={`transition-transform duration-[5000ms] ${phase === BreathPhase.INHALE ? 'translate-y-2' : 'translate-y-[-5px]'}`}>
          <path d="M70 110 Q 60 150 70 180" className="stroke-pink-200/40 stroke-2 fill-none animate-sway" />
          <path d="M100 120 Q 100 170 100 195" className="stroke-pink-200/60 stroke-[2] fill-none animate-sway" style={{animationDelay: '1s'}} />
          <path d="M130 110 Q 140 150 130 180" className="stroke-pink-200/40 stroke-2 fill-none animate-sway" style={{animationDelay: '0.2s'}} />
       </g>
       <path d="M50 110 C 50 50, 150 50, 150 110 C 150 120, 50 120, 50 110" className="fill-pink-900/10 stroke-pink-200/50 stroke-[1] transition-all duration-[5000ms] ease-in-out" style={{ transformOrigin: '100px 90px', transform: phase === BreathPhase.INHALE ? 'scale(1.1)' : 'scale(0.9)' }} />
     </svg>
  </div>
)};

const LuxuryCard = ({ children, active, onClick, className = "" }: any) => (
  <button onClick={onClick} className={`relative overflow-hidden rounded-xl border transition-all duration-500 text-left ${className} ${active ? 'bg-white/5 border-teal-200/30 shadow-[0_0_20px_rgba(204,251,241,0.05)]' : 'bg-transparent border-white/5 hover:bg-white/5 hover:border-white/10'}`}>
    {children}
  </button>
);

const Settings = ({ isOpen, onClose, data, update }: any) => {
  const t = TEXTS[data.language as Language];
  return (
    <>
      <div className={`fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-40 transition-opacity duration-700 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed inset-y-0 right-0 w-full md:w-[500px] z-50 transform transition-transform duration-700 bg-[#0f172a]/98 backdrop-blur-xl border-l border-white/5 flex flex-col font-sans ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          
          <div className="p-8 border-b border-white/5 flex justify-between items-center text-slate-100">
             <div className="flex items-center gap-3">
                 <svg viewBox="0 0 50 50" width="32" height="32" fill="none" stroke="#2dd4bf" strokeWidth="1.5">
                     <path d="M18 20Q25 10 32 20 M20 20L20 32 M25 20L25 35 M30 20L30 32" strokeLinecap="round" />
                 </svg>
                 <h2 className="text-2xl font-serif italic tracking-wide">De(e)p Breathe</h2>
             </div>
             <button onClick={onClose}><X size={24} className="text-slate-400 hover:text-white transition-colors" /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar text-slate-200">
              <div>
                  <div className="flex items-center gap-3 mb-4">
                      <Sparkles size={16} className="text-teal-200/60" />
                      <h3 className="text-xs font-serif font-medium uppercase tracking-[0.2em] text-slate-400">{t.character}</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                      {['turtle', 'octopus', 'manta', 'jellyfish'].map(c => (
                          <LuxuryCard key={c} active={data.character === c} onClick={() => update('character', c)} className="aspect-[3/4] flex flex-col items-center justify-center gap-4 group p-2">
                              <div className={`transition-transform duration-700 ${data.character === c ? 'scale-110 text-teal-100' : 'scale-90 opacity-60 text-slate-400 group-hover:text-slate-200'}`}>
                                  {c === 'turtle' && <svg viewBox="0 0 50 50" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1"><path d="M25 15C15 20 18 35 25 35C32 35 35 20 25 15Z" /></svg>}
                                  {c === 'octopus' && <svg viewBox="0 0 50 50" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="25" cy="20" r="8"/><path d="M18 28Q25 40 32 28"/></svg>}
                                  {c === 'manta' && <svg viewBox="0 0 50 50" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1"><path d="M25 18L10 25L25 32L40 25Z"/></svg>}
                                  {c === 'jellyfish' && <svg viewBox="0 0 50 50" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1"><path d="M18 20Q25 10 32 20" /><path d="M20 20L20 32"/><path d="M25 20L25 35"/><path d="M30 20L30 32"/></svg>}
                              </div>
                              <span className={`text-[9px] font-serif uppercase tracking-widest ${data.character === c ? 'text-teal-100' : 'text-slate-400'}`}>{t.animals[c]}</span>
                          </LuxuryCard>
                      ))}
                  </div>
              </div>
              
              {/* PLANKTON TOGGLE */}
              <div>
                   <div className="flex items-center justify-between bg-white/[0.02] p-4 rounded-xl border border-white/5 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => update('plankton', !data.plankton)}>
                       <div className="flex items-center gap-3">
                           <Wind size={16} className="text-teal-200 opacity-60" />
                           <span className="text-sm font-serif text-slate-300">{t.plankton}</span>
                       </div>
                       <div 
                          className={`w-10 h-5 rounded-full relative transition-colors duration-500 ${data.plankton ? 'bg-teal-800/60' : 'bg-slate-700/30'}`}
                      >
                          <div className={`absolute top-1 w-3 h-3 bg-slate-200 rounded-full transition-all duration-500 shadow-sm ${data.plankton ? 'left-6' : 'left-1'}`} />
                      </div>
                  </div>
              </div>

              <div>
                  <div className="flex items-center gap-3 mb-4">
                      <Sun size={16} className="text-teal-200/60" />
                      <h3 className="text-xs font-serif font-medium uppercase tracking-[0.2em] text-slate-400">{t.theme}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      {['ocean', 'midnight', 'disco', 'abyss'].map(th => (
                          <LuxuryCard key={th} active={data.theme === th} onClick={() => update('theme', th)} className="p-4">
                              {/* Fix: Cast to string to satisfy ReactNode type */}
                              <span className="text-[10px] font-serif uppercase tracking-widest text-slate-200">{t[('theme' + th.charAt(0).toUpperCase() + th.slice(1)) as keyof typeof t] as string}</span>
                          </LuxuryCard>
                      ))}
                  </div>
              </div>

              <div>
                   <div className="flex items-center gap-3 mb-4">
                      <Music size={16} className="text-teal-200/60" />
                      <h3 className="text-xs font-serif font-medium uppercase tracking-[0.2em] text-slate-400">{t.sound}</h3>
                  </div>
                  <div className="flex items-center justify-between bg-white/[0.02] p-4 rounded-xl mb-3 border border-white/5">
                      <div className="flex items-center gap-3">
                          {data.sound ? <Volume2 size={18} className="text-teal-100" /> : <VolumeX size={18} className="text-slate-500" />}
                          <span className="text-sm font-serif text-slate-300">Ambiance</span>
                      </div>
                      <button onClick={() => update('sound', !data.sound)} className={`w-10 h-5 rounded-full relative transition-colors duration-500 ${data.sound ? 'bg-teal-800/80' : 'bg-slate-700/50'}`}>
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${data.sound ? 'left-6' : 'left-1'}`} />
                      </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                       {['deep', 'trench'].map(s => (
                           <LuxuryCard key={s} active={data.soundType === s} onClick={() => { update('soundType', s); update('sound', true); }} className="p-3">
                               <span className="text-[10px] font-serif uppercase tracking-widest">{t[s === 'deep' ? 'soundDeep' : 'soundTrench']}</span>
                           </LuxuryCard>
                       ))}
                  </div>
              </div>

              <div>
                   <div className="flex items-center gap-3 mb-4">
                      <Droplets size={16} className="text-teal-200/60" />
                      <h3 className="text-xs font-serif font-medium uppercase tracking-[0.2em] text-slate-400">{t.sfx}</h3>
                  </div>
                   <div className="grid grid-cols-2 gap-2">
                       {['echo', 'light', 'pulsar', 'bubbles'].map(s => (
                           <LuxuryCard key={s} active={data.sfxType === s} onClick={() => update('sfxType', s)} className="p-3">
                               {/* Fix: Cast to string to satisfy ReactNode type */}
                               <span className="text-[10px] font-serif uppercase tracking-widest">{t[('sfx' + s.charAt(0).toUpperCase() + s.slice(1)) as keyof typeof t] as string}</span>
                           </LuxuryCard>
                       ))}
                   </div>
              </div>
              
              <div className="bg-gradient-to-br from-white/[0.03] to-transparent p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 mb-6 text-amber-200/60"><Award size={16} /><span className="text-[10px] font-serif font-medium uppercase tracking-[0.2em]">Progression</span></div>
                  <div className="grid grid-cols-2 gap-8 text-center">
                      <div><div className="text-3xl font-serif text-slate-200 mb-1">{data.stats.sessionsCompleted}</div><div className="text-[9px] uppercase tracking-widest text-slate-500">{t.totalSessions}</div></div>
                      <div><div className="text-3xl font-serif text-slate-200 mb-1">{data.stats.totalMinutes}</div><div className="text-[9px] uppercase tracking-widest text-slate-500">{t.minutes}</div></div>
                  </div>
              </div>
          </div>
      </div>
    </>
  );
};

const App: React.FC = () => {
   const [isPlaying, setIsPlaying] = useState(false);
   const [phase, setPhase] = useState<BreathPhase>(BreathPhase.IDLE);
   const [timeLeft, setTimeLeft] = useState(300);
   const [settingsOpen, setSettingsOpen] = useState(false);
   const [showControls, setShowControls] = useState(true);
   const controlsTimer = useRef<any>(null);
   const startTimeRef = useRef<number | null>(null);
   const requestRef = useRef<number | null>(null);
   
   const [prefs, setPrefs] = useState(() => {
       try { 
         const stored = localStorage.getItem('deep_breathe_prefs');
         return stored ? JSON.parse(stored) : { theme: 'midnight', sound: false, soundType: 'deep', sfxType: 'bubbles', character: 'jellyfish', language: 'fr', plankton: true, stats: { sessionsCompleted: 0, totalMinutes: 0 } }; 
       }
       catch { return { theme: 'midnight', sound: false, soundType: 'deep', sfxType: 'bubbles', character: 'jellyfish', language: 'fr', plankton: true, stats: { sessionsCompleted: 0, totalMinutes: 0 } }; }
   });

   const t = TEXTS[prefs.language as Language];
   const timerRef = useRef<any>(null);

   useEffect(() => { localStorage.setItem('deep_breathe_prefs', JSON.stringify(prefs)); }, [prefs]);

   // STRICT AUDIO SYNC
   useEffect(() => {
       if(isPlaying) {
           audioService.resume();
           audioService.setSoundType(prefs.soundType);
           audioService.setSfxType(prefs.sfxType);
           audioService.setAmbientEnabled(prefs.sound);
       } else {
           audioService.stopAmbient();
           audioService.stopBreathingLoop();
           // Force suspend context to silence any scheduled sounds if manually stopped
           // But avoid doing this if just switching prefs while idle
       }
   }, [prefs, isPlaying]);

   const updatePref = (key: string, val: any) => setPrefs((p: any) => ({ ...p, [key]: val }));

   const handleInteraction = () => {
       setShowControls(true);
       if (controlsTimer.current) clearTimeout(controlsTimer.current);
       if(isPlaying) controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
   };

   // ANIMATION LOOP FOR STRICT 6 BPM (5000ms Inhale, 5000ms Exhale)
   const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const cycleDuration = 10000; // 5s + 5s
      const positionInCycle = elapsed % cycleDuration;
      
      if (positionInCycle < 5000) {
        setPhase((prev) => prev !== BreathPhase.INHALE ? BreathPhase.INHALE : prev);
      } else {
        setPhase((prev) => prev !== BreathPhase.EXHALE ? BreathPhase.EXHALE : prev);
      }
      requestRef.current = requestAnimationFrame(animate);
   };

   const togglePlay = async () => {
       if(isPlaying) {
           setIsPlaying(false);
           setPhase(BreathPhase.IDLE);
           clearInterval(timerRef.current);
           if (requestRef.current) cancelAnimationFrame(requestRef.current);
           startTimeRef.current = null;
           
           // STOP AND SUSPEND IMMEDIATELY
           audioService.stopBreathingLoop();
           audioService.stopAmbient();
           audioService.suspend();
           
           setShowControls(true);
       } else {
           await audioService.resume();
           setIsPlaying(true);
           setPhase(BreathPhase.INHALE);
           
           // SYNC AUDIO
           if(prefs.sound) audioService.startAmbient();
           // 5000ms Inhale, 5000ms Exhale
           audioService.startBreathingLoop(5000, 5000);
           
           // SYNC VISUALS
           startTimeRef.current = performance.now();
           requestRef.current = requestAnimationFrame(animate);

           const start = Date.now();
           const end = start + 300000; // 5 min
           
           timerRef.current = setInterval(() => {
               const now = Date.now();
               const left = Math.ceil((end - now)/1000);
               
               if(left <= 0) {
                   setIsPlaying(false);
                   setPhase(BreathPhase.IDLE);
                   clearInterval(timerRef.current);
                   if(requestRef.current) cancelAnimationFrame(requestRef.current);
                   
                   // STOP SESSION NATURALLY
                   audioService.stopBreathingLoop();
                   audioService.stopAmbient();
                   audioService.playChime(); // Play finish sound
                   
                   // Suspend audio after chime finishes (5 seconds delay)
                   setTimeout(() => audioService.suspend(), 5000);
                   
                   setPrefs((p: any) => ({...p, stats: { sessionsCompleted: p.stats.sessionsCompleted + 1, totalMinutes: p.stats.totalMinutes + 5 }}));
                   setShowControls(true);
               }
               setTimeLeft(left > 0 ? left : 0);
           }, 1000);
           
           handleInteraction();
       }
   };

   const renderCharacter = () => {
       const props = { phase: isPlaying ? phase : BreathPhase.IDLE, theme: prefs.theme, unlockLevel: prefs.stats.sessionsCompleted };
       if(prefs.character === 'turtle') return <Turtle {...props} />;
       if(prefs.character === 'octopus') return <Octopus {...props} />;
       if(prefs.character === 'manta') return <MantaRay {...props} />;
       return <Jellyfish {...props} />;
   };

   return (
       <div className="relative w-full h-screen overflow-hidden text-slate-100 font-sans select-none" onMouseMove={handleInteraction} onClick={handleInteraction} onTouchStart={handleInteraction}>
           <OceanBackground theme={prefs.theme} planktonEnabled={prefs.plankton} phase={phase} />
           
           <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} data={prefs} update={updatePref} />

           <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
               
               {isPlaying && (
                   <div className={`absolute top-12 flex items-center gap-2 text-slate-400 opacity-80 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                       <Timer size={14} />
                       <span className="text-sm tracking-widest font-sans font-light">{Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}</span>
                   </div>
               )}

               {/* INSTRUCTIONS MOVED DOWN TO TOP-[16%] */}
               <div className={`absolute top-[16%] w-full text-center transition-all duration-1000 ${isPlaying ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform -translate-y-4'}`}>
                   <h2 className="text-4xl md:text-5xl font-serif italic tracking-wide text-slate-100">{phase === BreathPhase.INHALE ? t.inhale : t.exhale}</h2>
                   <p className="text-xs font-sans text-teal-200/60 mt-3 tracking-[0.2em] uppercase">
                      {phase === BreathPhase.INHALE ? t.guidanceInhale[0] : t.guidanceExhale[0]}
                   </p>
               </div>

               {/* STRICT 6 BPM ANIMATION: 5000ms duration. INHALE = UP, EXHALE = DOWN */}
               <div className={`transition-transform duration-[5000ms] cubic-bezier(0.45, 0, 0.55, 1) will-change-transform ${!isPlaying ? 'scale-90 translate-y-0' : phase === BreathPhase.INHALE ? 'scale-100 translate-y-[-15vh]' : 'scale-90 translate-y-[15vh]'}`}>
                  {renderCharacter()}
               </div>

               <div className={`absolute bottom-0 left-0 w-full h-32 px-6 flex items-end justify-between pb-6 transition-all duration-700 ${isPlaying && !showControls ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                   <button onClick={(e) => { e.stopPropagation(); updatePref('sound', !prefs.sound); }} className="p-4 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors mb-2">
                       {prefs.sound ? <Volume2 size={24} strokeWidth={1} /> : <VolumeX size={24} strokeWidth={1} />}
                   </button>

                   <div className="flex flex-col items-center gap-4 absolute left-1/2 -translate-x-1/2 bottom-6">
                       <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className={`group relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-700 ease-out shadow-2xl ${isPlaying ? 'bg-transparent border border-transparent hover:border-red-500/30 hover:bg-red-500/5' : 'bg-white/5 border border-white/10 backdrop-blur-md text-slate-100 shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:bg-white/10'}`}>
                           {isPlaying ? <Square size={16} fill="currentColor" className="text-slate-400 group-hover:text-red-300" /> : <Play size={24} fill="currentColor" className="ml-1 text-slate-100" />}
                       </button>
                       <span className="text-[9px] font-serif tracking-[0.3em] uppercase whitespace-nowrap text-slate-400">
                           {isPlaying ? t.stop : "Keep calm and breathe"}
                       </span>
                   </div>
                   
                   <button onClick={(e) => { e.stopPropagation(); setSettingsOpen(true); }} className="p-4 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors mb-2">
                       <SettingsIcon size={24} strokeWidth={1} />
                   </button>
               </div>
           </div>
       </div>
   );
};

export default App;