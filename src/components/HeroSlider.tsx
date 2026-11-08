import { DreamsHero } from './DreamsHero';
import '../../public/assets/dreams-hero.css';
import { useSiteContent } from '../admin/ContentContext';
import React, { useState, useEffect } from 'react';
import { Eye, ArrowRight, Sparkles, CheckCircle2, ChevronRight, Layers, Palette, Camera } from 'lucide-react';
import { COLOR_SHADES } from '../data/paintsData';

interface HeroSliderProps {
  onOpenVisualizer: () => void;
  onExploreProducts: () => void;
  onSelectCategory: (categoryId: string) => void;
  onOpenLiveAR?: () => void;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({
  onOpenVisualizer,
  onExploreProducts,
  onSelectCategory,
  onOpenLiveAR,
}) => {
  // Active Hero Slide
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedHeroShade, setSelectedHeroShade] = useState(COLOR_SHADES[7]); // Terracotta Hearth

  const content = useSiteContent();
  useEffect(() => {
    if (content?.colours) {
      setSelectedHeroShade(previous => content.colours.find(c => c.code === previous.code) || content.colours[0]);
    }
  }, [content?.colours]);
  const defaultRooms = [
    {
      id: 'living',
      label: 'Contemporary Living',
      image: '/src/assets/images/hero_architectural_living_1793203849445.jpg',
      roomType: 'Interior Living Space',
      recommendedProduct: 'Areva Sheen Pro · Velvet Soft Sheen',
    },
    {
      id: 'bedroom',
      label: 'Minimalist Bedroom',
      image: '/src/assets/images/room_visualizer_bedroom_1793203849707.jpg',
      roomType: 'Master Suite Interior',
      recommendedProduct: 'Areva Dazzle Glow · Satin Silk',
    },
    {
      id: 'villa',
      label: 'Modern Villa Facade',
      image: '/src/assets/images/room_visualizer_exterior_1793203850484.jpg',
      roomType: 'Exterior Architectural Facade',
      recommendedProduct: 'Lumina LusterFinish · Weather Shield',
    },
  ];

  const heroRooms = content?.landingImages.length ? content.landingImages : defaultRooms;

  // Auto-slide room preview every 7 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % heroRooms.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [heroRooms.length]);

  const activeRoom = heroRooms[activeSlideIndex % heroRooms.length];

  const signatureShades = content?.colours ? content.colours.slice(0, 6) : [
    COLOR_SHADES[7], // Terracotta Hearth
    COLOR_SHADES[16], // Calm Linen
    COLOR_SHADES[3], // Lagoon
    COLOR_SHADES[20], // Coorg Eucalyptus
    COLOR_SHADES[8], // Sand Dune
    COLOR_SHADES[9], // Mist Grey
  ];

