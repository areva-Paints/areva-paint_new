import React, { useState, useRef, useEffect } from 'react';
import { 
  RotateCcw, 
  Undo2, 
  Upload, 
  Sliders, 
  Heart, 
  Printer, 
  Palette,
  MessageSquare,
  FileCheck,
  Camera
} from 'lucide-react';
import { ColorShade, RoomPreset } from '../types';
import { COLOR_SHADES, ROOM_PRESETS } from '../data/paintsData';

interface ColorVisualizerProps {
  selectedColorHex: string;
  selectedColorName: string;
  onSelectColor: (hex: string, name: string) => void;
  onRequestQuote: (shadeName: string, shadeCode: string) => void;
  onOpenLiveAR?: () => void;
}

export const ColorVisualizer: React.FC<ColorVisualizerProps> = ({
  selectedColorHex,
  selectedColorName,
  onSelectColor,
  onRequestQuote,
  onOpenLiveAR,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activePreset, setActivePreset] = useState<RoomPreset>(ROOM_PRESETS[0]);
  const [isCustomPhoto, setIsCustomPhoto] = useState(false);
  const [sliderPosition, setSliderPosition] = useState<number>(100); // 100 = full painted, 0 = full original
  const [tolerance, setTolerance] = useState<number>(24);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [colorFamily, setColorFamily] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [savedColors, setSavedColors] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('areva_saved_shades') || '["AR108", "AR112"]');
    } catch {
      return ['AR108', 'AR112'];
    }
  });

  const [appliedColors, setAppliedColors] = useState<Array<{ name: string; hex: string }>>([
    { name: selectedColorName, hex: selectedColorHex }
  ]);

  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Tap any wall to apply current shade.');

  // Current active shade object
  const currentShade = COLOR_SHADES.find(
    (c) => c.hex.toLowerCase() === selectedColorHex.toLowerCase()
  ) || {
    code: 'CUSTOM',
    name: selectedColorName || 'Custom Shade',
    hex: selectedColorHex,
    family: 'Warm Neutrals' as const,
    goesWellWith: ['#f4efe6', '#26305a', '#b9bfcc'],
  };

  // Load preset room or custom photo into canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const origCanvas = originalCanvasRef.current;
    if (!canvas || !origCanvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const origCtx = origCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !origCtx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxW = 960;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      origCanvas.width = canvas.width;
      origCanvas.height = canvas.height;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      origCtx.drawImage(img, 0, 0, canvas.width, canvas.height);

      setHistory([]);
      setStatusMessage(`Loaded ${activePreset.name}. Tap any wall area to paint.`);

      if (activePreset.accentCoordinates) {
        setTimeout(() => {
          applyPaintAt(
            activePreset.accentCoordinates![0] * (canvas.width / 960),
            activePreset.accentCoordinates![1] * (canvas.height / 540)
          );
        }, 100);
      }
    };

    img.src = activePreset.imageUrl;
  }, [activePreset]);

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const origCanvas = originalCanvasRef.current;
        if (!canvas || !origCanvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const origCtx = origCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx || !origCtx) return;

        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        origCanvas.width = canvas.width;
        origCanvas.height = canvas.height;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        origCtx.drawImage(img, 0, 0, canvas.width, canvas.height);

        setIsCustomPhoto(true);
        setHistory([]);
        setAppliedColors([]);
        setStatusMessage('Your photo is ready! Tap on any wall surface to paint.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Intelligent Luminance-Preserving Flood Fill Wall Paint
  const applyPaintAt = (x: number, y: number) => {
    const canvas = canvasRef.current;
    const origCanvas = originalCanvasRef.current;
    if (!canvas || !origCanvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const origCtx = origCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !origCtx) return;

    const width = canvas.width;
    const height = canvas.height;
    const currentImageData = ctx.getImageData(0, 0, width, height);
    const origImageData = origCtx.getImageData(0, 0, width, height);

    setHistory((prev) => [...prev.slice(-7), currentImageData]);

    const d = origImageData.data;
    const o = currentImageData.data;

    const startIndex = (Math.floor(y) * width + Math.floor(x)) * 4;
    const seedR = d[startIndex];
    const seedG = d[startIndex + 1];
    const seedB = d[startIndex + 2];

    const seedLum = Math.max(0.12, (0.299 * seedR + 0.587 * seedG + 0.114 * seedB) / 255);

    const cleanHex = selectedColorHex.replace('#', '');
    const targetInt = parseInt(cleanHex, 16);
    const targetR = (targetInt >> 16) & 255;
    const targetG = (targetInt >> 8) & 255;
    const targetB = targetInt & 255;

    const tolSq = tolerance * tolerance * 3;
    const visited = new Uint8Array(width * height);
    const stack: number[] = [Math.floor(y) * width + Math.floor(x)];

    let paintedPixels = 0;

    while (stack.length > 0) {
      const p = stack.pop()!;
      if (visited[p]) continue;
      visited[p] = 1;

      const idx = p * 4;
      const dr = d[idx] - seedR;
      const dg = d[idx + 1] - seedG;
      const db = d[idx + 2] - seedB;

      if (dr * dr + dg * dg + db * db > tolSq) continue;

      const pixelLum = (0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2]) / 255;
      const lumRatio = Math.min(1.4, Math.max(0.4, pixelLum / seedLum));

      o[idx] = Math.min(255, Math.round(targetR * lumRatio));
      o[idx + 1] = Math.min(255, Math.round(targetG * lumRatio));
      o[idx + 2] = Math.min(255, Math.round(targetB * lumRatio));
      paintedPixels++;

      const px = p % width;
      if (px > 0) stack.push(p - 1);
      if (px < width - 1) stack.push(p + 1);
      if (p >= width) stack.push(p - width);
      if (p < width * (height - 1)) stack.push(p + width);
    }

    if (paintedPixels < 40) {
      setStatusMessage('Point was too small or on an edge. Try tapping firmly on an open wall.');
      return;
    }

    ctx.putImageData(currentImageData, 0, 0);
    setStatusMessage(`Painted wall with ${selectedColorName}. Tap another area or try another shade.`);

    setAppliedColors((prev) => {
      const exists = prev.some((c) => c.hex.toLowerCase() === selectedColorHex.toLowerCase());
      if (!exists) {
        return [...prev, { name: selectedColorName, hex: selectedColorHex }];
      }
      return prev;
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    applyPaintAt(x, y);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prevImageData = history[history.length - 1];
    ctx.putImageData(prevImageData, 0, 0);
    setHistory((prev) => prev.slice(0, -1));
    setStatusMessage('Reverted last paint stroke.');
  };

  const handleReset = () => {
    const canvas = canvasRef.current;
    const origCanvas = originalCanvasRef.current;
    if (!canvas || !origCanvas) return;
    const ctx = canvas.getContext('2d');
    const origCtx = origCanvas.getContext('2d');
    if (!ctx || !origCtx) return;

    const origData = origCtx.getImageData(0, 0, origCanvas.width, origCanvas.height);
    ctx.putImageData(origData, 0, 0);
    setHistory([]);
    setAppliedColors([]);
    setStatusMessage('Reset to original photo.');
  };

  const toggleSaveColor = (code: string) => {
    const next = savedColors.includes(code)
      ? savedColors.filter((c) => c !== code)
      : [...savedColors, code];
    setSavedColors(next);
    try {
      localStorage.setItem('areva_saved_shades', JSON.stringify(next));
    } catch {}
  };

  const filteredShades = COLOR_SHADES.filter((shade) => {
    const matchesFamily = colorFamily === 'All' || shade.family === colorFamily;
    const matchesSearch =
      shade.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shade.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFamily && matchesSearch;
  });

  const handlePrintSummary = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const colorsHtml = appliedColors
      .map(
        (c) => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="width:24px;height:24px;border-radius:4px;border:1px solid #ddd;background:${c.hex};display:inline-block;"></span>
          <span style="font-weight:600;font-size:14px;color:#1c1917;">${c.name} (${c.hex})</span>
        </div>`
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Areva Paints - Color Visualizer Specification Card</title>
          <style>
            body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; padding: 32px; color: #1c1917; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 24px; margin-bottom: 4px; font-weight: 800; }
            .meta { color: #78716c; font-size: 13px; margin-bottom: 24px; }
            .img-box { border: 1px solid #e7e5e4; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
            .img-box img { width: 100%; height: auto; display: block; }
            .card { background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 10px; padding: 18px; margin-bottom: 20px; }
            .footer { font-size: 11px; color: #a8a29e; margin-top: 32px; border-top: 1px solid #e7e5e4; padding-top: 16px; }
          </style>
        </head>
        <body>
          <h1>Areva Paints · Architectural Color Specification</h1>
          <div class="meta">Generated for Painter & Contractor Reference · ${dateStr}</div>
          <div class="img-box">
            <img src="${dataUrl}" alt="Painted Room Preview" />
          </div>
          <div class="card">
            <h3 style="margin-top:0;font-size:16px;">Colours Applied in Visualizer</h3>
            ${colorsHtml || '<p style="color:#78716c;font-size:13px;">Current shade: ' + currentShade.name + ' (' + currentShade.hex + ')</p>'}
            <div style="margin-top:14px;font-size:13px;color:#57534e;">
              <strong>Recommended Topcoat:</strong> Areva Sheen Pro Interior Emulsion (Soft Sheen finish) or Lumina LusterFinish for Exterior.
            </div>
          </div>
          <div class="footer">
            Note: On-screen digital previews may vary slightly from real dried paint coatings. We recommend testing a physical shade card prior to full wall coverage. © 2026 Areva Paints.
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <section id="visualizer" className="py-14 lg:py-20 bg-stone-100 border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 tracking-wider uppercase mb-1.5">
            <Palette className="w-4 h-4" />
            <span>Interactive Coating Studio</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-950 tracking-tight">
            See Areva shades on your walls in real time.
          </h2>
          <p className="text-stone-600 text-base mt-2">
            Switch between architectural presets or upload a photo of your own room. Tap any surface to apply your chosen shade with realistic lighting preservation, then export a painter specification card or request a dealer quote.
          </p>
        </div>

        {/* Studio Workspace: Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Canvas Stage & Controls (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Room Selector Chips */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
              <div className="flex items-center gap-2 shrink-0">
                {ROOM_PRESETS.map((preset) => {
                  const isCurrent = !isCustomPhoto && activePreset.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setIsCustomPhoto(false);
                        setActivePreset(preset);
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                        isCurrent
                          ? 'bg-stone-900 text-white shadow-sm'
                          : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {preset.name}
                    </button>
                  );
                })}

                {onOpenLiveAR && (
                  <button
                    onClick={onOpenLiveAR}
                    type="button"
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap bg-stone-950 text-white hover:bg-amber-800 shadow-md ring-2 ring-amber-400/40 active:scale-95 cursor-pointer"
                    title="Open live camera feed with real-time 3D wall recoloring"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>Live Camera AR (Mobile & Webcam)</span>
                  </button>
                )}

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    isCustomPhoto
                      ? 'bg-amber-700 text-white shadow-sm'
                      : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload My Photo</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>

              {/* Status Note */}
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-stone-500 shrink-0">
                <span>Active:</span>
                <span className="font-bold text-stone-900">{currentShade.name}</span>
                <span
                  className="w-3 h-3 rounded-full border border-black/20 ml-0.5 inline-block"
                  style={{ backgroundColor: currentShade.hex }}
                />
              </div>
            </div>

            {/* Interactive Canvas Container */}
            <div className="relative rounded-2xl overflow-hidden bg-stone-950 border border-stone-300 shadow-xl select-none group">
              
              {/* Painted Canvas */}
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="w-full h-auto block cursor-crosshair touch-manipulation max-h-[540px] object-contain mx-auto"
                style={{
                  clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                  filter: isHoldingOriginal ? 'opacity(0)' : 'opacity(1)',
                }}
              />

              {/* Underlying Original Canvas (For Before/After Comparison) */}
              <canvas
                ref={originalCanvasRef}
                className="w-full h-auto absolute inset-0 -z-10 block pointer-events-none max-h-[540px] object-contain mx-auto"
              />

              {/* Split Line Indicator if Slider < 100 */}
              {sliderPosition < 99 && sliderPosition > 1 && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none z-10"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white text-stone-900 shadow-md flex items-center justify-center text-[10px] font-bold border border-stone-300">
                    ⇄
                  </div>
                </div>
              )}

              {/* Overlay Prompt on bottom of canvas */}
              <div className="absolute bottom-3 left-3 right-3 pointer-events-none flex items-center justify-between">
                <span className="bg-stone-950/80 backdrop-blur-md text-stone-200 text-xs px-2.5 py-1 rounded-md font-medium border border-white/10">
                  {statusMessage}
                </span>

                <div className="pointer-events-auto flex items-center gap-1.5">
                  <button
                    onMouseDown={() => setIsHoldingOriginal(true)}
                    onMouseUp={() => setIsHoldingOriginal(false)}
                    onTouchStart={() => setIsHoldingOriginal(true)}
                    onTouchEnd={() => setIsHoldingOriginal(false)}
                    className="bg-white/90 hover:bg-white text-stone-900 text-[11px] font-semibold px-2.5 py-1 rounded-md shadow-xs transition-colors"
                    title="Hold to see unpainted original"
                  >
                    Hold Original
                  </button>
                </div>
              </div>
            </div>

            {/* Canvas Toolbar & Comparison Slider */}
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
              
              {/* Slider Row */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-stone-600 whitespace-nowrap">Original (Before)</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPosition}
                  onChange={(e) => setSliderPosition(Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer h-2 bg-stone-200 rounded-lg"
                  aria-label="Before and after comparison slider"
                />
                <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">Painted (After)</span>
              </div>

              {/* Tool Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className="p-2 text-stone-700 hover:text-stone-950 disabled:text-stone-300 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors flex items-center gap-1 text-xs font-medium"
                    title="Undo last stroke"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Undo</span>
                  </button>

                  <button
                    onClick={handleReset}
                    className="p-2 text-stone-700 hover:text-stone-950 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors flex items-center gap-1 text-xs font-medium"
                    title="Reset to original photo"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>

                  {/* Tolerance Range Slider */}
                  <div className="hidden sm:flex items-center gap-2 text-xs text-stone-600 pl-2">
                    <Sliders className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-[11px]">Tolerance:</span>
                    <input
                      type="range"
                      min="12"
                      max="55"
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                      className="w-20 accent-stone-700 h-1.5 bg-stone-200 rounded"
                      title="Adjust wall edge detection range"
                    />
                    <span className="font-mono text-[11px] tabular-nums">{tolerance}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintSummary}
                    className="p-2 text-stone-800 border border-stone-200 hover:bg-stone-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
                  >
                    <Printer className="w-3.5 h-3.5 text-stone-600" />
                    <span>Export Spec Card</span>
                  </button>
                </div>
              </div>

            </div>

          </div>

          {/* Right: Color Selector, Complementary Pairings & Inquiry Module (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Active Color Preview & Spec Request Box */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-xl border border-black/10 shadow-inner flex items-center justify-center shrink-0"
                    style={{ backgroundColor: currentShade.hex }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        {currentShade.code}
                      </span>
                      <span className="text-xs text-stone-400">·</span>
                      <span className="text-xs text-stone-500 font-medium">{currentShade.family}</span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-stone-900 mt-0.5">{currentShade.name}</h3>
                    <p className="text-xs text-stone-500 font-mono">{currentShade.hex.toUpperCase()}</p>
                  </div>
                </div>

                <button
                  onClick={() => toggleSaveColor(currentShade.code)}
                  className={`p-2 rounded-xl border transition-colors ${
                    savedColors.includes(currentShade.code)
                      ? 'border-rose-200 bg-rose-50 text-rose-600'
                      : 'border-stone-200 text-stone-400 hover:text-stone-700'
                  }`}
                  aria-label="Save shade to wishlist"
                >
                  <Heart className={`w-5 h-5 ${savedColors.includes(currentShade.code) ? 'fill-rose-500' : ''}`} />
                </button>
              </div>

              {/* Complementary Shades ("Goes Well With") */}
              <div className="pt-3 border-t border-stone-100">
                <span className="text-xs font-semibold text-stone-600 block mb-2">
                  Harmonious Complementary Pairings:
                </span>
                <div className="flex items-center gap-2">
                  {currentShade.goesWellWith.map((pairHex) => {
                    const match = COLOR_SHADES.find(
                      (c) => c.hex.toLowerCase() === pairHex.toLowerCase()
                    );
                    const pairName = match ? match.name : pairHex;
                    return (
                      <button
                        key={pairHex}
                        onClick={() => onSelectColor(pairHex, pairName)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 hover:border-stone-900 bg-stone-50 hover:bg-white transition-all text-xs text-stone-700"
                        title={`Try pairing: ${pairName}`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
                          style={{ backgroundColor: pairHex }}
                        />
                        <span className="truncate max-w-[90px]">{pairName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Direct Technical Request Module */}
              <div className="pt-3 border-t border-stone-100 space-y-3">
                <p className="text-xs text-stone-600">
                  Ready to specify <strong className="text-stone-900">{currentShade.name}</strong> for your villa, apartment, or commercial project?
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onRequestQuote(currentShade.name, currentShade.code)}
                    className="py-2.5 px-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Request Quotation</span>
                  </button>

                  <button
                    onClick={handlePrintSummary}
                    className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-stone-200"
                  >
                    <FileCheck className="w-3.5 h-3.5 text-stone-600" />
                    <span>Print Spec Card</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Shade Library & Palette Explorer */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
              
              <div className="flex items-center justify-between">
                <h4 className="font-display text-sm font-bold text-stone-900">Areva Architectural Palette</h4>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-stone-600 flex items-center gap-1 cursor-pointer bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-md">
                    <span className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: selectedColorHex }} />
                    <span>Custom Hex</span>
                    <input
                      type="color"
                      value={selectedColorHex}
                      onChange={(e) => onSelectColor(e.target.value, `Custom (${e.target.value})`)}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {/* Search & Family Filter Tabs */}
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search shade name or code (e.g. Coral, AR108)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-stone-50"
                />

                <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
                  {['All', 'Warm Neutrals', 'Earthy & Clay', 'Coastal & Blues', 'Lush Greens', 'Vibrant Accents', 'Urban Greys'].map((fam) => (
                    <button
                      key={fam}
                      onClick={() => setColorFamily(fam)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                        colorFamily === fam
                          ? 'bg-stone-900 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {fam}
                    </button>
                  ))}
                </div>
              </div>

              {/* Swatch Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
                {filteredShades.map((shade) => {
                  const isCurrent = currentShade.code === shade.code;
                  return (
                    <button
                      key={shade.code}
                      onClick={() => onSelectColor(shade.hex, shade.name)}
                      className={`group flex flex-col items-center p-1.5 rounded-lg border text-center transition-all ${
                        isCurrent
                          ? 'border-stone-950 bg-stone-50 ring-2 ring-stone-950/20 shadow-xs'
                          : 'border-stone-200 hover:border-stone-400 hover:bg-stone-50'
                      }`}
                      title={`${shade.name} (${shade.code})`}
                    >
                      <div
                        className="w-full aspect-square rounded-md border border-black/10 shadow-xs transition-transform group-hover:scale-105"
                        style={{ backgroundColor: shade.hex }}
                      />
                      <span className="text-[10px] font-bold text-stone-800 truncate w-full mt-1">
                        {shade.code}
                      </span>
                      <span className="text-[9px] text-stone-500 truncate w-full leading-tight">
                        {shade.name}
                      </span>
                    </button>
                  );
                })}
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
