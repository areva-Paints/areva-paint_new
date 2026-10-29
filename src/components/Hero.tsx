import React, { useState } from 'react';
import { Eye, ArrowRight, ShieldCheck, Droplets, Sparkles, CheckCircle2 } from 'lucide-react';
import { COLOR_SHADES } from '../data/paintsData';

interface HeroProps {
  onOpenVisualizer: () => void;
  onExploreProducts: () => void;
  onSelectColor: (hex: string, name: string) => void;
}

export const Hero: React.FC<HeroProps> = ({
  onOpenVisualizer,
  onExploreProducts,
  onSelectColor,
}) => {
  const [activeHeroColor, setActiveHeroColor] = useState(COLOR_SHADES[8]); // Sand Dune by default

  const quickSwatches = [
    COLOR_SHADES[8], // Sand Dune
    COLOR_SHADES[0], // Sunset Coral
    COLOR_SHADES[3], // Lagoon
    COLOR_SHADES[7], // Terracotta
    COLOR_SHADES[12], // Olive Grove
    COLOR_SHADES[10], // Midnight
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-stone-100 via-stone-50 to-white pt-8 pb-16 lg:pt-14 lg:pb-24 border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column: Copy & Actions */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Unboxed Metadata Trust Line */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-600 tracking-wide uppercase">
              <span className="text-amber-700">Karnataka · Maharashtra · TN · AP</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span>Founded 2003</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Eco Low-VOC
              </span>
            </div>

            {/* Display Headline */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-stone-950 tracking-tight leading-[1.08] text-balance">
              Architectural coatings engineered for <span className="text-amber-700 underline decoration-amber-300 underline-offset-6">lasting beauty</span> & climate defense.
            </h1>

            {/* Body Prose */}
            <p className="text-stone-600 text-base sm:text-lg leading-relaxed max-w-xl">
              From scrub-proof luxury interior emulsions to heavy monsoon elastomeric roof waterproofing. Experience real-time wall previewing in your own home before purchasing directly online.
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={onOpenVisualizer}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-amber-700 hover:bg-amber-800 active:scale-[0.99] rounded-xl shadow-md transition-all whitespace-nowrap"
              >
                <Eye className="w-4 h-4" />
                <span>Launch Room Visualizer</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>

              <button
                onClick={onExploreProducts}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 active:scale-[0.99] rounded-xl transition-all whitespace-nowrap shadow-xs"
              >
                <span>Browse Product Catalog</span>
              </button>
            </div>

            {/* Live Interactive Hero Swatch Bar */}
            <div className="pt-3 border-t border-stone-200">
              <p className="text-xs text-stone-500 font-medium mb-2.5 flex items-center justify-between">
                <span>Interactive Palette Preview: <strong className="text-stone-900 font-semibold">{activeHeroColor.name}</strong> ({activeHeroColor.code})</span>
                <span className="text-[11px] text-amber-700 cursor-pointer hover:underline" onClick={onOpenVisualizer}>View all 24 shades →</span>
              </p>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {quickSwatches.map((color) => {
                  const isActive = activeHeroColor.code === color.code;
                  return (
                    <button
                      key={color.code}
                      onClick={() => {
                        setActiveHeroColor(color);
                        onSelectColor(color.hex, color.name);
                      }}
                      className={`group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all shrink-0 ${
                        isActive
                          ? 'border-stone-950 bg-white shadow-sm ring-2 ring-stone-900/10'
                          : 'border-stone-200 bg-white/70 hover:bg-white hover:border-stone-300'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-black/10 shrink-0 transition-transform group-hover:scale-110"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="text-stone-700 whitespace-nowrap text-xs">{color.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column: High-Fidelity Room Showcase with dynamic tint */}
          <div className="lg:col-span-6">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-stone-200 bg-stone-900 group">
              
              {/* Generated Real Architectural Photo */}
              <img
                src="/src/assets/images/hero_architectural_living_1793203849445.jpg"
                alt="Contemporary architectural living room with floor-to-ceiling windows"
                className="w-full h-84 sm:h-110 lg:h-125 object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
                referrerPolicy="no-referrer"
              />

              {/* Dynamic subtle accent wall tint overlay responding to swatch clicks */}
              <div
                className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-30 transition-colors duration-500"
                style={{ backgroundColor: activeHeroColor.hex }}
              />

              {/* High-contrast floating info pill */}
              <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-white/80 shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg shadow-inner border border-stone-300 shrink-0 flex items-center justify-center font-mono text-[10px] font-bold text-stone-800"
                    style={{ backgroundColor: activeHeroColor.hex }}
                  />
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">{activeHeroColor.name} ({activeHeroColor.code})</h4>
                    <p className="text-[11px] text-stone-500">Visualized in Sheen Pro Velvet Matte Finish</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSelectColor(activeHeroColor.hex, activeHeroColor.name);
                    onOpenVisualizer();
                    document.getElementById('visualizer')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-stone-950 text-white text-xs font-medium hover:bg-amber-700 transition-colors shrink-0"
                >
                  Repaint Wall
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* 4-Column Proof Row below split */}
        <div className="mt-14 pt-8 border-t border-stone-200 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex flex-col">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-stone-950 font-mono tabular-nums">2003</span>
            <span className="text-xs text-stone-500 mt-1">Serving contractors & homeowners across 4 states</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-stone-950 font-mono tabular-nums">14+</span>
            <span className="text-xs text-stone-500 mt-1">Specialized industrial & decorative coating formulations</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-stone-950 font-mono tabular-nums">&lt;5 g/L</span>
            <span className="text-xs text-stone-500 mt-1">Zero to ultra-low VOC formulations for healthy indoor air</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-stone-950 font-mono tabular-nums">4 States</span>
            <span className="text-xs text-stone-500 mt-1">Authorized dealer depots across Karnataka, MH, TN & AP</span>
          </div>
        </div>

      </div>
    </section>
  );
};
