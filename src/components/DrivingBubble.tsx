import React, { useState, useEffect, useRef } from 'react';
import { COLOR_SHADES } from '../data/paintsData';

interface SwarmBubble {
  id: number;
  colorHex: string;
  shadeName: string;
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  wobble: number;
  isPopping: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  up: number;
  r: number;
  size: number;
  isStar: boolean;
  color: string;
}

interface Splat {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rot: number;
}

export const DrivingBubble: React.FC = () => {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [splats, setSplats] = useState<Splat[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<Array<{ id: number; x: number; y: number; text: string; color: string }>>([]);

  const bubblesRef = useRef<SwarmBubble[]>([]);
  const bubbleElsRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const animFrameRef = useRef<number | null>(null);
  const lastPopRef = useRef<number>(0);
  const isPointerDownRef = useRef<boolean>(false);

  const colors = COLOR_SHADES.slice(0, 10);

  // Melodic audio pop
  const playPopSound = (streak: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const pitches = [340, 420, 520, 640, 780, 960, 1180, 1400];
      const freq = pitches[Math.min(streak, pitches.length - 1)];
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.8, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.11);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Audio autoplay restriction safe fallback
    }
  };

  const createBubble = (id: number, startX?: number, startY?: number): SwarmBubble => {
    const col = colors[Math.floor(Math.random() * colors.length)];
    const size = 56 + Math.floor(Math.random() * 24);
    const pad = 30;
    const x = startX ?? (Math.random() * (window.innerWidth - size - pad * 2) + pad);
    const y = startY ?? (Math.random() * (window.innerHeight - size - pad * 2) + pad);
    return {
      id,
      colorHex: col.hex,
      shadeName: col.name,
      size,
      x,
      y,
      vx: (Math.random() > 0.5 ? 1 : -1) * (1.1 + Math.random() * 1.1),
      vy: (Math.random() > 0.5 ? 1 : -1) * (0.9 + Math.random() * 1.1),
      wobble: Math.random() * 10,
      isPopping: false,
    };
  };

  const popBubble = (bubble: SwarmBubble) => {
    if (bubble.isPopping) return;
    bubble.isPopping = true;

    const now = Date.now();
    let currentCombo = 1;
    if (now - lastPopRef.current < 1800) {
      setCombo((prev) => {
        currentCombo = prev + 1;
        return currentCombo;
      });
    } else {
      setCombo(1);
      currentCombo = 1;
    }
    lastPopRef.current = now;

    setScore((s) => s + 1);
    playPopSound(currentCombo);

    const cx = bubble.x + bubble.size / 2;
    const cy = bubble.y + bubble.size / 2;

    // Paint Splat
    const newSplat: Splat = {
      id: Math.random(),
      x: cx,
      y: cy,
      size: bubble.size * (1.1 + Math.random() * 0.5),
      color: bubble.colorHex,
      rot: Math.random() * 360,
    };
    setSplats((prev) => [...prev.slice(-8), newSplat]);
    setTimeout(() => {
      setSplats((prev) => prev.filter((s) => s.id !== newSplat.id));
    }, 1600);

    // Floating text
    const textId = Math.random();
    const floatText = {
      id: textId,
      x: cx,
      y: cy,
      text: (currentCombo > 1 ? `🔥 x${currentCombo} ` : `+1 ✨ `) + bubble.shadeName,
      color: bubble.colorHex,
    };
    setFloatingTexts((prev) => [...prev, floatText]);
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((t) => t.id !== textId));
    }, 950);

    // Particles
    const sparkleCols = [bubble.colorHex, '#ffffff', '#ffe066', '#ff5a5f', '#0fb5a2', '#6c4cf5', '#ff4fa3'];
    const newParts: Particle[] = [];
    for (let i = 0; i < 42; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 35 + Math.random() * 100;
      newParts.push({
        id: Math.random() + i,
        x: cx,
        y: cy,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist + (Math.random() * 50 + 20),
        up: Math.sin(angle) * dist * 0.7 - (20 + Math.random() * 40),
        r: (Math.random() - 0.5) * 800,
        size: 5 + Math.random() * 7,
        isStar: Math.random() < 0.3,
        color: sparkleCols[Math.floor(Math.random() * sparkleCols.length)],
      });
    }
    setParticles((prev) => [...prev.slice(-60), ...newParts]);
    setTimeout(() => {
      setParticles([]);
    }, 1100);

    // Visual bubble shrink
    const el = bubbleElsRef.current.get(bubble.id);
    if (el) {
      el.style.scale = '0';
      el.style.opacity = '0';
    }

    // Respawn
    setTimeout(() => {
      const edge = Math.floor(Math.random() * 4);
      let nx = 30, ny = 30;
      if (edge === 0) { nx = 20; ny = Math.random() * (window.innerHeight - 140) + 40; }
      else if (edge === 1) { nx = window.innerWidth - 90; ny = Math.random() * (window.innerHeight - 140) + 40; }
      else if (edge === 2) { ny = 20; nx = Math.random() * (window.innerWidth - 140) + 40; }
      else { ny = window.innerHeight - 90; nx = Math.random() * (window.innerWidth - 140) + 40; }

      const newB = createBubble(bubble.id, nx, ny);
      const bIdx = bubblesRef.current.findIndex((b) => b.id === bubble.id);
      if (bIdx !== -1) {
        bubblesRef.current[bIdx] = newB;
      }
      const elNew = bubbleElsRef.current.get(bubble.id);
      if (elNew) {
        elNew.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
        elNew.style.scale = '1';
        elNew.style.opacity = '1';
      }
    }, 380);
  };

  useEffect(() => {
    // Initial 7 swarm bubbles
    const initial: SwarmBubble[] = [];
    for (let i = 0; i < 7; i++) {
      initial.push(createBubble(i));
    }
    bubblesRef.current = initial;

    const handlePointerDown = () => { isPointerDownRef.current = true; };
    const handlePointerUp = () => { isPointerDownRef.current = false; };
    const handlePointerMove = (e: PointerEvent) => {
      if (!isPointerDownRef.current) return;
      bubblesRef.current.forEach((b) => {
        if (b.isPopping) return;
        const cx = b.x + b.size / 2;
        const cy = b.y + b.size / 2;
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (dist <= b.size / 2 + 18) {
          popBubble(b);
        }
      });
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    // Loop
    const loop = () => {
      const pad = 12;
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      bubblesRef.current.forEach((b) => {
        if (b.isPopping) return;

        b.wobble += 0.035;
        b.x += b.vx + Math.sin(b.wobble) * 0.45;
        b.y += b.vy + Math.cos(b.wobble * 0.8) * 0.45;

        const maxW = winW - b.size - pad;
        const maxH = winH - b.size - pad;

        if (b.x <= pad) { b.x = pad; b.vx = Math.abs(b.vx); }
        if (b.x >= maxW) { b.x = maxW; b.vx = -Math.abs(b.vx); }
        if (b.y <= pad) { b.y = pad; b.vy = Math.abs(b.vy); }
        if (b.y >= maxH) { b.y = maxH; b.vy = -Math.abs(b.vy); }

        if (Math.random() < 0.012) {
          b.vx += (Math.random() - 0.5) * 0.5;
          b.vy += (Math.random() - 0.5) * 0.5;
          const spd = Math.hypot(b.vx, b.vy) || 1.8;
          b.vx = (b.vx / spd) * 1.6;
          b.vy = (b.vy / spd) * 1.6;
        }

        const el = bubbleElsRef.current.get(b.id);
        if (el) {
          el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
        }
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">
      {/* Floating Dashboard HUD */}
      <div className="fixed bottom-4 left-4 z-[99999] bg-[#1b1340]/90 backdrop-blur-md text-white border border-white/20 shadow-2xl rounded-full px-4 py-2 text-xs font-display flex items-center gap-3 select-none pointer-events-auto">
        <span>🎨 Popped: <strong className="text-amber-400 font-mono text-sm">{score}</strong></span>
        {combo > 1 && (
          <span className="font-extrabold text-xs bg-linear-to-r from-amber-400 to-rose-400 bg-clip-text text-transparent">
            Combo x{combo}! 🔥
          </span>
        )}
        <button
          onClick={() => {
            if (bubblesRef.current.length < 16) {
              const newB = createBubble(bubblesRef.current.length);
              bubblesRef.current.push(newB);
            }
          }}
          className="bg-white/15 hover:bg-white/25 border border-white/25 rounded-full px-2 py-0.5 text-[11px] font-bold text-white transition-colors"
          title="Add another roaming bubble"
        >
          + Bubble
        </button>
        {score > 0 && (
          <button
            onClick={() => { setScore(0); setCombo(0); }}
            className="text-stone-400 hover:text-white p-0.5 ml-1 transition-colors"
            title="Reset score"
          >
            ↺
          </button>
        )}
      </div>

      {/* Paint Splats */}
      {splats.map((s) => (
        <div
          key={s.id}
          className="fixed pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-[40%_60%_70%_30%/40%_50%_60%_55%] opacity-80 animate-ping"
          style={{
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            transform: `translate(-50%, -50%) rotate(${s.rot}deg)`,
          }}
        />
      ))}

      {/* Floating Combo / Pop Texts */}
      {floatingTexts.map((t) => (
        <div
          key={t.id}
          className="fixed pointer-events-none -translate-x-1/2 -translate-y-1/2 font-display font-extrabold text-lg text-white z-[999999] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] animate-bounce"
          style={{
            left: t.x,
            top: t.y - 25,
            color: t.color,
            textShadow: '0 0 16px rgba(255,255,255,0.9)',
          }}
        >
          {t.text}
        </div>
      ))}

      {/* Sparkling Particle Fireworks */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="fixed pointer-events-none -translate-x-1/2 -translate-y-1/2 z-[999999]"
          style={{
            left: p.x + p.dx,
            top: p.y + p.dy + p.up,
            transform: `rotate(${p.r}deg)`,
            transition: 'all 0.9s cubic-bezier(0.2, 0.8, 0.3, 1)',
            opacity: 0,
            width: p.isStar ? undefined : p.size,
            height: p.isStar ? undefined : p.size,
            borderRadius: p.isStar ? undefined : '50%',
            backgroundColor: p.isStar ? undefined : p.color,
            boxShadow: `0 0 10px ${p.color}`,
            color: p.color,
            fontSize: p.isStar ? `${p.size * 2}px` : undefined,
          }}
        >
          {p.isStar && '✦'}
        </div>
      ))}

      {/* Swarm of 7 Driving Bubbles */}
      {bubblesRef.current.map((b) => (
        <button
          key={b.id}
          ref={(el) => {
            if (el) bubbleElsRef.current.set(b.id, el);
            else bubbleElsRef.current.delete(b.id);
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            popBubble(b);
          }}
          className="fixed top-0 left-0 rounded-full p-0 border-0 cursor-pointer pointer-events-auto touch-none select-none hover:scale-120 active:scale-90 transition-transform duration-75"
          style={{
            width: b.size,
            height: b.size,
            background: `radial-gradient(circle at 30% 28%, #ffffff 0%, rgba(255,255,255,0.75) 18%, ${b.colorHex} 54%, #000 100%)`,
            boxShadow: `inset 0 -6px 14px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.28), 0 0 20px ${b.colorHex}`,
            transition: 'scale 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
          }}
          aria-label={`Pop ${b.shadeName} bubble`}
        >
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-[#1b1340]/90 text-white font-sans text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap pointer-events-none shadow-md border border-white/30 tracking-wider">
            {b.shadeName}
          </span>
        </button>
      ))}
    </div>
  );
};
