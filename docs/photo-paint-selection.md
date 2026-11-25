# Paint your home — updated 25 November 2026

## Layout and customer workflow

The photo comes first and spans the workspace. Room cards, upload buttons, selection tools and the full shade catalogue sit below it on both desktop and mobile. The public HTML renderer and React Studio use the same controller.

1. Choose a **Living room, Bedroom, Kitchen, Exterior or Office** photo below the preview, or **Upload your home photo**. The first sample loads by default. JPEG, PNG and WebP uploads up to 20 MiB / 40 megapixels are supported. Each new photo starts untouched.
2. Use **Drag an area** across a surface. A drag creates a rectangular selection with four corner handles. Move the handles to match a sloping wall, beam or other perspective surface. A magnified view appears while adjusting corners. No separate Finish selection step is required.
3. For narrow columns, ledges, bands or irregular surfaces, choose **Brush an area**. Set the brush size and drag over the surface; repeated strokes add to the same selection. The magnifier helps place small strokes. **Remove from area** brushes windows, doors, furniture or unwanted marks out of the selection.
4. Choose a shade, then press **Paint selected area**. Selection, brushing and colour choice alone never commit paint. The button requires a nonempty, valid area. Only that mask receives pigment, including textured or shadowed concrete inside it.
5. Use **+ New area** for another wall or feature with its own colour. Tap a painted area or its button to select it again. The photo supports eight painted areas; one brushed area may include several separate features that share a shade.
6. **Undo / Redo** recover draft selections, handle adjustments, brush corrections and committed paint. **Before / After** toggles the untouched photo. **Save image** downloads `Areva-Paints-My-Home.png` from committed paint, without handles, selection tint, magnifier or controls. Save before leaving: work lives in the browser tab, not an account or server database.

Selecting an editing tool, changing zoom or painting brings the photo back into view. On touch screens, dragging in the photo deliberately edits an area; the document remains scrollable outside the photo. **Move photo** pans a zoomed image. Zoom and Fit photo are available directly below the image rather than in a hidden submenu.

## Openings and additional precision tools

Uploaded photos use the customer's selected geometry. There is no automatic semantic recognition of windows, plants, neighbouring buildings or surface types. The explicit boundary prevents colour from travelling into other same-colour walls. Use **Remove from area** to keep objects unpainted.

**More selection tools → Protect window / door** also supports a precise polygon cutout. Tap around an opening and choose **Protect opening**. This works before or after painting, and cutouts are retained when dragging the enclosing area's corner handles. **Outline with corners** is available for shapes requiring more than four corners. Tap the first corner to close it or use **Finish outline**. Undo corner and Cancel correct a draft; crossing or degenerate outlines are refused.

Sample photos also offer named architectural wall masks with defined furniture, window and trim exclusions. Dragging or brushing remains available for different features. Sample geometry uses a 0–1000 coordinate grid relative to the exact photo; replacing an image requires reviewing its masks.

With the image focused, arrow keys move the cursor and Enter selects an area or adds a corner in Outline mode. Backspace removes a draft corner and Escape cancels a gesture. Ctrl/Cmd+Z and Ctrl/Cmd+Y undo/redo. Area naming, removal and Reset photo remain under **Area names and history**. Reset is undoable.

## Rendering and privacy

Draggable quadrilaterals and brushed masks use image coordinates, so touch input, zoom and rendering refer to the same pixels. Handle movements are clipped to the photo and cannot create crossing shapes. Cancelled gestures restore the previous committed selection. Masks and saved history remain immutable after an edit; an eight-step history shares unchanged masks to bound memory.

Both studios decode to a longest side of **1,200 pixels**, within the shared 1.5-million-pixel working limit. Portrait and landscape photos retain their aspect ratio. The local magnifier samples the displayed photo and never appears in a saved PNG.

Paint replaces pigment in linear light using the untouched source luminance and a robust reference per area. Rough texture and shadows remain; shade trials recompose from the original rather than accumulating tint. The older connected-colour helper remains tested but is not used for new uploaded-area selections. Use a physical shade card to confirm a final colour.

Photos, masks and names remain in browser memory. Only sample photos and public catalogue/assets are fetched. Uploads clear earlier areas/history, and stale room responses cannot overwrite a newer photo. No backend endpoint, database table/migration, API key, model download or dependency was added. Live camera is separate; a captured still uses the same local area tools.

## Code and deployment

- `public/assets/photo-paint-studio.js`: geometry, draggable handles, draft brush/eraser selections, cutouts, magnifier, history, pigment composition and PNG export.
- `public/assets/photo-paint-studio.css`: photo-first layout, controls below the image, selection feedback and touch-friendly precision controls.
- `src/visualizer/photo-painter.ts`: typed versioned loader and local image decoding.
- `src/components/ColorVisualizer.tsx` and the preserved HTML: photo, room, upload and catalogue integration.
- `src/admin/legacy-page.ts`: preserves dynamic catalogue insertion after moving the image before the options grid.

The standalone script and legacy stylesheet URLs use `?v=5`; React requires controller version 5 to avoid reusing the previous interaction from cache. Known sample IDs are passed to `setImage(image, { roomId })` only for those photos. Uploads, camera frames and vector fallbacks omit the ID.

## Verification

The 18 photo tests cover bounded/reversed drags, immutable corner adjustment, crossing refusal, rough concrete, protected openings, narrow columns, sample masks, independent areas, brush/eraser composition, source immutability and shadow rendering.

Browser checks cover both studios, all five room photos, a custom textured exterior fixture with touching planes and separate architectural features, and a real exterior uploaded as a customer photo. Checks include the photo above all options, perspective-handle editing, opening protection surviving handle moves, touch brushing on a column/diagonal trim, draft Undo/Redo, independent colours, original comparison, clean PNG export and 320–1,440-pixel layouts. Type checking, production build and the full application/prepared-SQL suite also apply.
