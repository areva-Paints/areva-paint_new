# Paint your home — updated 24 November 2026

## Customer workflow

1. Choose **Upload your home photo** (or a sample room). JPEG, PNG and WebP photos up to 20 MiB / 40 megapixels are supported. The photo starts untouched.
2. Use **Paint brush** and drag over a wall. Colour appears as you paint, with no separate paint-confirmation step. Change **Brush size** for broad areas or small details.
3. Use **Eraser** over windows, doors, furniture or accidental strokes to restore those areas. This works after painting and continues to protect those areas when trying other shades.
4. Pick a nearby colour swatch or open **All shades** to search the real catalogue by name, code or HEX. The active wall updates immediately. The existing full shade library and family/tone filters remain available.
5. Choose **Add wall** for another surface. Each wall has its own colour card and can be renamed, for example Front wall or Balcony. Select its card before trying a different shade. A photo supports eight walls.
6. Choose **Save preview** to download `Areva-Paints-My-Home.png`. Printing/exporting the painter card and before/after comparison remain available. Save before leaving: edits are held in the current browser tab, not a customer account or server database.

**Undo / Redo** recover brush, eraser, shade, rename and removal changes. **Reset photo** is also undoable. Uploading another photo clears the previous working walls and history.

## Selection and detail tools

- **Tap a wall** applies a connected colour selection around one tap. The coverage range changes future tap selections. Colour-based selection can miss shadows or include similarly coloured objects; refine it with the brush and eraser.
- **Precise outlines → Outline a wall** fills a perspective shape after tapping corners and choosing **Close outline**, or tapping its first corner again. No extra Paint selected area action is needed.
- **Outline a window / door** removes paint inside a corner-defined opening. Crossing or degenerate outlines are refused; up to 80 corners are supported.
- Zoom from **100–300%** and use **Move photo** to pan. Brush size follows its size on screen, so zooming supports finer corrections. **Fit photo** restores the full-width view.
- **Hold original** works with pointer or keyboard. The before/after slider hides editing marks while comparing. Saved PNGs and print/export use the painted image without selection borders, brush cursors or toolbars.

Brush/eraser gestures paint on touch devices; Move photo pans the image. The document can still be scrolled outside the image. Tap/outline tools allow normal touch scrolling without accidentally adding points. With the canvas focused, arrow keys move the cursor and Enter places a brush mark or outline corner. Alt plus arrow draws a short stroke; Ctrl/Cmd+Z and Ctrl/Cmd+Y undo/redo. Backspace removes an outline corner and Escape cancels a draft.

## Rendering and local storage

The renderer replaces pigment in linear light using the original photo's luminance and a robust reference for each wall. Shadows and texture remain while highlights blend gently rather than clipping channels. Every preview recomposes the current wall masks from the untouched original, so repeated shade changes do not accumulate colour or darken soft edges. Erasing reveals lower walls or the original photo correctly.

Brush strokes interpolate between pointer samples to avoid gaps. Wall masks are immutable after each completed gesture; an eight-step undo/redo history shares unchanged masks to bound memory. Cancelling a gesture restores the committed preview. Working photos are resized to a longest side of 900 pixels in the public HTML studio and 960 in React Studio. Both use the same geometry and controller.

This is a manually controlled photo preview, not automatic building recognition or plaster reconstruction. Use a physical shade card to confirm the final paint choice.

## Code and deployment

- `public/assets/photo-paint-studio.js`: shared brush, eraser, wall composition, history, catalogue picker, zoom and PNG export.
- `public/assets/photo-paint-studio.css`: responsive toolbar, bounded photo viewport and wall cards. Precision controls avoid animated document scrolling and account for sticky navigation.
- `src/visualizer/photo-painter.ts`: typed versioned loader and local image decoding with URL cleanup.
- `src/components/ColorVisualizer.tsx` and the preserved public HTML: catalogue, upload, comparison and print integration.

Both script and legacy stylesheet URLs use `?v=2`, and React's loader checks the controller version. This avoids reusing a prior cached controller after deployment. The nearby picker reads the CMS catalogue, renders up to eight quick shades, searches up to 5,000 entries and bounds each result list to 48 matches. React refreshes that picker when catalogue data changes.

Photos, masks and names stay in browser memory; only the selected sample photo and public catalogue/assets are fetched. New uploads clear old selections, and stale room-image responses cannot overwrite a newer photo. No new backend endpoint, SQL table/migration, API key or dependency is required. Live camera capture remains separate; capturing a still frame opens this painter.

## Verification

`tests/photo-paint-studio.test.mjs` covers continuous brush masks, smooth/clipped edges, post-paint erasing, independent/overlapping wall composition, repeated shade trials, source immutability, polygon exclusions and conservative connected selection. Browser checks exercise both studios on desktop/mobile, including direct brush painting, instant shade changes, independent named walls, erasing after painting, undo/redo/reset, the catalogue popup, zoom/pan, keyboard/touch input, original comparison, real exterior photos and PNG downloads without tool overlays. The wider application and prepared-SQL regressions also apply.
