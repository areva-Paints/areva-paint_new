/*
 * Host the shared wall-selection painter with room/upload, shade-library and local export controls.
 */
import { escapeMarkup } from "../data/safeMarkup";
import { ColourCollectionHeading, ShadeLibrary } from "./ShadeLibrary";

import { useSiteContent } from "../admin/ContentContext";
import React, { useState, useRef, useEffect } from "react";
import { Upload, Printer, Palette, MessageSquare, Camera } from "lucide-react";
import { RoomPreset } from "../types";
import {
  decodePhoto,
  loadPhotoPainter,
  type PhotoPainter,
} from "../visualizer/photo-painter";
import "../../public/assets/photo-paint-studio.css";
import {
  COLOR_SHADES as DEFAULT_SHADES,
  ROOM_PRESETS,
} from "../data/paintsData";

interface ColorVisualizerProps {
  selectedColorHex: string;
  selectedColorName: string;
  onSelectColor: (hex: string, name: string) => void;
  onRequestQuote: (shadeName: string, shadeCode: string) => void;
  onOpenLiveAR?: () => void;
}

/* Select wall areas before painting; photos, exclusions and undo remain local. */
export const ColorVisualizer: React.FC<ColorVisualizerProps> = ({
  selectedColorHex,
  selectedColorName,
  onSelectColor,
  onRequestQuote,
  onOpenLiveAR,
}) => {
  const siteContent = useSiteContent();
  const COLOR_SHADES = siteContent?.colours || DEFAULT_SHADES;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const painterRef = useRef<PhotoPainter | null>(null);
  const imageGeneration = useRef(0);
  const chosenShade = useRef({
    hex: selectedColorHex,
    name: selectedColorName,
  });
  chosenShade.current = { hex: selectedColorHex, name: selectedColorName };
  const [painterReady, setPainterReady] = useState(false);

  const [activePreset, setActivePreset] = useState<RoomPreset>(ROOM_PRESETS[0]);
  const [isCustomPhoto, setIsCustomPhoto] = useState(false);
  const [savedColors, setSavedColors] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("areva_saved_shades") || '["AR108", "AR112"]',
      );
      return Array.isArray(saved)
        ? saved
            .filter(
              (value): value is string =>
                typeof value === "string" && value.length <= 40,
            )
            .slice(0, 5000)
        : [];
    } catch {
      return ["AR108", "AR112"];
    }
  });

  const [appliedColors, setAppliedColors] = useState<
    Array<{ name: string; hex: string }>
  >([]);

  const [statusMessage, setStatusMessage] = useState<string>(
    "Loading photo tools…",
  );

  // Current active shade object
  const currentShade = COLOR_SHADES.find(
    (c) => c.hex.toLowerCase() === selectedColorHex.toLowerCase(),
  ) || {
    code: "CUSTOM",
    name: selectedColorName || "Custom Shade",
    hex: selectedColorHex,
    family: "Classic Neutrals" as const,
    goesWellWith: ["#f4efe6", "#26305a", "#b9bfcc"],
  };

  /* The same bounded editor controls geometry, exclusions and paint in both studios. */
  useEffect(() => {
    let active = true;
    void loadPhotoPainter()
      .then((studio) => {
        if (
          !active ||
          !canvasRef.current ||
          !toolsRef.current ||
          !toolbarRef.current ||
          !viewportRef.current
        )
          return;
        painterRef.current = studio.createEditor({
          canvas: canvasRef.current,
          controls: toolsRef.current,
          toolbar: toolbarRef.current,
          viewport: viewportRef.current,
          onSelectShade: ({ hex, name }) => onSelectColor(hex, name),
          shade: () => chosenShade.current,
          swatches: COLOR_SHADES,
          onStatus: () => setStatusMessage(""),
          onChange: ({ colors }) => {
            setAppliedColors(colors);
          },
          onBeforeSelect: () => {},
        });
        setPainterReady(true);
      })
      .catch((error) => {
        if (active) setStatusMessage(error.message);
      });
    return () => {
      active = false;
      imageGeneration.current++;
      painterRef.current?.destroy();
      painterRef.current = null;
    };
  }, []);

  /* Keep displayed image geometry identical to the selection overlay on every device. */
  function showPhoto(image: HTMLImageElement, roomId?: string) {
    const canvas = canvasRef.current,
      original = originalCanvasRef.current;
    if (!canvas || !original || !painterRef.current) return;
    const scale = Math.min(
      1,
      960 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    canvas.width = original.width = Math.max(
      1,
      Math.round(image.naturalWidth * scale),
    );
    canvas.height = original.height = Math.max(
      1,
      Math.round(image.naturalHeight * scale),
    );
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const originalContext = original.getContext("2d", {
      willReadFrequently: true,
    });
    if (!context || !originalContext) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    originalContext.drawImage(image, 0, 0, canvas.width, canvas.height);
    painterRef.current.setImage(
      context.getImageData(0, 0, canvas.width, canvas.height),
      { roomId },
    );
  }

  /* Abandon stale room loads so they cannot overwrite a newer upload or selection. */
  useEffect(() => {
    if (isCustomPhoto || !painterReady) return;
    const generation = ++imageGeneration.current;
    const controller = new AbortController();
    painterRef.current?.setEnabled(false);
    setStatusMessage(`Loading ${activePreset.name}…`);
    void fetch(activePreset.imageUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw Error("Room photo could not load.");
        return response.blob();
      })
      .then(decodePhoto)
      .then((image) => {
        if (generation === imageGeneration.current)
          showPhoto(image, activePreset.id);
      })
      .catch((error) => {
        if (
          !controller.signal.aborted &&
          generation === imageGeneration.current
        )
          setStatusMessage(
            error.message ||
              "Could not load this room. Please upload a photo or choose another room.",
          );
      });
    return () => {
      controller.abort();
      if (generation === imageGeneration.current) imageGeneration.current++;
    };
  }, [activePreset, isCustomPhoto, painterReady]);

  useEffect(() => {
    painterRef.current?.shadeChanged();
  }, [selectedColorHex, selectedColorName]);
  useEffect(() => {
    painterRef.current?.setSwatches(COLOR_SHADES);
  }, [COLOR_SHADES, painterReady]);

  /* Decode a bounded supported photo locally; uploads never leave the browser. */
  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 20 * 1024 * 1024
    ) {
      setStatusMessage("Choose a JPEG, PNG or WebP photo up to 20 MB.");
      return;
    }
    if (!painterRef.current) {
      setStatusMessage("Photo tools are still loading. Please try again.");
      return;
    }
    const generation = ++imageGeneration.current;
    painterRef.current.setEnabled(false);
    setStatusMessage("Loading your photo…");
    try {
      const image = await decodePhoto(file);
      if (generation !== imageGeneration.current) return;
      showPhoto(image);
      setIsCustomPhoto(true);
    } catch (error) {
      if (generation === imageGeneration.current) {
        painterRef.current?.setEnabled(true);
        setStatusMessage(
          (error as Error).message ||
            "Could not open this photo. Try another JPEG, PNG or WebP.",
        );
      }
    }
  };

  /* Add or remove a shade from the local shortlist. */
  const toggleSaveColor = (code: string) => {
    const next = savedColors.includes(code)
      ? savedColors.filter((c) => c !== code)
      : [...savedColors, code];
    setSavedColors(next);
    try {
      localStorage.setItem("areva_saved_shades", JSON.stringify(next));
    } catch {}
  };

  /* Print the current room/shade summary from browser state. */
  const handlePrintSummary = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const colorsHtml = appliedColors
      .map(
        (c) => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="width:24px;height:24px;border-radius:4px;border:1px solid #ddd;background:${c.hex};display:inline-block;"></span>
          <span style="font-weight:600;font-size:14px;color:#1c1917;">${escapeMarkup(c.name)} (${escapeMarkup(c.hex)})</span>
        </div>`,
      )
      .join("");

    printWindow.opener = null;
    printWindow.addEventListener("load", () => printWindow.print(), {
      once: true,
    });
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
            ${colorsHtml || '<p style="color:#78716c;font-size:13px;">Current shade: ' + escapeMarkup(currentShade.name) + " (" + escapeMarkup(currentShade.hex) + ")</p>"}
            <div style="margin-top:14px;font-size:13px;color:#57534e;">
              <strong>Recommended Topcoat:</strong> Areva Sheen Pro Interior Emulsion (Soft Sheen finish) or Lumina LusterFinish for Exterior.
            </div>
          </div>
          <div class="footer">
            Note: On-screen digital previews may vary slightly from real dried paint coatings. We recommend testing a physical shade card prior to full wall coverage. © 2026 Areva Paints.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <section
      id="visualizer"
      className="py-14 lg:py-20 bg-stone-100 border-b border-stone-200"
    >
      <div className="page-gradient-banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="page-gradient-heading max-w-3xl mb-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 tracking-wider uppercase mb-1.5">
              <Palette className="w-4 h-4" />
              <span>Interactive Coating Studio</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-950 tracking-tight">
              See Areva shades on your walls in real time.
            </h2>
            <p className="text-stone-600 text-base mt-2">
              Switch between architectural presets or upload a photo of your own
              room. Select just one wall, choose a colour and press Paint
              selected wall. Keep the original lighting and texture, then save
              your favourite result. Export the preview or request a dealer
              quote.
            </p>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ColourCollectionHeading total={COLOR_SHADES.length} />
        {/* Studio Workspace: Split Grid */}
        <div className="colour-studio-grid">
          {/* Room preview and painting controls */}
          <div className="colour-room-panel space-y-4">
            <div
              className="ap-scenes"
              role="group"
              aria-label="Choose a room photo"
            >
              <h3>1. Choose a room or upload your home</h3>
              <div
                className="ap-room-presets"
                role="group"
                aria-label="Room types"
              >
                {ROOM_PRESETS.map((preset) => {
                  const label =
                    (
                      {
                        "nordic-living": "Living room",
                        "master-bedroom": "Bedroom",
                        "kitchen-studio": "Kitchen",
                        "modern-villa": "Exterior",
                        "office-studio": "Office",
                      } as Record<string, string>
                    )[preset.id] || preset.name;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className="ap-room-preset"
                      aria-pressed={
                        !isCustomPhoto && activePreset.id === preset.id
                      }
                      onClick={() => {
                        setIsCustomPhoto(false);
                        setActivePreset(preset);
                      }}
                    >
                      <img src={preset.imageUrl} alt="" loading="lazy" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="ap-upload-home"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={18} />
                {isCustomPhoto
                  ? "Change your home photo"
                  : "Upload your home photo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                aria-label="Upload room photo"
                onChange={handlePhotoUpload}
              />
              {onOpenLiveAR && (
                <details className="ap-camera-option">
                  <summary>Use a live camera instead</summary>
                  <button
                    onClick={onOpenLiveAR}
                    type="button"
                    className="ap-upload-home"
                  >
                    <Camera size={16} /> Open live camera
                  </button>
                </details>
              )}
            </div>
            <div ref={toolbarRef} />
            <div ref={viewportRef} className="ap-viewport">
              {/* Interactive Canvas Container */}
              <div className="ap-photo-stage relative rounded-2xl overflow-hidden bg-stone-950 border border-stone-300 shadow-xl select-none group">
                {/* Painted Canvas */}
                <canvas
                  ref={canvasRef}
                  aria-label="Photo paint preview"
                  className="relative z-10 w-full h-auto block mx-auto"
                />

                {/* Underlying Original Canvas (For Before/After Comparison) */}
                <canvas
                  ref={originalCanvasRef}
                  className="w-full h-full absolute inset-0 z-0 block pointer-events-none"
                  aria-hidden="true"
                />
              </div>
            </div>
            <div ref={toolsRef} />
            <p
              className="ap-external-status text-sm text-purple-900"
              role="status"
            >
              {statusMessage}
            </p>
            <details className="ap-extras">
              <summary>Print or request a quote</summary>
              {/* Tool Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      onRequestQuote(currentShade.name, currentShade.code)
                    }
                    className="p-2 text-stone-800 border border-stone-200 hover:bg-stone-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Request Quotation</span>
                  </button>
                  <button
                    onClick={handlePrintSummary}
                    className="p-2 text-stone-800 border border-stone-200 hover:bg-stone-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
                  >
                    <Printer className="w-3.5 h-3.5 text-stone-600" />
                    <span>Export Spec Card</span>
                  </button>
                </div>
              </div>
            </details>
          </div>

          {/* Palette filters and shade library */}
          <div className="colour-shade-panel space-y-4">
            <ShadeLibrary
              shades={COLOR_SHADES}
              cards={siteContent?.shadeCards || []}
              onSelect={onSelectColor}
              selectedHex={selectedColorHex}
              savedCodes={savedColors}
              onToggleSave={toggleSaveColor}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
