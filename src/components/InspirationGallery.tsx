import React, { useState } from 'react';
import { Sparkles, Eye, ArrowUpRight } from 'lucide-react';
import { COLOR_SHADES } from '../data/paintsData';

interface InspirationGalleryProps {
  onSelectColor: (hex: string, name: string) => void;
  onOpenVisualizer: () => void;
}

export const InspirationGallery: React.FC<InspirationGalleryProps> = ({
  onSelectColor,
  onOpenVisualizer,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const projects = [
    {
      category: 'Living',
      title: 'Warm Radiant Lounge',
      primaryShadeIndex: 0, // Sunset Coral
      secondaryShadeIndex: 8, // Sand Dune
      productName: 'Areva Sheen Pro',
      tagline: 'Sun-drenched living room with velvet micro-sheen reflection',
    },
    {
      category: 'Living',
      title: 'Calm Aegean Lounge',
      primaryShadeIndex: 4, // Sky Splash
      secondaryShadeIndex: 11, // Pearl White
      productName: 'Areva White Delight',
      tagline: 'Airy ceiling & coastal feature wall with 98% brightness opacity',
    },
    {
      category: 'Bedroom',
      title: 'Orchid Bloom Retreat',
      primaryShadeIndex: 6, // Orchid
      secondaryShadeIndex: 13, // Peach Cream
      productName: 'Areva Dazzle Glow',
      tagline: 'Luxury master bedroom with subtle light-reflecting satin finish',
    },
    {
      category: 'Bedroom',
      title: 'Soft Sand Sanctuary',
      primaryShadeIndex: 8, // Sand Dune
      secondaryShadeIndex: 9, // Mist Grey
      productName: 'Areva Sheen Pro',
      tagline: 'Warm earth tones with scuff-resistant durability',
    },
    {
      category: 'Exterior',
      title: 'Terracotta Heritage Facade',
      primaryShadeIndex: 7, // Terracotta
      secondaryShadeIndex: 8, // Sand Dune
      productName: 'Lumina LusterFinish',
      tagline: 'High UV resistance and tropical monsoon rain defense',
    },
    {
      category: 'Exterior',
      title: 'Lagoon Modernist Villa',
      primaryShadeIndex: 3, // Lagoon
      secondaryShadeIndex: 11, // Pearl White
      productName: 'Zester Series Textures',
      tagline: 'Sculpted quartz texture with dirt pick-up resistance',
    },
    {
      category: 'Kitchen',
      title: 'Mango Zest Modern Kitchen',
      primaryShadeIndex: 1, // Mango Zest
      secondaryShadeIndex: 11, // Pearl White
      productName: 'Areva Sheen Pro',
      tagline: 'High scrubbability Class 1 coating resisting steam and stains',
    },
    {
      category: 'Kitchen',
      title: 'Olive Grove & Cream Bistro',
      primaryShadeIndex: 12, // Olive Grove
      secondaryShadeIndex: 13, // Peach Cream
      productName: 'Areva Sheen Pro',
      tagline: 'Earthy botanical palette that brings nature indoors',
    },
  ];

  const filtered = projects.filter(
    (p) => activeFilter === 'All' || p.category === activeFilter
  );

  return (
    <section id="gallery" className="py-16 lg:py-24 bg-gradient-to-b from-[#fbfaff] via-[#f7f3ff] to-[#fbfaff] border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#ff4fa3] uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Architectural Inspiration & Real Projects</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#1b1340] tracking-tight">
              Curated Spaces & Designer Palettes
            </h2>
            <p className="text-stone-600 text-base mt-2 max-w-xl">
              Tap any inspirational space to immediately load its signature shade and coating system into the interactive room visualizer.
            </p>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {['All', 'Living', 'Bedroom', 'Exterior', 'Kitchen'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  activeFilter === filter
                    ? 'bg-[#1b1340] text-white shadow-md'
                    : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.map((proj, idx) => {
            const primaryColor = COLOR_SHADES[proj.primaryShadeIndex] || COLOR_SHADES[0];
            const secondaryColor = COLOR_SHADES[proj.secondaryShadeIndex] || COLOR_SHADES[1];

            return (
              <div
                key={idx}
                onClick={() => {
                  onSelectColor(primaryColor.hex, primaryColor.name);
                  onOpenVisualizer();
                  document.getElementById('visualizer')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="group relative rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1.5 flex flex-col justify-between min-h-[280px] p-6 text-white border border-white/20"
                style={{
                  background: `linear-gradient(145deg, ${primaryColor.hex}, ${secondaryColor.hex})`,
                }}
              >
                {/* Floating ambient circle decoration */}
                <div className="absolute -right-6 -bottom-6 w-36 h-36 rounded-full bg-white/15 blur-xl pointer-events-none" />

                {/* Top Badge */}
                <div className="flex items-center justify-between z-10">
                  <span className="px-3 py-1 rounded-full bg-black/25 backdrop-blur-md text-[11px] font-bold tracking-wide uppercase border border-white/20">
                    {proj.category}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight className="w-4 h-4 text-white" />
                  </div>
                </div>

                {/* Bottom Details */}
                <div className="space-y-2 z-10 pt-10">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full border border-white/60 shadow-xs"
                      style={{ backgroundColor: primaryColor.hex }}
                    />
                    <span className="text-xs font-bold text-white/95">
                      {primaryColor.name} ({primaryColor.code})
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-extrabold leading-snug drop-shadow-sm">
                    {proj.title}
                  </h3>

                  <p className="text-xs text-white/80 line-clamp-2 leading-relaxed">
                    {proj.tagline}
                  </p>

                  <div className="pt-2 border-t border-white/20 flex items-center justify-between text-[11px] font-bold">
                    <span>{proj.productName}</span>
                    <span className="text-amber-200 group-hover:underline flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> Try in Visualizer
                    </span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
