import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Trophy, X, RotateCcw, Home } from 'lucide-react';
import { COLOR_SHADES } from '../data/paintsData';

interface GameBubble {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  colorHex: string;
  shadeName: string;
  isRainbow: boolean;
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

interface ColorSplashArcadeProps {
  onApplyPaletteToVisualizer?: (shadeHex: string) => void;
}

export const ColorSplashArcade: React.FC<ColorSplashArcadeProps> = ({ onApplyPaletteToVisualizer }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(45);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [splats, setSplats] = useState<Splat[]>([]);
  const [floatTexts, setFloatTexts] = useState<Array<{ id: number; x: number; y: number; text: string; color: string }>>([]);
  const [topPalette, setTopPalette] = useState<Array<{ name: string; hex: string }>>([]);

  const bubblesRef = useRef<GameBubble[]>([]);
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPopRef = useRef<number>(0);
  const isPointerDownRef = useRef<boolean>(false);
  const poppedCountsRef = useRef<Record<string, number>>({});
  const bubbleIdGenRef = useRef<number>(0);

  const colors = COLOR_SHADES.slice(0, 10);

  const playChime = (streak: number) => {
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
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.12);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // Audio autoplay restriction safe fallback
    }
  };

  const spawnBubble = () => {
    if (!arenaRef.current) return;
    const isRainbow = Math.random() < 0.12;
    const col = colors[Math.floor(Math.random() * colors.length)];
    const size = isRainbow ? 78 : (56 + Math.floor(Math.random() * 24));
    const rect = arenaRef.current.getBoundingClientRect();
    const x = Math.random() * (rect.width - size - 40) + 20;
    const y = rect.height + 10;
    const vy = -(1.8 + Math.random() * 1.8);
    const vx = (Math.random() - 0.5) * 1.4;

    bubblesRef.current.push({
      id: bubbleIdGenRef.current++,
      x,
      y,
      vx,
      vy,
      size,
      colorHex: isRainbow ? '#ffb800' : col.hex,
      shadeName: isRainbow ? 'Rainbow Blast!' : col.name,
      isRainbow,
      wobble: Math.random() * 10,
      isPopping: false,
    });
  };

  const popBubble = (bubble: GameBubble) => {
    if (bubble.isPopping) return;
    bubble.isPopping = true;

    const now = Date.now();
    let currentCombo = 1;
    if (now - lastPopRef.current < 1600) {
      setCombo((prev) => {
        currentCombo = prev + 1;
        return currentCombo;
      });
    } else {
      setCombo(1);
      currentCombo = 1;
    }
    lastPopRef.current = now;

    setScore((s) => s + (bubble.isRainbow ? 5 : 1));
    playChime(currentCombo);

    poppedCountsRef.current[bubble.shadeName] = (poppedCountsRef.current[bubble.shadeName] || 0) + (bubble.isRainbow ? 3 : 1);

    const cx = bubble.x + bubble.size / 2;
    const cy = bubble.y + bubble.size / 2;

    // Paint Splat
    const newSplat: Splat = {
      id: Math.random(),
      x: cx,
      y: cy,
      size: bubble.size * (1.2 + Math.random() * 0.5),
      color: bubble.colorHex,
      rot: Math.random() * 360,
    };
    setSplats((prev) => [...prev.slice(-10), newSplat]);
    setTimeout(() => {
      setSplats((prev) => prev.filter((s) => s.id !== newSplat.id));
    }, 2400);

    // Floating text
    const textId = Math.random();
    setFloatTexts((prev) => [
      ...prev,
      {
        id: textId,
        x: cx,
        y: cy,
        text: (currentCombo > 1 ? `🔥 x${currentCombo} ` : `+1 ✨ `) + bubble.shadeName,
        color: bubble.colorHex,
      },
    ]);
    setTimeout(() => {
      setFloatTexts((prev) => prev.filter((t) => t.id !== textId));
    }, 950);

    // Particles
    const burstCols = bubble.isRainbow ? colors.map((c) => c.hex) : [bubble.colorHex, '#ffffff', '#ffe066'];
    const newParts: Particle[] = [];
    const count = bubble.isRainbow ? 54 : 32;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 35 + Math.random() * (bubble.isRainbow ? 140 : 90);
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
        color: burstCols[Math.floor(Math.random() * burstCols.length)],
      });
    }
    setParticles((prev) => [...prev.slice(-60), ...newParts]);
    setTimeout(() => {
      setParticles([]);
    }, 1100);

    // Rainbow Chain Reaction
    if (bubble.isRainbow) {
      setTimeout(() => {
        bubblesRef.current.forEach((other) => {
          if (!other.isPopping) popBubble(other);
        });
      }, 100);
    }

    setTimeout(() => {
      bubblesRef.current = bubblesRef.current.filter((b) => b.id !== bubble.id);
    }, 180);
  };

  const handleStartGame = () => {
    setScore(0);
    setTimeLeft(45);
    setCombo(0);
    setIsGameOver(false);
    poppedCountsRef.current = {};
    bubblesRef.current = [];
    setSplats([]);
    setParticles([]);
    setFloatTexts([]);

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);

    for (let i = 0; i < 6; i++) {
      setTimeout(() => spawnBubble(), i * 200);
    }

    spawnIntervalRef.current = setInterval(() => {
      if (bubblesRef.current.length < 10) {
        spawnBubble();
      }
    }, 750);

    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (isZenMode) return prev;
        if (prev <= 1) {
          handleEndGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleEndGame = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);

    const sorted = Object.entries(poppedCountsRef.current).sort((a, b) => b[1] - a[1]).map((p) => p[0]);
    const top = sorted.slice(0, 4);
    while (top.length < 4) {
      const r = colors[Math.floor(Math.random() * colors.length)].name;
      if (!top.includes(r)) top.push(r);
    }

    const palette = top.map((name) => {
      const col = colors.find((c) => c.name === name) || colors[0];
      return { name: col.name, hex: col.hex };
    });

    setTopPalette(palette);
    setIsGameOver(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    handleStartGame();

    const handlePointerDown = () => { isPointerDownRef.current = true; };
    const handlePointerUp = () => { isPointerDownRef.current = false; };
    const handlePointerMove = (e: PointerEvent) => {
      if (!isPointerDownRef.current || !arenaRef.current) return;
      const rect = arenaRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      bubblesRef.current.forEach((b) => {
        if (b.isPopping) return;
        const cx = b.x + b.size / 2;
        const cy = b.y + b.size / 2;
        if (Math.hypot(px - cx, py - cy) <= b.size / 2 + 16) {
          popBubble(b);
        }
      });
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);

    const loop = () => {
      if (arenaRef.current) {
        const rect = arenaRef.current.getBoundingClientRect();
        for (let i = bubblesRef.current.length - 1; i >= 0; i--) {
          const b = bubblesRef.current[i];
          if (b.isPopping) continue;

          b.wobble += 0.04;
          b.x += b.vx + Math.sin(b.wobble) * 0.7;
          b.y += b.vy;

          if (b.x < 10) { b.x = 10; b.vx = Math.abs(b.vx); }
          if (b.x > rect.width - b.size - 10) { b.x = rect.width - b.size - 10; b.vx = -Math.abs(b.vx); }

          if (b.y < -b.size - 20) {
            bubblesRef.current.splice(i, 1);
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [isOpen, isZenMode]);

  return (
    <>
      {/* 1. Peaceful Floating Launcher (Zero disturbance on main page) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-linear-to-r from-rose-500 via-amber-500 to-indigo-600 text-white font-display font-extrabold text-xs shadow-2xl border-2 border-white/40 hover:scale-105 active:scale-95 transition-all select-none cursor-pointer"
        aria-label="Open Color Splash Mini Game"
      >
        <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
        <span>Play Color Splash</span>
      </button>

      {/* 2. Full-Screen Game Studio Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[999999] flex flex-col bg-radial from-[#1b1340] to-[#0c0820] select-none touch-none text-white font-sans animate-fade-in">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#0c0820]/80 backdrop-blur-md border-b border-white/10 z-20">
            <div className="flex items-center gap-5">
              <div className="text-lg font-bold font-display flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>Score: <strong className="font-mono text-2xl text-amber-400">{score}</strong></span>
              </div>
              {!isZenMode && (
                <div className="text-sm px-3 py-1 rounded-full bg-white/10 border border-white/20 font-mono">
                  ⏱️ {timeLeft}s
                </div>
              )}
              {combo > 1 && (
                <div className="text-sm font-extrabold bg-linear-to-r from-amber-400 to-rose-400 bg-clip-text text-transparent">
                  Combo x{combo}! 🔥
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsZenMode(!isZenMode)}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold transition-colors cursor-pointer"
              >
                {isZenMode ? '⏱️ Timed Mode' : '♾️ Zen Mode'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 flex items-center justify-center transition-colors cursor-pointer"
                title="Close Game"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Arena Canvas */}
          <div ref={arenaRef} className="relative flex-1 overflow-hidden cursor-crosshair">
            
            {/* Splats */}
            {splats.map((s) => (
              <div
                key={s.id}
                className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-[40%_60%_70%_30%/40%_50%_60%_55%] animate-ping"
                style={{
                  left: s.x,
                  top: s.y,
                  width: s.size,
                  height: s.size,
                  backgroundColor: s.color,
                  transform: `translate(-50%, -50%) rotate(${s.rot}deg)`,
                  opacity: 0.85,
                }}
              />
            ))}

            {/* Float text */}
            {floatTexts.map((t) => (
              <div
                key={t.id}
                className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 font-display font-extrabold text-xl text-white z-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] animate-bounce"
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

            {/* Particles */}
            {particles.map((p) => (
              <div
                key={p.id}
                className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 z-50"
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

            {/* Rising Bubbles */}
            {bubblesRef.current.map((b) => (
              <button
                key={b.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  popBubble(b);
                }}
                className="absolute rounded-full p-0 border-0 cursor-pointer pointer-events-auto touch-none select-none hover:scale-120 active:scale-90 transition-transform duration-75"
                style={{
                  left: b.x,
                  top: b.y,
                  width: b.size,
                  height: b.size,
                  background: b.isRainbow
                    ? 'conic-gradient(#ff5a5f,#ffb800,#8bd450,#0fb5a2,#2d9cff,#6c4cf5,#ff4fa3,#ff5a5f)'
                    : `radial-gradient(circle at 30% 28%, #ffffff 0%, rgba(255,255,255,0.75) 18%, ${b.colorHex} 54%, #000 100%)`,
                  boxShadow: b.isRainbow
                    ? '0 0 30px #ffb800, inset 0 0 10px #fff'
                    : `inset 0 -6px 14px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.28), 0 0 20px ${b.colorHex}`,
                  transition: 'scale 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
                  opacity: b.isPopping ? 0 : 1,
                  scale: b.isPopping ? '0' : '1',
                }}
              >
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-[#1b1340]/90 text-white font-sans text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap pointer-events-none shadow-md border border-white/30 tracking-wider">
                  {b.shadeName}
                </span>
              </button>
            ))}
          </div>

          {/* End-of-Round Custom Palette Summary */}
          {isGameOver && (
            <div className="absolute inset-0 bg-[#0c0820]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center z-50">
              <h2 className="text-4xl font-extrabold font-display text-amber-400 mb-2">🎉 Splendid Splashing!</h2>
              <p className="text-stone-300 text-lg mb-6">You popped <strong className="text-white text-2xl font-mono">{score}</strong> paint shades into vibrant fireworks!</p>

              <div className="bg-white/10 border border-white/20 rounded-2xl p-5 mb-8 max-w-md w-full shadow-2xl">
                <h4 className="text-xs uppercase font-bold tracking-widest text-amber-300 mb-4">Your Custom Architectural Palette</h4>
                <div className="flex justify-center gap-4 mb-3">
                  {topPalette.map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-12 h-12 rounded-full border-2 border-white shadow-lg"
                        style={{ backgroundColor: item.hex }}
                      />
                      <span className="text-[10px] font-bold text-white max-w-[70px] truncate">{item.name}</span>
                      <small className="text-[9px] text-stone-400 font-mono">{item.hex}</small>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-stone-400">Created from the shades you burst most in the game!</p>
              </div>

              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={handleStartGame}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-linear-to-r from-amber-500 to-rose-500 text-white font-bold text-sm shadow-xl hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Play Again</span>
                </button>

                {onApplyPaletteToVisualizer && topPalette.length > 0 && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onApplyPaletteToVisualizer(topPalette[0].hex);
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#1fa855] text-white font-bold text-sm shadow-xl hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <span>Apply to Visualizer 🏠</span>
                  </button>
                )}

                <button
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>Back to Home</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
