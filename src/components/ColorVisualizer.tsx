/* Public host for the shared white-base wall painter. Photos are decoded locally;
 * generation checks prevent an older room request from replacing a new upload.
 */
import React, { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useContentStatus, useSiteContent } from "../admin/ContentContext";
import { ROOM_PRESETS } from "../data/paintsData";
import { ShadeLibrary } from "./ShadeLibrary";
import type { ColorShade } from "../types";
import {
  decodePhoto,
  loadPhotoPainter,
  type PhotoPainter,
} from "../visualizer/photo-painter";
import "../../public/assets/photo-paint-studio.css";
import "../../public/assets/shade-library.css";

const NO_COLOURS: ColorShade[] = [];

interface ColorVisualizerProps {
  selectedColorHex: string;
  selectedColorName: string;
  onSelectColor: (hex: string, name: string) => void;
  onRequestQuote: (shadeName: string, shadeCode: string) => void;
  onOpenLiveAR?: () => void;
}
const ROOM_NAMES: Record<string, string> = {
  "nordic-living": "Living room",
  "master-bedroom": "Bedroom",
  "kitchen-studio": "Kitchen",
  "modern-villa": "Exterior",
  "office-studio": "Office",
};
export const ColorVisualizer: React.FC<ColorVisualizerProps> = ({
  selectedColorHex,
  selectedColorName,
  onSelectColor,
}) => {
  const content = useSiteContent(),
    colours = content?.colours || NO_COLOURS,
    catalogueStatus = useContentStatus();
  const canvasRef = useRef<HTMLCanvasElement>(null),
    toolbarRef = useRef<HTMLDivElement>(null),
    toolsRef = useRef<HTMLDivElement>(null),
    viewportRef = useRef<HTMLDivElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    painter = useRef<PhotoPainter | null>(null),
    generation = useRef(0);
  const shade = useRef({ hex: selectedColorHex, name: selectedColorName });
  shade.current = { hex: selectedColorHex, name: selectedColorName };
  const [ready, setReady] = useState(false),
    [preset, setPreset] = useState(ROOM_PRESETS[0]),
    [custom, setCustom] = useState(false),
    [selectedCode, setSelectedCode] = useState(""),
    [status, setStatus] = useState("Loading photo tools…");
  useEffect(() => {
    let active = true;
    void loadPhotoPainter()
      .then((studio) => {
        if (
          !active ||
          !canvasRef.current ||
          !toolbarRef.current ||
          !toolsRef.current ||
          !viewportRef.current
        )
          return;
        painter.current = studio.createEditor({
          canvas: canvasRef.current,
          toolbar: toolbarRef.current,
          controls: toolsRef.current,
          viewport: viewportRef.current,
          shade: () => shade.current,
          swatches: colours,
          onSelectShade: (value) => onSelectColor(value.hex, value.name),
          onStatus: () => setStatus(""),
          onChange: (state) => setSelectedCode(state.selectedShade?.code || ""),
          onBeforeSelect: () => {},
        });
        setReady(true);
      })
      .catch((error) => {
        if (active) setStatus(error.message);
      });
    return () => {
      active = false;
      generation.current++;
      painter.current?.destroy();
      painter.current = null;
    };
  }, []);
  function show(image: HTMLImageElement, roomId?: string) {
    const canvas = canvasRef.current;
    if (!canvas || !painter.current) return;
    const scale = Math.min(
      1,
      1200 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    painter.current.setImage(
      ctx.getImageData(0, 0, canvas.width, canvas.height),
      { roomId },
    );
  }
  useEffect(() => {
    if (!ready || custom) return;
    const request = ++generation.current,
      abort = new AbortController();
    painter.current?.setEnabled(false);
    setStatus("Loading " + preset.name + "…");
    void fetch(preset.imageUrl, { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw Error("This room photo could not load.");
        return r.blob();
      })
      .then(decodePhoto)
      .then((image) => {
        if (generation.current === request) show(image, preset.id);
      })
      .catch((error) => {
        if (!abort.signal.aborted && generation.current === request)
          setStatus(error.message);
      });
    return () => {
      abort.abort();
      if (generation.current === request) generation.current++;
    };
  }, [ready, custom, preset]);
  useEffect(() => {
    painter.current?.shadeChanged();
  }, [selectedColorHex, selectedColorName]);
  useEffect(() => {
    painter.current?.setSwatches(colours);
  }, [colours, ready]);
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 20 * 1024 * 1024
    ) {
      setStatus("Choose a JPEG, PNG or WebP photo up to 20 MB.");
      return;
    }
    if (!painter.current) return;
    const request = ++generation.current;
    painter.current.setEnabled(false);
    setStatus("Loading your photo…");
    try {
      const image = await decodePhoto(file);
      if (generation.current !== request) return;
      show(image);
      setCustom(true);
    } catch (error) {
      if (generation.current === request) {
        painter.current?.setEnabled(true);
        setStatus((error as Error).message || "Could not open this photo.");
      }
    }
  }
  return (
    <section id="visualizer" className="bg-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="ap-title">
          <h2>Paint your home</h2>
          <p>
            Start with white walls. Tap one wall, then choose a colour from your
            palette.
          </p>
        </div>
        <div className="colour-studio-grid">
          <div className="colour-room-panel">
            <div ref={viewportRef} className="ap-viewport">
              <div className="ap-photo-stage">
                <canvas ref={canvasRef} aria-label="Photo paint preview" />
              </div>
            </div>
            <div ref={toolbarRef} />
            <div ref={toolsRef} />
            <p className="ap-external-status" role="status">
              {status}
            </p>
            <div
              className="ap-scenes"
              role="group"
              aria-label="Choose a room photo"
            >
              <h3>Choose a photo</h3>
              <div
                className="ap-room-presets"
                role="group"
                aria-label="Room types"
              >
                {ROOM_PRESETS.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    className="ap-room-preset"
                    aria-pressed={!custom && preset.id === room.id}
                    onClick={() => {
                      setCustom(false);
                      setPreset(room);
                    }}
                  >
                    <img src={room.imageUrl} alt="" loading="lazy" />
                    <span>{ROOM_NAMES[room.id] || room.name}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ap-upload-home"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={18} />
                {custom ? "Change your home photo" : "Upload your home photo"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Upload room photo"
                className="hidden"
                onChange={upload}
              />
            </div>
          </div>
          <div className="colour-shade-panel">
            {catalogueStatus.loading && (
              <p className="ap-catalogue-status" role="status">
                Loading published colours…
              </p>
            )}
            {catalogueStatus.error && (
              <p className="ap-catalogue-status" role="status">
                {catalogueStatus.error}{" "}
                <button type="button" onClick={catalogueStatus.reload}>
                  Retry
                </button>
              </p>
            )}
            {content && (
              <ShadeLibrary
                shades={colours}
                cards={content.shadeCards}
                visualizer
                selectedCode={selectedCode}
                onSelectRecord={(record) => {
                  painter.current?.applyShade(record);
                  onSelectColor(record.hex, record.name);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
