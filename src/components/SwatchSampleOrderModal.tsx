import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  Check, 
  Sparkles, 
  Sun, 
  Sunset, 
  Lightbulb, 
  Truck, 
  ShieldCheck, 
  RotateCcw, 
  ArrowRight, 
  ShoppingBag, 
  MapPin, 
  Phone, 
  User, 
  CheckCircle2, 
  FileText,
  Tag
} from 'lucide-react';
import { COLOR_SHADES } from '../data/paintsData';
import { ColorShade } from '../types';

interface SwatchSampleOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedShades?: ColorShade[];
  onOpenEnquiry?: () => void;
}

export const SwatchSampleOrderModal: React.FC<SwatchSampleOrderModalProps> = ({
  isOpen,
  onClose,
  initialSelectedShades,
  onOpenEnquiry,
}) => {
  // Step: 'builder' | 'shipping' | 'confirmation'
  const [step, setStep] = useState<'builder' | 'shipping' | 'confirmation'>('builder');

  // Selected Swatch Colors (Up to 5)
  const [selectedShades, setSelectedShades] = useState<ColorShade[]>(() => {
    if (initialSelectedShades && initialSelectedShades.length > 0) {
      return initialSelectedShades.slice(0, 5);
    }
    // Default 3 curated luxury shades
    return [COLOR_SHADES[7], COLOR_SHADES[0], COLOR_SHADES[5]]; // Terracotta Hearth, Ivory Whisper, Ocean Breeze
  });

  // Active swatch being inspected in the 3D peel preview
  const [activePreviewShade, setActivePreviewShade] = useState<ColorShade>(
    selectedShades[0] || COLOR_SHADES[7]
  );

  // Lighting Simulation
  const [lightingCondition, setLightingCondition] = useState<'morning' | 'sunset' | 'studio'>('studio');

  // Wall background texture simulation
  const [wallBg, setWallBg] = useState<'white' | 'charcoal' | 'greige'>('white');

  // Finish: Matte vs Satin
  const [selectedFinish, setSelectedFinish] = useState<'matte' | 'satin'>('satin');

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('560001');
  const [promoCode, setPromoCode] = useState('AREVAFREE');
  const [isPromoApplied, setIsPromoApplied] = useState(true);
  const [orderId, setOrderId] = useState<string>('');

  if (!isOpen) return null;

  const handleToggleShade = (shade: ColorShade) => {
    const isAlreadySelected = selectedShades.some((s) => s.code === shade.code);
    if (isAlreadySelected) {
      if (selectedShades.length <= 1) return; // Keep at least 1
      const updated = selectedShades.filter((s) => s.code !== shade.code);
      setSelectedShades(updated);
      if (activePreviewShade.code === shade.code) {
        setActivePreviewShade(updated[0]);
      }
    } else {
      if (selectedShades.length >= 5) return; // Max 5
      const updated = [...selectedShades, shade];
      setSelectedShades(updated);
      setActivePreviewShade(shade);
    }
  };

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoCode.trim().toUpperCase() === 'AREVAFREE' || promoCode.trim().toUpperCase() === 'FIRSTSAMPLE') {
      setIsPromoApplied(true);
    } else {
      alert('Invalid promo code. Use AREVAFREE for a complimentary first sample pack!');
    }
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !streetAddress || !pincode) {
      alert('Please fill in your complete shipping address and contact number.');
      return;
    }
    const generatedId = `ARV-SW-${Math.floor(100000 + Math.random() * 900000)}`;
    setOrderId(generatedId);
    setStep('confirmation');
  };

  // Lighting overlay styling
  const getLightingFilter = () => {
    switch (lightingCondition) {
      case 'morning':
        return 'brightness(1.05) contrast(0.98) drop-shadow(0 20px 25px rgba(217, 119, 6, 0.15))';
      case 'sunset':
        return 'sepia(0.2) hue-rotate(-10deg) brightness(0.95) contrast(1.05)';
      case 'studio':
      default:
        return 'none';
    }
  };

  const getWallBgClass = () => {
    switch (wallBg) {
      case 'charcoal':
        return 'bg-stone-900 border-stone-800 text-stone-200';
      case 'greige':
        return 'bg-[#e3ded9] border-stone-300 text-stone-800';
      case 'white':
      default:
        return 'bg-white border-stone-200 text-stone-900';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-700 text-white flex items-center justify-center shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Point 2 · Modernization Roadmap
                </span>
                <span className="text-xs text-stone-500 font-medium">8" × 10" Real Architectural Emulsion</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-950 leading-tight">
                Peel-and-Stick Swatch Sample Packs
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-500 hover:text-stone-950 rounded-xl hover:bg-stone-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          
          {step === 'builder' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Interactive 8x10 Peel Swatch Simulator (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Visualizer Stage */}
                <div className={`relative p-6 sm:p-8 rounded-3xl border transition-all duration-300 min-h-[400px] flex flex-col items-center justify-center overflow-hidden shadow-inner ${getWallBgClass()}`}>
                  
                  {/* Subtle Wall Texture Guide */}
                  <div className="absolute top-4 left-4 flex items-center gap-2 text-[11px] font-bold tracking-wide uppercase opacity-70">
                    <span>Simulated Test Wall: {wallBg}</span>
                  </div>

                  {/* Top Right: Lighting badge */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-xs text-[11px] font-bold text-stone-700 shadow-xs border border-stone-200">
                    {lightingCondition === 'morning' && <Sun className="w-3.5 h-3.5 text-amber-500" />}
                    {lightingCondition === 'sunset' && <Sunset className="w-3.5 h-3.5 text-rose-500" />}
                    {lightingCondition === 'studio' && <Lightbulb className="w-3.5 h-3.5 text-indigo-500" />}
                    <span className="capitalize">{lightingCondition} Light</span>
                  </div>

                  {/* 8x10 Adhesive Swatch with 3D Peel Effect */}
                  <div 
                    className="relative w-64 sm:w-72 h-84 sm:h-96 rounded-2xl shadow-2xl transition-all duration-300 transform hover:scale-[1.02] flex flex-col justify-between p-5 border border-black/10 select-none group"
                    style={{
                      backgroundColor: activePreviewShade.hex,
                      filter: getLightingFilter(),
                    }}
                  >
                    {/* Peel corner fold effect (Top Right) */}
                    <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none">
                      <div className="absolute top-0 right-0 w-8 h-8 bg-white/40 transform rotate-45 translate-x-3 -translate-y-3 shadow-md border-b border-l border-white/60"></div>
                    </div>

                    {/* Realistic Texture Sheen Overlay */}
                    <div 
                      className={`absolute inset-0 rounded-2xl pointer-events-none ${
                        selectedFinish === 'satin' 
                          ? 'bg-gradient-to-tr from-transparent via-white/10 to-white/20' 
                          : 'bg-black/5 mix-blend-multiply'
                      }`}
                    />

                    {/* Swatch Header Info */}
                    <div className="relative z-10 flex items-start justify-between">
                      <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-xs border border-stone-200/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block leading-none">
                          Areva Architectural
                        </span>
                        <span className="font-display font-black text-sm text-stone-900 block mt-0.5">
                          {activePreviewShade.name}
                        </span>
                      </div>
                      <span className="bg-stone-950/80 text-white font-mono text-[10px] font-bold px-2 py-1 rounded-md">
                        {activePreviewShade.code}
                      </span>
                    </div>

                    {/* Peel-and-Stick Indicator Badge in Center */}
                    <div className="relative z-10 self-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-[11px] font-semibold px-3 py-1 rounded-full backdrop-blur-xs flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>Peel backing & stick to wall</span>
                    </div>

                    {/* Swatch Footer Info */}
                    <div className="relative z-10 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-xs border border-stone-200/80 flex items-center justify-between text-xs text-stone-800">
                      <div>
                        <div className="text-[10px] text-stone-500 font-bold uppercase">Finish</div>
                        <div className="font-bold capitalize">{selectedFinish} Emulsion</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-stone-500 font-bold uppercase">Size</div>
                        <div className="font-bold">8" × 10" (20×25 cm)</div>
                      </div>
                    </div>
                  </div>

                  {/* Adhesive Tab hint */}
                  <p className="mt-4 text-xs opacity-75 font-medium text-center">
                    ✨ 100% genuine Areva paint coat on low-tack repositionable vinyl. Zero residue on your existing wall.
                  </p>
                </div>

                {/* Simulation Controls: Lighting & Background */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Lighting Selector */}
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-700">Daylight:</span>
                    <div className="inline-flex rounded-lg bg-stone-200/70 p-0.5 border border-stone-300">
                      <button
                        onClick={() => setLightingCondition('morning')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                          lightingCondition === 'morning' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                        }`}
                      >
                        <Sun className="w-3 h-3 text-amber-600" />
                        <span>Morning 5000K</span>
                      </button>
                      <button
                        onClick={() => setLightingCondition('sunset')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                          lightingCondition === 'sunset' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                        }`}
                      >
                        <Sunset className="w-3 h-3 text-rose-600" />
                        <span>Sunset 2700K</span>
                      </button>
                      <button
                        onClick={() => setLightingCondition('studio')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                          lightingCondition === 'studio' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                        }`}
                      >
                        <Lightbulb className="w-3 h-3 text-indigo-600" />
                        <span>Studio 4000K</span>
                      </button>
                    </div>
                  </div>

                  {/* Wall Color Tester */}
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-700">Wall Tone:</span>
                    <div className="inline-flex rounded-lg bg-stone-200/70 p-0.5 border border-stone-300">
                      <button
                        onClick={() => setWallBg('white')}
                        className={`px-2 py-1 rounded-md font-semibold ${wallBg === 'white' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'}`}
                      >
                        White
                      </button>
                      <button
                        onClick={() => setWallBg('greige')}
                        className={`px-2 py-1 rounded-md font-semibold ${wallBg === 'greige' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'}`}
                      >
                        Greige
                      </button>
                      <button
                        onClick={() => setWallBg('charcoal')}
                        className={`px-2 py-1 rounded-md font-semibold ${wallBg === 'charcoal' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'}`}
                      >
                        Charcoal
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Swatch Selection Palette & Cart (5 cols) */}
              <div className="lg:col-span-5 space-y-5">
                
                {/* Pack Builder Header */}
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-stone-950 text-base flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-amber-700" />
                      <span>Custom Swatch Bundle ({selectedShades.length}/5)</span>
                    </h3>
                    <span className="text-xs font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-full">
                      Free Shipping
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Select 3 to 5 shades. Each large 8"×10" peel-and-stick sheet allows you to test color under genuine morning, afternoon, and night lighting without painting your walls.
                  </p>
                </div>

                {/* Selected Swatches Ribbon */}
                <div>
                  <div className="text-xs font-bold text-stone-800 mb-2 flex items-center justify-between">
                    <span>Your Selected Swatches:</span>
                    <span className="text-stone-500 font-normal text-[11px]">Click swatch to preview 3D fold</span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 5 }).map((_, idx) => {
                      const shade = selectedShades[idx];
                      if (shade) {
                        const isActive = activePreviewShade.code === shade.code;
                        return (
                          <div
                            key={shade.code}
                            onClick={() => setActivePreviewShade(shade)}
                            className={`relative group cursor-pointer rounded-xl p-2 border transition-all flex flex-col items-center text-center ${
                              isActive
                                ? 'border-amber-600 ring-2 ring-amber-400 bg-amber-50/50'
                                : 'border-stone-200 bg-white hover:border-stone-400'
                            }`}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleShade(shade);
                              }}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-stone-900 text-white flex items-center justify-center text-[10px] hover:bg-rose-600 transition-colors shadow-xs"
                              title="Remove shade"
                            >
                              ×
                            </button>
                            <div
                              className="w-8 h-8 rounded-lg shadow-sm border border-black/10 mb-1"
                              style={{ backgroundColor: shade.hex }}
                            />
                            <span className="text-[10px] font-bold text-stone-900 line-clamp-1">
                              {shade.name}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={`empty-${idx}`}
                          className="rounded-xl border border-dashed border-stone-300 p-2 flex flex-col items-center justify-center text-stone-400 text-center min-h-[64px]"
                        >
                          <span className="text-xs font-bold">#{idx + 1}</span>
                          <span className="text-[9px] text-stone-400">Empty</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Palette Grid to Pick From */}
                <div>
                  <div className="text-xs font-bold text-stone-800 mb-2">
                    Available Areva Signature Palette:
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 border border-stone-200 rounded-xl bg-stone-50">
                    {COLOR_SHADES.map((shade) => {
                      const isSelected = selectedShades.some((s) => s.code === shade.code);
                      return (
                        <button
                          key={shade.code}
                          onClick={() => handleToggleShade(shade)}
                          className={`relative rounded-xl p-1.5 flex flex-col items-center gap-1 transition-all border ${
                            isSelected
                              ? 'bg-amber-100 border-amber-600 shadow-xs'
                              : 'bg-white border-stone-200 hover:border-stone-400'
                          }`}
                          title={`${shade.name} (${shade.code})`}
                        >
                          <div
                            className="w-full h-7 rounded-md border border-black/10 shadow-2xs relative"
                            style={{ backgroundColor: shade.hex }}
                          >
                            {isSelected && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/25 rounded-md">
                                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] font-bold text-stone-800 line-clamp-1 w-full text-center">
                            {shade.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Finish Preference */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-stone-800">Desired Coating Finish:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => setSelectedFinish('satin')}
                      className={`p-2.5 rounded-xl border text-left font-semibold transition-all ${
                        selectedFinish === 'satin'
                          ? 'border-amber-600 bg-amber-50 text-amber-950 ring-1 ring-amber-500'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <div className="font-bold">Satin Luxury Sheen</div>
                      <div className="text-[10px] text-stone-500 font-normal">Velvety soft reflection</div>
                    </button>
                    <button
                      onClick={() => setSelectedFinish('matte')}
                      className={`p-2.5 rounded-xl border text-left font-semibold transition-all ${
                        selectedFinish === 'matte'
                          ? 'border-amber-600 bg-amber-50 text-amber-950 ring-1 ring-amber-500'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <div className="font-bold">Pure Flat Matte</div>
                      <div className="text-[10px] text-stone-500 font-normal">Deep pigment, zero glare</div>
                    </button>
                  </div>
                </div>

                {/* Checkout & Next Button */}
                <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-stone-500 font-bold uppercase block">Sample Kit Price</span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-xl font-bold text-stone-950">
                        {isPromoApplied ? 'FREE' : '₹99'}
                      </span>
                      {isPromoApplied && (
                        <span className="text-xs text-stone-400 line-through">₹199</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setStep('shipping')}
                    disabled={selectedShades.length === 0}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    <span>Proceed to Shipping</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </div>

            </div>
          )}

          {step === 'shipping' && (
            <div className="max-w-2xl mx-auto space-y-6">
              
              <div className="text-center space-y-1">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Step 2 of 2</span>
                <h3 className="font-display text-2xl font-bold text-stone-950">
                  Where should we send your sample kit?
                </h3>
                <p className="text-xs text-stone-600">
                  Packed in moisture-proof architectural envelopes and dispatched via BlueDart / Delhivery Express.
                </p>
              </div>

              {/* Kit Summary Card */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {selectedShades.map((s) => (
                      <div
                        key={s.code}
                        className="w-7 h-7 rounded-full border-2 border-white shadow-xs"
                        style={{ backgroundColor: s.hex }}
                        title={s.name}
                      />
                    ))}
                  </div>
                  <div>
                    <div className="font-bold text-stone-900 text-xs">
                      {selectedShades.length} Swatch Sheets ({selectedFinish} finish)
                    </div>
                    <div className="text-[11px] text-stone-500">
                      {selectedShades.map((s) => s.name).join(', ')}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setStep('builder')}
                  className="text-xs font-bold text-amber-700 hover:underline"
                >
                  Edit Swatches
                </button>
              </div>

              {/* Shipping Form */}
              <form onSubmit={handlePlaceOrder} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Anand Murthy"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      WhatsApp Mobile Number *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 98765 43210"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Street Address & Apartment / Site Name *
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="e.g. Flat 402, Prestige Elm Park, Whitefield"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">State</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Pincode *</label>
                    <input
                      type="text"
                      required
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Promo Code Strip */}
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-semibold text-stone-800">
                      Complimentary Sample Voucher:
                    </span>
                    <span className="text-xs font-bold text-amber-800 font-mono bg-amber-200/70 px-2 py-0.5 rounded">
                      AREVAFREE
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Applied (100% OFF)</span>
                  </span>
                </div>

                {/* Buttons */}
                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep('builder')}
                    className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900"
                  >
                    ← Back to Palette
                  </button>

                  <button
                    type="submit"
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                  >
                    <Truck className="w-4 h-4" />
                    <span>Confirm & Dispatch Sample Pack</span>
                  </button>
                </div>
              </form>

            </div>
          )}

          {step === 'confirmation' && (
            <div className="max-w-xl mx-auto py-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  Order Successfully Dispatched
                </span>
                <h3 className="font-display text-2xl font-bold text-stone-950">
                  Your Areva Swatch Pack is On Its Way!
                </h3>
                <p className="text-xs text-stone-600 max-w-md mx-auto">
                  Tracking ID: <span className="font-mono font-bold text-stone-900">{orderId}</span>. A dispatch confirmation has been logged for delivery to {streetAddress}, {city} ({pincode}).
                </p>
              </div>

              {/* Spec Sheet Card */}
              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 text-left space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-stone-200">
                  <span className="font-bold text-stone-800">Enclosed Swatch Sheets:</span>
                  <span className="text-stone-500 font-mono">8" × 10" Low-Tack Vinyl</span>
                </div>
                <div className="space-y-2">
                  {selectedShades.map((shade) => (
                    <div key={shade.code} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-4 h-4 rounded-md border border-black/10 shadow-2xs"
                          style={{ backgroundColor: shade.hex }}
                        />
                        <span className="font-semibold text-stone-900">{shade.name}</span>
                        <span className="text-[10px] text-stone-500 font-mono">({shade.code})</span>
                      </div>
                      <span className="text-[11px] text-stone-600 capitalize font-medium">{selectedFinish} Finish</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setStep('builder');
                    onClose();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs transition-colors shadow-xs"
                >
                  Done
                </button>
                {onOpenEnquiry && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenEnquiry();
                    }}
                    className="px-6 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs transition-colors border border-amber-300"
                  >
                    Speak with Color Consultant
                  </button>
                )}
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
