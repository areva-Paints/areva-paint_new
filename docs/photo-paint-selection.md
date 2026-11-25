# Paint your home — updated 25 November 2026

## Customer workflow

1. Choose **Upload your home photo**, or open **Or try a sample room**. JPEG, PNG and WebP photos up to 20 MiB / 40 megapixels are supported. The photo starts untouched.
2. Choose one of the five suggested catalogue colours. **More colours** searches the real catalogue by name, code or HEX; the full shade library and family/tone filters remain available.
3. **Tap a wall** to apply the chosen colour. Selecting a colour alone does not change any wall. Tap an already painted wall to recolour it, or tap another surface to give it its own colour. A photo supports eight walls.
4. Use **Undo** to reverse a change. **Before / After** toggles the untouched photo and the painted preview; **Show painted** returns from the original view.
5. Choose **Save image** to download `Areva-Paints-My-Home.png`. Save before leaving: edits are held in the current browser tab, not a customer account or server database.

The main view keeps the photo, colour choices and three main actions visible. Correction tools, zoom and wall management stay inside the closed **Refine a wall** section. Printing, custom colours or quotation controls are in a separate optional section, depending on the studio.

## Optional corrections

Open **Refine a wall** when a selection needs adjustment:

- **Select less / Select more** recomputes the active tap selection with a narrower or wider matching range. These actions apply immediately and support Undo. They are available for walls created by a tap.
- **Add paint** brushes in missed areas. **Remove paint** restores windows, doors, furniture or accidental paint. Brush size appears only while using these tools. **Tap to paint** restores the normal interaction.
- **More tools → Outline a wall** fills a perspective shape after tapping corners and choosing **Close outline**, or tapping the first corner again. **Outline a window / door** removes paint inside the shape. Crossing or degenerate outlines are refused; up to 80 corners are supported.
- Zoom from **100–300%** and use **Move photo** to pan. Brush size follows its size on screen. **Fit photo** restores the full fitted image.
- Wall cards can select, rename, add or remove individual walls. **Redo** and **Reset photo** are also available; reset is undoable.

Closing **Refine a wall** returns to tap-to-paint, cancels unfinished outlines and restores the fitted view. Uploading another photo clears the previous walls and history.

In the default tap mode, touch scrolling does not paint. Brush/eraser gestures paint while those optional tools are selected; Move photo pans. With the canvas focused, arrow keys move the cursor and Enter taps or places a brush mark/outline corner. Alt plus arrow draws a short stroke; Ctrl/Cmd+Z and Ctrl/Cmd+Y undo/redo. Backspace removes an outline corner and Escape cancels a draft.

## Selection, rendering and local storage

Tap selection compares connected surface colour separately from brightness, allowing more of a wall's shadows to remain in the selection. A small blur is used only for selection analysis to reduce texture gaps. Original pixels remain sharp. Colour and edge boundaries constrain the selection, including a raw-pixel pass at the border. A floor or strong object boundary should not become a bridge to a separate wall.

This is colour-based connected selection, not automatic building recognition. Similarly coloured touching objects or sharp shadow boundaries can still need the optional correction tools. Use a physical shade card to confirm the final paint choice.

The renderer replaces pigment in linear light using the original photo's luminance and a robust reference for each wall. Shadows and texture remain while highlights blend gently rather than clipping channels. Every preview recomposes the current wall masks from the untouched original, so repeated shade changes do not accumulate colour or darken soft edges. Erasing reveals lower walls or the original photo correctly.

Brush strokes interpolate between pointer samples to avoid gaps. Wall masks are immutable after each completed gesture; an eight-step undo/redo history shares unchanged masks to bound memory. Cancelling a gesture restores the committed preview. Working photos are resized to a longest side of 900 pixels in the public HTML studio and 960 in React Studio. Both use the same geometry and controller. Fitted images preserve their aspect ratio, including portrait uploads. Saved PNGs contain no toolbars, selection borders or brush cursors.

Photos, masks and names stay in browser memory; only sample photos and public catalogue/assets are fetched. New uploads clear old selections, and stale room-image responses cannot overwrite a newer photo. No new backend endpoint, SQL table/migration, API key or dependency is required. Live camera remains separate; capturing a still frame opens this painter.

## Code and deployment

- `public/assets/photo-paint-studio.js`: shared connected selection, brush, eraser, wall composition, history, catalogue picker, comparison, zoom and PNG export.
- `public/assets/photo-paint-studio.css`: compact responsive colour bar, fitted photo viewport, three main actions and optional correction tools. Controls account for sticky navigation and avoid animated document scrolling during editing.
- `src/visualizer/photo-painter.ts`: typed versioned loader and local image decoding with URL cleanup.
- `src/components/ColorVisualizer.tsx` and the preserved public HTML: catalogue, upload and print integration.

Both script and legacy stylesheet URLs use `?v=3`, and React's loader checks controller version 3. This avoids reusing the previous interaction after deployment. The quick picker suggests five neutral/muted shades from the actual catalogue; it searches up to 5,000 entries and bounds each result list to 48 matches. React refreshes that picker when catalogue data changes.

## Verification

The 14 tests in `tests/photo-paint-studio.test.mjs` cover brush masks, clipped edges, post-paint erasing, independent/overlapping wall composition, repeated shade trials, source immutability, polygon exclusions and connected selection. Selection regressions exercise neutral shadows, textured walls with protected openings, and a warmer floor separating two walls.

Browser checks exercise both studios at 320, 390, 768 and 1,440 pixels, including colour-then-tap, repainting an existing wall, separate wall colours, hidden optional tools, correction/undo, original comparison, real exterior photos and clean PNG downloads. Touch scrolling must not paint, and keyboard input must remain usable. Type checking, a production build and all 67 application/prepared-SQL tests passed for this revision.
