import React, { useState, useRef } from 'react';
import { ZoomIn, Search } from 'lucide-react';

interface ProductImageZoomProps {
  src: string;
  alt: string;
  sheen: string;
  tintable?: boolean;
  selectedColorHex?: string;
  selectedColorName?: string;
}

export const ProductImageZoom: React.FC<ProductImageZoomProps> = ({
  src,
  alt,
  sheen,
  tintable,
  selectedColorHex,
  selectedColorName,
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setOrigin({ x, y });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100));
    setOrigin({ x, y });
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsZoomed(true)}
      onMouseLeave={() => {
        setIsZoomed(false);
        setOrigin({ x: 50, y: 50 });
      }}
      onMouseMove={handleMouseMove}
      onTouchStart={() => setIsZoomed(true)}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => {
        setIsZoomed(false);
        setOrigin({ x: 50, y: 50 });
      }}
      className="relative aspect-16/10 bg-stone-100/70 p-4 flex items-center justify-center overflow-hidden cursor-crosshair select-none group"
      aria-label={`Interactive zoom view for ${alt}`}
    >
      {/* Zoomable Product Image */}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-contain mix-blend-multiply pointer-events-none transition-transform ${
          isZoomed ? 'duration-75' : 'duration-300'
        }`}
        style={{
          transformOrigin: `${origin.x}% ${origin.y}%`,
          transform: isZoomed ? 'scale(2.4)' : 'scale(1)',
        }}
        referrerPolicy="no-referrer"
      />

      {/* Clean Sheen Badge (Top Left) */}
      <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-bold text-stone-800 border border-stone-200 shadow-xs pointer-events-none z-10">
        {sheen}
      </div>

      {/* Tint Swatch Badge (Top Right) */}
      {tintable && selectedColorHex && (
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-semibold text-stone-700 flex items-center gap-1.5 border border-stone-200 shadow-xs pointer-events-none z-10">
          <span
            className="w-3 h-3 rounded-full border border-black/20 shadow-xs"
            style={{ backgroundColor: selectedColorHex }}
          />
          <span className="truncate max-w-[85px]">{selectedColorName}</span>
        </div>
      )}

      {/* Hover-to-Zoom Helper Hint Indicator (Bottom Right) */}
      <div
        className={`absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight transition-all duration-200 pointer-events-none flex items-center gap-1.5 shadow-sm z-10 ${
          isZoomed
            ? 'bg-[#1b1340] text-white ring-2 ring-white/50 scale-105'
            : 'bg-white/90 backdrop-blur-md text-stone-600 border border-stone-200 group-hover:bg-[#6c4cf5] group-hover:text-white group-hover:border-transparent'
        }`}
      >
        <ZoomIn className="w-3.5 h-3.5" />
        <span>{isZoomed ? '2.4× Zoom Active' : 'Hover to Zoom Texture'}</span>
      </div>

      {/* Crosshair lens focal ring indicator when zoomed */}
      {isZoomed && (
        <div
          className="absolute w-12 h-12 rounded-full border-2 border-[#ff4fa3]/70 bg-white/10 pointer-events-none -translate-x-1/2 -translate-y-1/2 shadow-sm animate-pulse z-10"
          style={{
            left: `${origin.x}%`,
            top: `${origin.y}%`,
          }}
        />
      )}
    </div>
  );
};
