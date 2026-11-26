/* Load the same standalone painter used by the preserved public page. Keeping the
 * controller and pixel math in one browser asset prevents the two studios drifting.
 */
export type PaintedShade = { hex: string; name: string; code?: string };
export type PhotoPainter = {
  setImage: (image: ImageData, options?: { roomId?: string }) => void;
  undo: () => void;
  reset: () => void;
  setEnabled: (enabled: boolean) => void;
  setComparison: (comparing: boolean) => void;
  shadeChanged: () => void;
  setSwatches: (shades: PaintedShade[]) => void;
  destroy: () => void;
};
type Options = {
  canvas: HTMLCanvasElement;
  controls: HTMLElement;
  toolbar: HTMLElement;
  viewport: HTMLElement;
  shade: () => PaintedShade;
  swatches: PaintedShade[];
  onSelectShade: (shade: PaintedShade) => void;
  onStatus: (message: string) => void;
  onChange: (state: { canUndo: boolean; colors: PaintedShade[] }) => void;
  onBeforeSelect: () => void;
};
declare global {
  interface Window {
    ArevaPaintStudio?: {
      version: number;
      createEditor: (options: Options) => PhotoPainter;
    };
  }
}
let pending: Promise<NonNullable<Window["ArevaPaintStudio"]>> | null = null;
export function loadPhotoPainter() {
  if (window.ArevaPaintStudio?.version === 6)
    return Promise.resolve(window.ArevaPaintStudio);
  if (!pending) {
    const path = "/assets/photo-paint-studio.js?v=6";
    pending = import(/* @vite-ignore */ path)
      .then(() => {
        if (window.ArevaPaintStudio?.version !== 6)
          throw Error("Photo tools could not load. Please refresh the page.");
        return window.ArevaPaintStudio;
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

/* Decode locally and always release the temporary URL, including broken images. */
export async function decodePhoto(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 40000000
    )
      throw Error("Choose a photo smaller than 40 megapixels.");
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
