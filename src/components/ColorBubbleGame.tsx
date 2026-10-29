import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import { COLOR_SHADES } from '../data/paintsData';

interface Bubble {
  id: number;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  colorHex: string;
  colorName: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  colorHex: string;
}

export const ColorBubbleGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState<number>(0);
  const [lastPopped, setLastPopped] = useState<string>('Tap a floating shade bubble to burst it!');

  const bubblesRef = useRef<Bubble[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const updateSize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = 240;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Seed initial bubbles
    const shadesPool = COLOR_SHADES.slice(0, 12);
    bubblesRef.current = shadesPool.map((shade, i) => ({
      id: i,
      x: Math.random() * (canvas.width - 80) + 40,
      y: Math.random() * (canvas.height - 80) + 40,
      radius: 24 + Math.random() * 8,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      colorHex: shade.hex,
      colorName: shade.name,
    }));

    // Animation loop
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw and update particles
      particlesRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.025;
        p.radius *= 0.96;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.colorHex;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Filter out dead particles
      particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0.05);

      // Draw and update bubbles
      bubblesRef.current.forEach((b) => {
        b.x += b.vx;
        b.y += b.vy;

        // Bounce on boundaries
        if (b.x - b.radius < 0 || b.x + b.radius > canvas.width) b.vx *= -1;
        if (b.y - b.radius < 0 || b.y + b.radius > canvas.height) b.vy *= -1;

        // Bubble body
        ctx.save();
        ctx.fillStyle = b.colorHex;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();

        // Shimmer highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.28, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check hit
    for (let i = bubblesRef.current.length - 1; i >= 0; i--) {
      const b = bubblesRef.current[i];
      const dx = clickX - b.x;
      const dy = clickY - b.y;
      if (dx * dx + dy * dy <= b.radius * b.radius) {
        // Pop bubble! Create 16 burst particles
        for (let p = 0; p < 16; p++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.5 + Math.random() * 3.5;
          particlesRef.current.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 4 + Math.random() * 4,
            alpha: 1,
            colorHex: b.colorHex,
          });
        }

        setScore((prev) => prev + 1);
        setLastPopped(`Popped ${b.colorName}!`);

        // Respawn bubble on edge
        const randomShade = COLOR_SHADES[Math.floor(Math.random() * COLOR_SHADES.length)];
        b.x = Math.random() * (canvas.width - 60) + 30;
        b.y = Math.random() * (canvas.height - 60) + 30;
        b.colorHex = randomShade.hex;
        b.colorName = randomShade.name;
        break;
      }
    }
  };

  const handleReset = () => {
    setScore(0);
    setLastPopped('Ready! Tap any floating shade bubble.');
  };

  return (
    <section className="py-10 bg-stone-900 text-white border-b border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-display text-lg font-bold">Pop the Color Bubbles</h3>
              <p className="text-xs text-stone-400">Tap any floating architectural shade to burst it into colorful particles.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs">
              <span className="text-stone-400">Shades Burst: </span>
              <strong className="font-mono text-base text-amber-400 tabular-nums">{score}</strong>
            </div>

            <button
              onClick={handleReset}
              className="p-1.5 text-stone-400 hover:text-white rounded-lg border border-stone-700 hover:bg-stone-800 transition-colors"
              title="Reset counter"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas Arena */}
        <div className="relative rounded-2xl overflow-hidden bg-stone-950 border border-stone-800 shadow-inner">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full h-60 block cursor-pointer touch-manipulation"
          />

          <div className="absolute bottom-3 left-4 text-[11px] text-stone-400 font-medium pointer-events-none">
            {lastPopped}
          </div>
        </div>

      </div>
    </section>
  );
};