  return (
    <>
    <DreamsHero />
    <section className="relative overflow-hidden bg-gradient-to-b from-stone-50 via-white to-stone-50 pt-8 pb-16 lg:pt-14 lg:pb-24 border-b border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Editorial Split Hero Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column: Architectural Editorial Copy & Swatch Controls (6 Cols) */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Unboxed Metadata Trust Line */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-amber-800 tracking-wider uppercase">
              <span>EST. 2003</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span>KARNATAKA · MAHARASHTRA · TN · AP</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> LOW-VOC & LEAD-FREE
              </span>
            </div>

            {/* Display Headline */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-stone-950 tracking-tight leading-[1.08] text-balance">
              Coatings engineered to <span className="text-amber-700 underline decoration-amber-300 underline-offset-8">transform spaces</span> & endure the climate.
            </h1>

            {/* Body Prose */}
            <p className="text-stone-600 text-base sm:text-lg leading-relaxed max-w-xl font-medium">
              Formulated with cross-linking pure acrylic polymers, elastomeric waterproofing membranes, and artisanal textures. Preview shades directly in real room environments or open your camera for live 3D wall recoloring.
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {onOpenLiveAR && (
                <button
                  onClick={onOpenLiveAR}
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-4 text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 active:scale-[0.99] rounded-full shadow-lg shadow-amber-900/20 hover:shadow-xl transition-all whitespace-nowrap"
                  title="Open live camera WebXR wall recoloring"
                >
                  <Camera className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>WebXR Live AR Camera</span>
                </button>
              )}

              <button
                onClick={onOpenVisualizer}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 text-xs font-bold text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 active:scale-[0.99] rounded-full transition-all whitespace-nowrap shadow-2xs"
              >
                <Eye className="w-4 h-4 text-amber-700" />
                <span>Visualizer Studio</span>
              </button>

              <a
                href="#solutions"
                onClick={onExploreProducts}
                className="pc-hub-cta inline-flex items-center justify-center gap-2 px-5 py-4 text-xs font-semibold text-stone-600 hover:text-stone-950 hover:bg-stone-100 rounded-full transition-all whitespace-nowrap"
              >
                <span>Explore products →</span>
              </a>
            </div>

            {/* Interactive Live Swatch Bar */}
            <div className="pt-4 border-t border-stone-200">
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="font-bold text-stone-800 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-amber-700" />
                  <span>Interactive Room Tint: <strong className="text-stone-950">{selectedHeroShade.name}</strong> ({selectedHeroShade.code})</span>
                </span>
                <button
                  onClick={onOpenVisualizer}
                  className="text-amber-800 font-bold hover:underline text-[11px]"
                >
                  Open 24+ Palette →
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {signatureShades.map((shade) => {
                  const isActive = selectedHeroShade.code === shade.code;
                  return (
                    <button
                      key={shade.code}
                      onClick={() => setSelectedHeroShade(shade)}
                      className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0 ${
                        isActive
                          ? 'border-stone-950 bg-white shadow-sm ring-2 ring-stone-950/15'
                          : 'border-stone-200 bg-white/80 hover:bg-white hover:border-stone-300'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-black/15 shrink-0 transition-transform group-hover:scale-110"
                        style={{ backgroundColor: shade.hex }}
                      />
                      <span className="text-stone-800 whitespace-nowrap text-xs">{shade.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column: Architectural Photography Stage (6 Cols) */}
          <div className="lg:col-span-6 space-y-3">
            
            {/* Room Tabs Switcher */}
            <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-2xl w-fit">
              {heroRooms.map((room, idx) => (
                <button
                  key={room.id}
                  onClick={() => setActiveSlideIndex(idx)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeSlideIndex === idx
                      ? 'bg-white text-stone-950 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {room.label || "Image " + (idx + 1)}
                </button>
              ))}
            </div>

            {/* Room Stage with Dynamic Tint Overlay */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-stone-200 bg-stone-950 group">
              
              <img
                src={activeRoom.image}
                alt={activeRoom.label || "Landing image"}
                className="w-full h-84 sm:h-110 lg:h-120 object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
                referrerPolicy="no-referrer"
              />

              {/* Dynamic subtle accent wall tint overlay responding to swatch clicks */}
              <div
                className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-35 transition-colors duration-500"
                style={{ backgroundColor: selectedHeroShade.hex }}
              />

              {/* Floating Architectural Spec Card at bottom */}
              <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-lg flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-xl shadow-inner border border-stone-300 shrink-0 flex items-center justify-center font-mono text-[10px] font-bold text-stone-800"
                    style={{ backgroundColor: selectedHeroShade.hex }}
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-extrabold text-stone-900 truncate">
                      {selectedHeroShade.name} ({selectedHeroShade.code})
                    </h4>
                    <p className="text-[11px] text-stone-500 truncate">
                      {activeRoom.recommendedProduct}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onOpenVisualizer();
                    document.getElementById('visualizer')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-4 py-2 rounded-xl bg-stone-950 text-white text-xs font-bold hover:bg-amber-800 transition-colors shrink-0 shadow-xs"
                >
                  Open in Studio
                </button>
              </div>

            </div>

          </div>

        </div>

        {/* 4-Column Minimalist Metric Proof Strip */}
        <div className="mt-14 pt-8 border-t border-stone-200 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex flex-col">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-stone-950 font-mono tabular-nums">2003</span>
            <span className="text-xs text-stone-500 mt-1 font-medium">Over 20 years supplying contractors & architects</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-stone-950 font-mono tabular-nums">14+</span>
            <span className="text-xs text-stone-500 mt-1 font-medium">Specialized interior, exterior & waterproofing systems</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-stone-950 font-mono tabular-nums">&lt;5 g/L</span>
            <span className="text-xs text-stone-500 mt-1 font-medium">Certified low-VOC formulations for healthy air</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-stone-950 font-mono tabular-nums">4 States</span>
            <span className="text-xs text-stone-500 mt-1 font-medium">Karnataka, Maharashtra, Tamil Nadu & Andhra Pradesh</span>
          </div>
        </div>

      </div>
    </section>
    </>
  );
};
