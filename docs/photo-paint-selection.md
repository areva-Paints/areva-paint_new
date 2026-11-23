# Photo wall selection and shade rendering — 23 November 2026

## Using the visualizer

1. Choose a room or upload a JPEG, PNG or WebP photo (up to 20 MiB / 40 megapixels). The photo starts unpainted.
2. Choose **Select area** and tap the corners around one wall section. Perspective shapes are supported. Use **Remove last point** to correct a corner. Choose **Finish area**, or tap the first corner again after adding at least three corners.
3. To keep a window or door unchanged, choose **Exclude window / door**, trace its corners and choose **Finish area**. Repeat for other openings before painting.
4. Select a shade and choose **Paint selected area**. Selecting a shade or tapping the photo alone never applies paint.
5. Keep the selection to compare other shades using the same button. Choose **Select area** again to paint another wall independently. **Clear selection** removes only the selection outline. **Undo** restores the previous paint action; **Reset** returns to the original photo.

**Quick select** optionally previews a connected area around one tap. Its range control changes that preview. Check its boundaries before painting; outlining is the default because similarly coloured objects and adjoining walls cannot be reliably distinguished by colour alone.

The overlay follows image coordinates when the page resizes. On a keyboard, focus the photo selection canvas, use arrow keys to move the crosshair, and press Enter to add a corner. Shift plus an arrow moves farther. Backspace removes the last corner; Escape cancels the current outline. Normal touch scrolling does not add a corner.

Before/after comparison and Hold Original remain available. Print/export uses the painted image without the selection overlay.

## What changed

The old uploaded-photo fill selected pixels by their difference from the tapped colour. Rough walls and shadows produced missed pixels, and connected areas could extend beyond the intended wall. Multiplying sRGB channels by a seed brightness also clipped bright shades and flattened highlights.

The shared painter now separates selection from applying colour. A polygon covers the entire chosen surface rather than skipping differently lit pixels. Exclusion masks protect openings. Four subpixel samples soften polygon edges; crossing/degenerate outlines are refused. Optional quick selection stays connected and stops at strong contrasting edges.

Painting works in linear light. It replaces the previous pigment with the chosen shade and uses the original photo's luminance relative to a robust selection-wide reference. Shadows and texture remain, while highlights blend gently rather than clipping channels. Trying multiple shades uses the same pre-paint selection pixels, including soft edges, to prevent cumulative colour fringes. Another wall's existing paint is preserved.

This is a browser photo preview with manually defined areas; it does not perform automatic building recognition or reconstruct a finished plaster surface. Existing on-screen shade guidance still applies when choosing a physical paint.

## Code and storage

- `public/assets/photo-paint-studio.js`: shared geometry, colour math, pointer/keyboard controls, exclusions and eight-step undo. It is loaded by both the public HTML page and React Studio.
- `public/assets/photo-paint-studio.css`: shared controls and overlay layout.
- `src/visualizer/photo-painter.ts`: typed React loader and local photo decoding with temporary URL cleanup.
- `src/components/ColorVisualizer.tsx` and the preserved public HTML: room/upload, palette, comparison and export integration.

Working images are resized to at most 900 pixels on the longest side in the public HTML view and 960 in React Studio. Geometry is bounded to 80 corners per outline. Undo history, masks and photos stay in browser memory; changing a photo clears its paint and selection. A late room-image response cannot overwrite a newer upload. There is no new image-upload endpoint, database table, SQL migration, API key or dependency.

The existing live-camera preview remains a separate capture mode. Capturing a still frame opens the same outline-and-paint workflow.

## Verification

`tests/photo-paint-studio.test.mjs` checks bounded polygon masks, smooth edges, separate window/door exclusions, invalid outlines, shade accuracy on uniformly lit walls, continuous shading without missed pixels, repeat-shade stability, independent areas and conservative connected selection. Browser checks cover the public HTML and React workflows, desktop/mobile/touch/keyboard input, undo/reset, before/after, export, photo-load races and CSP.
