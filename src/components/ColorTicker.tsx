import React from 'react';
import { COLOR_SHADES } from '../data/paintsData';

interface ColorTickerProps {
  onSelectColor: (hex: string, name: string) => void;
  onOpenVisualizer: () => void;
}

export const ColorTicker: React.FC<ColorTickerProps> = ({
  onSelectColor,
  onOpenVisualizer,
}) => {
  const tickerItems = [...COLOR_SHADES, ...COLOR_SHADES, ...COLOR_SHADES];

  return (
    <div className="bg-stone-100/80 border-y border-stone-200 py-3 overflow-hidden select-none">
      <div className="animate-marquee flex items-center">
        {tickerItems.map((shade, i) => (
          <button
            key={`${shade.code}-${i}`}
            onClick={() => {
              onSelectColor(shade.hex, shade.name);
              onOpenVisualizer();
              document.getElementById('visualizer')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 bg-white border border-stone-200/90 text-stone-900 rounded-full px-3.5 py-1.5 mr-3.5 shrink-0 shadow-2xs hover:border-stone-900 hover:shadow-xs transition-all text-xs font-semibold group cursor-pointer"
          >
            <span
              className="w-4 h-4 rounded-full border border-black/10 shrink-0 transition-transform group-hover:scale-110 shadow-inner"
              style={{ backgroundColor: shade.hex }}
            />
            <span className="whitespace-nowrap text-stone-900 font-bold">{shade.name}</span>
            <span className="text-[10px] text-stone-400 font-mono">({shade.code})</span>
          </button>
        ))}
      </div>
    </div>
  );
};
