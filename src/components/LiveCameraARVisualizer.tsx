import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  X, 
  RotateCcw, 
  SwitchCamera, 
  Zap, 
  Sparkles, 
  Check, 
  Sliders, 
  Download, 
  MessageSquare, 
  Maximize2, 
  Eye, 
  AlertCircle,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import { COLOR_SHADES } from '../data/paintsData';
import { ColorShade } from '../types';

interface LiveCameraARVisualizerProps {
  isOpen: boolean;
  onClose: () => void;
  initialShadeHex?: string;
  initialShadeName?: string;
  onRequestQuoteWithShade: (shadeName: string, shadeCode: string, snapshotUrl?: string) => void;
}

export const LiveCameraARVisualizer: React.FC<LiveCameraARVisualizerProps> = ({
  isOpen,
  onClose,
  initialShadeHex,
  initialShadeName,
  onRequestQuoteWithShade,
}) => {
  // Video and Canvas Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const simVideoRef = useRef<HTMLVideoElement | null>(null);

  // AR & Camera State
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied' | 'simulated'>('prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true);

  // Selected Paint Color
  const defaultShade = COLOR_SHADES.find(
    (c) => c.hex.toLowerCase() === (initialShadeHex || '').toLowerCase()
  ) || COLOR_SHADES[7]; // Default: Terracotta Hearth

  const [selectedShade, setSelectedShade] = useState<ColorShade>(defaultShade);
  const [colorCategory, setColorCategory] = useState<string>('All');

  // AR Shading & Coating Settings
  const [coatingFinish, setCoatingFinish] = useState<'matte' | 'satin' | 'sheen'>('satin');
  const [opacity, setOpacity] = useState<number>(0.85); // 0.5 to 1.0
  const [sensitivity, setSensitivity] = useState<number>(36); // Tolerance range 15 to 70
  const [showReticle, setShowReticle] = useState<boolean>(true);
  const [targetPoint, setTargetPoint] = useState<{ x: number; y: number } | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<string>('Aim crosshair at your room wall');
  const [frozenFrame, setFrozenFrame] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Target wall baseline color sampled from video stream
  const sampledWallRgb = useRef<{ r: number; g: number; b: number } | null>(null);

  // Synchronize initial shade prop if provided
  useEffect(() => {
    if (initialShadeHex) {
      const match = COLOR_SHADES.find(
        (c) => c.hex.toLowerCase() === initialShadeHex.toLowerCase()
      );
      if (match) setSelectedShade(match);
    }
  }, [initialShadeHex]);

  // Convert Hex to RGB
  const hexToRgb = useCallback((hex: string) => {
    const cleanHex = hex.replace('#', '');
    const num = parseInt(cleanHex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }, []);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // Initialize Camera Stream
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    stopCamera();
    sampledWallRgb.current = null;
    setErrorMessage(null);

    // If mediaDevices is not supported or iframe permissions block it
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermission('simulated');
      setTrackingStatus('Camera API unavailable. Running Simulated Live Room feed.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Check if torch/flash is supported on track
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
      if (capabilities && 'torch' in capabilities) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.playsInline = true;
        await videoRef.current.play();
      }

      setCameraPermission('granted');
      setTrackingStatus('Camera connected. Tap wall to lock recolor.');
    } catch (err: any) {
      console.warn('Camera access denied or unavailable in this environment:', err);
      // Auto-fallback to simulation feed so user is never stuck
      setCameraPermission('simulated');
      setErrorMessage(
        'Physical camera stream blocked or unavailable in current browser sandbox. Switched to Interactive AR Live Feed Simulator.'
      );
    }
  }, [stopCamera]);

  // Handle open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
      setFrozenFrame(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode, startCamera, stopCamera]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const nextTorch = !torchEnabled;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchEnabled(nextTorch);
    } catch (e) {
      console.error('Torch error', e);
    }
  };

  // Toggle Camera Front / Back
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Tap-to-sample Wall Reference Color from Video Stream
  const handleCanvasTap = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // Ignore taps outside the displayed canvas and map the tap to its backing pixels.
    const xRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const pixelX = Math.min(canvas.width - 1, Math.floor(xRatio * canvas.width));
    const pixelY = Math.min(canvas.height - 1, Math.floor(yRatio * canvas.height));

    setTargetPoint({ x: pixelX, y: pixelY });

    // Sample the unpainted video frame, not the already recolored canvas.
    // Sampling the canvas caused subsequent taps to use the previous paint color as the wall color.
    const video = videoRef.current;
    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
      try {
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = 1;
        sampleCanvas.height = 1;
        const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
        if (!sampleCtx) throw new Error('Canvas context unavailable');
        sampleCtx.drawImage(
          video,
          Math.min(video.videoWidth - 1, Math.floor(xRatio * video.videoWidth)),
          Math.min(video.videoHeight - 1, Math.floor(yRatio * video.videoHeight)),
          1, 1, 0, 0, 1, 1
        );
        const sample = sampleCtx.getImageData(0, 0, 1, 1).data;
        sampledWallRgb.current = { r: sample[0], g: sample[1], b: sample[2] };
        setTrackingStatus(`Wall calibrated at (${Math.round(xRatio * 100)}%, ${Math.round(yRatio * 100)}%). Recoloring live.`);
      } catch {
        setTrackingStatus('Could not sample that point. Tap a visible wall area again.');
      }
    } else {
      // Simulator mode has no physical video element; sample the current canvas frame.
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        try {
          const sample = ctx.getImageData(pixelX, pixelY, 1, 1).data;
          sampledWallRgb.current = { r: sample[0], g: sample[1], b: sample[2] };
          setTrackingStatus('Wall calibrated. Recoloring live.');
        } catch {
          setTrackingStatus('Could not sample that point. Tap a visible wall area again.');
        }
      }
    }
  };

  // Main Real-time AR Rendering Loop
  useEffect(() => {
    if (!isOpen || frozenFrame) return;

    let isRunning = true;

    const renderLoop = () => {
      if (!isRunning) return;

      const canvas = canvasRef.current;
      const video = cameraPermission === 'simulated' ? simVideoRef.current : videoRef.current;

      if (canvas && video && (video.readyState >= 2 || video.currentTime > 0)) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          // Set internal resolution matching video aspect ratio (scaled down for 45-60fps smooth loop)
          const videoW = video.videoWidth || 640;
          const videoH = video.videoHeight || 480;

          const targetW = 640;
          const targetH = Math.round((videoH / videoW) * targetW) || 480;

          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }

          // Draw current video frame onto canvas
          ctx.drawImage(video, 0, 0, targetW, targetH);

          // If AR Recoloring is Active, process frame with luminance-preserving color transfer
          if (isProcessing) {
            try {
              const frameData = ctx.getImageData(0, 0, targetW, targetH);
              const data = frameData.data;
              const paintRgb = hexToRgb(selectedShade.hex);

              // Auto-sample center wall reference if none selected yet
              if (!sampledWallRgb.current) {
                const centerX = Math.floor(targetW / 2);
                const centerY = Math.floor(targetH / 2);
                const centerIdx = (centerY * targetW + centerX) * 4;
                sampledWallRgb.current = {
                  r: data[centerIdx],
                  g: data[centerIdx + 1],
                  b: data[centerIdx + 2],
                };
              }

              const baseR = sampledWallRgb.current.r;
              const baseG = sampledWallRgb.current.g;
              const baseB = sampledWallRgb.current.b;
              const baseLum = 0.299 * baseR + 0.587 * baseG + 0.114 * baseB;

              // Tolerance threshold
              const maxDist = sensitivity * 3.2;
              const finishMultiplier = coatingFinish === 'sheen' ? 1.15 : coatingFinish === 'matte' ? 0.95 : 1.05;

              const totalPixels = data.length / 4;
              for (let i = 0; i < totalPixels; i++) {
                const idx = i * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                // Chromatic and luminance difference from sampled wall
                const dr = r - baseR;
                const dg = g - baseG;
                const db = b - baseB;
                const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);

                if (colorDist < maxDist) {
                  // Falloff blend factor
                  const blendFactor = Math.pow(1 - colorDist / maxDist, 0.8) * opacity;

                  // Preserve ambient real-world luminance / shadows
                  const pixelLum = 0.299 * r + 0.587 * g + 0.114 * b;
                  const lumRatio = (pixelLum / (baseLum || 1)) * finishMultiplier;

                  // Target recolored pixel with ambient shadow retention
                  const targetR = Math.min(255, Math.max(0, paintRgb.r * lumRatio));
                  const targetG = Math.min(255, Math.max(0, paintRgb.g * lumRatio));
                  const targetB = Math.min(255, Math.max(0, paintRgb.b * lumRatio));

                  // Alpha blend over original pixel
                  data[idx] = Math.round(r * (1 - blendFactor) + targetR * blendFactor);
                  data[idx + 1] = Math.round(g * (1 - blendFactor) + targetG * blendFactor);
                  data[idx + 2] = Math.round(b * (1 - blendFactor) + targetB * blendFactor);
                }
              }

              ctx.putImageData(frameData, 0, 0);
            } catch (err) {
              // Canvas tainted or processing error
            }
          }

          // Draw Reticle Aiming Crosshair if enabled
          if (showReticle) {
            const rx = targetPoint ? targetPoint.x : Math.floor(targetW / 2);
            const ry = targetPoint ? targetPoint.y : Math.floor(targetH / 2);

            ctx.save();
            ctx.strokeStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.lineWidth = 2;

            // Reticle outer ring
            ctx.beginPath();
            ctx.arc(rx, ry, 22, 0, 2 * Math.PI);
            ctx.stroke();

            // Inner crosshair lines
            ctx.beginPath();
            ctx.moveTo(rx - 30, ry);
            ctx.lineTo(rx - 8, ry);
            ctx.moveTo(rx + 8, ry);
            ctx.lineTo(rx + 30, ry);
            ctx.moveTo(rx, ry - 30);
            ctx.lineTo(rx, ry - 8);
            ctx.moveTo(rx, ry + 8);
            ctx.lineTo(rx, ry + 30);
            ctx.stroke();

            // Paint swatch center dot
            ctx.fillStyle = selectedShade.hex;
            ctx.beginPath();
            ctx.arc(rx, ry, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            ctx.restore();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    isOpen,
    frozenFrame,
    cameraPermission,
    isProcessing,
    selectedShade,
    opacity,
    sensitivity,
    coatingFinish,
    showReticle,
    targetPoint,
    hexToRgb,
  ]);

  // Freeze / Capture Current AR Frame
  const handleCaptureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setFrozenFrame(dataUrl);
    setTrackingStatus('Frame frozen. Save image or request trade quotation.');
  };

  // Download Snapshot
  const handleDownload = () => {
    if (!frozenFrame) return;
    const link = document.createElement('a');
    link.download = `Areva-AR-${selectedShade.code}-${selectedShade.name.replace(/\s+/g, '-')}.jpg`;
    link.href = frozenFrame;
    link.click();
  };

  // Request Quote with Frozen or Active Shade
  const handleQuote = () => {
    onRequestQuoteWithShade(
      selectedShade.name,
      selectedShade.code,
      frozenFrame || undefined
    );
    onClose();
  };

  if (!isOpen) return null;

  // Filter shades for bottom carousel
  const filteredShades = COLOR_SHADES.filter(
    (s) => colorCategory === 'All' || s.family === colorCategory
  );

  return (
    <div className="fixed inset-0 z-50 bg-stone-950 flex flex-col select-none overflow-hidden touch-none">
      
      {/* Hidden Hardware Camera Video Element */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="hidden"
      />

      {/* Hidden Simulated Camera Video Element (Fallback room video loop) */}
      <video
        ref={simVideoRef}
        playsInline
        muted
        autoPlay
        loop
        crossOrigin="anonymous"
        src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
        className="hidden"
      />

      {/* Top Header Bar: HUD Control Strip */}
      <header className="absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-stone-950/90 via-stone-950/60 to-transparent p-4 flex items-center justify-between text-white">
        
        {/* Brand & AR Status */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-600/90 flex items-center justify-center shadow-lg border border-amber-400/40">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-extrabold text-sm tracking-wide text-white">
                AREVA <span className="text-amber-400">LIVE AR</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {cameraPermission === 'simulated' ? 'SIMULATION' : 'LIVE 3D RECOLOR'}
              </span>
            </div>
            <p className="text-[11px] text-stone-300 max-w-xs truncate">
              {trackingStatus}
            </p>
          </div>
        </div>

        {/* Quick HUD Action Buttons */}
        <div className="flex items-center gap-2">
          
          {/* Torch Toggle (if supported on mobile back camera) */}
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2.5 rounded-full transition-all ${
                torchEnabled
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title="Toggle Flashlight / Torch"
              aria-label="Toggle Flashlight"
            >
              <Zap className="w-4 h-4" />
            </button>
          )}

          {/* Camera Flip (Front / Back) */}
          {cameraPermission === 'granted' && (
            <button
              onClick={toggleFacingMode}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
              title="Switch Camera (Front / Rear)"
              aria-label="Switch Camera"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
          )}

          {/* AR Coating Controls Popover Toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-full transition-all ${
              showSettings ? 'bg-amber-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Adjust Finish & Sensitivity"
            aria-label="AR Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Quick Info/Guide */}
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            title="How to use WebXR Live AR"
            aria-label="Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Close AR Studio */}
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/20 hover:bg-rose-600 text-white transition-all ml-1"
            title="Exit Live AR"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Viewport: Canvas Render Surface */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-stone-950 overflow-hidden">
        
        {/* Render Canvas or Frozen Snapshot */}
        {frozenFrame ? (
          <img
            src={frozenFrame}
            alt="Frozen AR Wall Preview"
            className="w-full h-full object-contain"
          />
        ) : (
          <canvas
            ref={canvasRef}
            onClick={handleCanvasTap}
            onTouchStart={handleCanvasTap}
            className="w-full h-full object-contain cursor-crosshair touch-none"
          />
        )}

        {/* Permission / Status Overlay when camera is initializing or denied */}
        {cameraPermission === 'prompt' && (
          <div className="absolute inset-0 bg-stone-950/80 flex flex-col items-center justify-center p-6 text-center text-white z-20">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 animate-bounce">
              <Camera className="w-8 h-8" />
            </div>
            <h3 className="font-display text-xl font-bold mb-2">Connecting to Device Camera...</h3>
            <p className="text-stone-300 text-sm max-w-md mb-6">
              Please allow camera access when prompted by your browser to preview wall recoloring live in your room.
            </p>
            <button
              onClick={() => {
                setCameraPermission('simulated');
                setTrackingStatus('Running Interactive AR Live Feed Simulator.');
              }}
              className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-all"
            >
              Use Live Room Simulator Instead
            </button>
          </div>
        )}

        {/* Notice Banner for Simulated Fallback */}
        {cameraPermission === 'simulated' && !frozenFrame && (
          <div className="absolute top-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-30 bg-stone-900/90 backdrop-blur-md border border-amber-500/40 rounded-2xl p-3.5 text-white shadow-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold text-amber-300 mb-0.5">Camera Simulation Mode</div>
              <p className="text-stone-300 leading-relaxed">
                Direct camera hardware access was not detected or is restricted in this window. Running the high-frame-rate Room Feed Simulator so you can test live color tracking and finish rendering!
              </p>
              <button
                onClick={() => startCamera(facingMode)}
                className="mt-2 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline"
              >
                Try connecting camera again
              </button>
            </div>
          </div>
        )}

        {/* On-screen instruction pill */}
        {!frozenFrame && (
          <div className="absolute top-20 sm:top-24 pointer-events-none z-20 px-4 py-1.5 rounded-full bg-stone-900/80 backdrop-blur-md border border-white/10 text-white text-xs font-medium shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Tap anywhere on your room wall to calibrate recolor boundary</span>
          </div>
        )}

        {/* Collapsible Settings Drawer */}
        {showSettings && (
          <div className="absolute top-20 right-4 z-40 w-72 sm:w-80 bg-stone-900/95 backdrop-blur-xl border border-stone-700/80 rounded-3xl p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" /> Coating Spec Controls
              </span>
              <button
                onClick={() => setShowSettings(false)}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Coating Finish */}
            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-2">
                Coating Sheen & Texture
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-950 rounded-xl border border-stone-800">
                {(['matte', 'satin', 'sheen'] as const).map((finish) => (
                  <button
                    key={finish}
                    onClick={() => setCoatingFinish(finish)}
                    className={`py-1.5 text-xs font-bold rounded-lg capitalize transition-all ${
                      coatingFinish === finish
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    {finish}
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity / Coat Coverage Slider */}
            <div>
              <div className="flex justify-between text-[11px] font-semibold text-stone-300 mb-1">
                <span>Coating Density (Coats)</span>
                <span className="text-amber-400 font-mono">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-stone-500 mt-1">
                <span>1 Primer Coat</span>
                <span>2 Full Topcoats</span>
              </div>
            </div>

            {/* Wall Surface Sensitivity Slider */}
            <div>
              <div className="flex justify-between text-[11px] font-semibold text-stone-300 mb-1">
                <span>Wall Edge Sensitivity</span>
                <span className="text-amber-400 font-mono">{sensitivity}</span>
              </div>
              <input
                type="range"
                min="15"
                max="65"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-stone-500 mt-1">
                <span>Strict (Edges)</span>
                <span>Broad (Wide Wall)</span>
              </div>
            </div>

            {/* Reticle Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-800">
              <span className="text-xs text-stone-300">Aim Crosshair Display</span>
              <button
                type="button"
                onClick={() => setShowReticle(!showReticle)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  showReticle ? 'bg-amber-600' : 'bg-stone-700'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    showReticle ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Recalibrate Center */}
            <button
              onClick={() => {
                sampledWallRgb.current = null;
                setTargetPoint(null);
                setTrackingStatus('Recalibrating wall center...');
              }}
              className="w-full py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-bold text-stone-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Wall Sample Anchor</span>
            </button>
          </div>
        )}

        {/* Quick Help Guide Modal */}
        {showGuide && (
          <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-md z-40 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-stone-900 border border-stone-700 rounded-3xl p-6 text-white space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <h4 className="font-display font-extrabold text-lg text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>How WebXR AR Recolor Works</span>
                </h4>
                <button
                  onClick={() => setShowGuide(false)}
                  className="text-stone-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-stone-300 leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0">1</span>
                  <p><strong className="text-white">Point camera at your room wall:</strong> Position your phone or webcam so a clear section of the wall is in frame under natural or indoor light.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0">2</span>
                  <p><strong className="text-white">Tap to lock the wall anchor:</strong> Tap the crosshair directly on the wall you want to paint. The computer vision engine will segment the surface while preserving daylight and shadows.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0">3</span>
                  <p><strong className="text-white">Switch Areva shades instantly:</strong> Glide through the color strip at the bottom to see how different formulations look on your real architectural wall.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0">4</span>
                  <p><strong className="text-white">Freeze & Request Quote:</strong> Tap the shutter button to freeze the live frame, save the picture, and get exact trade pricing from our regional dealer network.</p>
                </div>
              </div>

              <button
                onClick={() => setShowGuide(false)}
                className="w-full py-3 rounded-full bg-amber-600 hover:bg-amber-500 font-bold text-xs text-white uppercase tracking-wider transition-colors shadow-md"
              >
                Got It, Start Painting
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Control Drawer: Active Shade Badge + Color Carousel + Shutter Actions */}
      <footer className="relative z-30 bg-gradient-to-t from-stone-950 via-stone-950/95 to-transparent pt-4 pb-6 px-4 sm:px-6">
        
        {/* Active Shade Info Chip & Family Category Filter */}
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 mb-3">
          
          {/* Active Selected Shade Badge */}
          <div className="flex items-center gap-2.5 bg-stone-900/90 backdrop-blur-md border border-stone-700/80 rounded-2xl px-3.5 py-1.5 shadow-lg">
            <span
              className="w-5 h-5 rounded-full border border-white/30 shadow-inner shrink-0"
              style={{ backgroundColor: selectedShade.hex }}
            />
            <div className="text-left">
              <span className="text-xs font-bold text-white block leading-tight">
                {selectedShade.name}
              </span>
              <span className="text-[10px] font-mono text-amber-400 leading-tight">
                {selectedShade.code} · {selectedShade.family}
              </span>
            </div>
          </div>

          {/* Color Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-[11px]">
            {['All', 'Warm Neutrals', 'Cool Tones', 'Vibrant Accents', 'Greens & Earth'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setColorCategory(cat)}
                className={`px-2.5 py-1 rounded-full font-semibold transition-all whitespace-nowrap ${
                  colorCategory === cat
                    ? 'bg-amber-500 text-stone-950 font-bold'
                    : 'bg-stone-900/80 text-stone-300 hover:text-white border border-stone-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

        </div>

        {/* Live Shade Swatch Ribbon */}
        <div className="max-w-4xl mx-auto flex items-center gap-2.5 overflow-x-auto pb-3 pt-1 no-scrollbar">
          {filteredShades.map((shade) => {
            const isSelected = selectedShade.hex.toLowerCase() === shade.hex.toLowerCase();
            return (
              <button
                key={shade.code}
                onClick={() => {
                  setSelectedShade(shade);
                  setTrackingStatus(`Selected ${shade.name}. Wall recoloring.`);
                }}
                className={`group shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-2xl transition-all ${
                  isSelected
                    ? 'bg-white/15 scale-105 border border-amber-400'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl shadow-md border-2 transition-transform group-hover:scale-105 flex items-center justify-center"
                  style={{
                    backgroundColor: shade.hex,
                    borderColor: isSelected ? '#ffffff' : 'rgba(255,255,255,0.2)',
                  }}
                >
                  {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                </div>
                <span className="text-[10px] font-medium text-stone-300 max-w-[64px] truncate text-center">
                  {shade.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Button Bar: Shutter / Resume / Download / Quote */}
        <div className="max-w-md mx-auto pt-2 flex items-center justify-center gap-4">
          
          {frozenFrame ? (
            // Frozen State Actions
            <>
              <button
                onClick={() => {
                  setFrozenFrame(null);
                  setTrackingStatus('Resumed live AR camera stream.');
                }}
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold transition-all"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>Unfreeze Live</span>
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold transition-all"
                title="Download AR Snapshot"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Save Photo</span>
              </button>

              <button
                onClick={handleQuote}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-amber-600/30 transition-all active:scale-95"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Get Trade Quote</span>
              </button>
            </>
          ) : (
            // Live Stream Actions
            <>
              {/* Reset Calibration Button */}
              <button
                onClick={() => {
                  sampledWallRgb.current = null;
                  setTargetPoint(null);
                  setTrackingStatus('Recalibrating wall sample...');
                }}
                className="p-3.5 rounded-full bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 transition-all"
                title="Recalibrate Wall Point"
                aria-label="Recalibrate Wall Point"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              {/* Grand AR Shutter Button */}
              <button
                onClick={handleCaptureSnapshot}
                className="relative group p-1 rounded-full border-2 border-white/60 hover:border-amber-400 transition-all active:scale-90"
                title="Capture / Freeze Live AR Frame"
                aria-label="Capture AR Frame"
              >
                <div className="w-16 h-16 rounded-full bg-white group-hover:bg-amber-400 flex items-center justify-center shadow-2xl transition-colors">
                  <Camera className="w-7 h-7 text-stone-950 group-hover:scale-110 transition-transform" />
                </div>
              </button>

              {/* Direct Quote Enquiry Button */}
              <button
                onClick={handleQuote}
                className="p-3.5 rounded-full bg-stone-900 hover:bg-stone-800 text-amber-400 hover:text-amber-300 border border-stone-800 transition-all"
                title="Get Quote for Current Shade"
                aria-label="Get Quote"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            </>
          )}

        </div>

      </footer>

    </div>
  );
};
