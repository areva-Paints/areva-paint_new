# Paint your home — updated 25 November 2026

## Customer workflow

1. **Choose a room or upload your home.** Living room, Bedroom, Kitchen, Exterior and Office appear as visible photo cards. The first room loads by default. Upload is always available beside these choices; JPEG, PNG and WebP photos up to 20 MiB / 40 megapixels are supported. A new photo starts untouched.
2. **Select one wall.** In a sample room, tap the wall in the photo or choose its named button, such as Sofa wall or Window wall. For an uploaded photo, tap corners around one wall and choose **Finish selection**. More than four corners are supported, and tapping the first corner also closes the outline. **Undo corner** and **Cancel** correct a draft. A purple boundary shows the selected surface without modifying the photo.
3. **Choose a colour**, then press **Paint selected wall**. Colour selection and wall selection alone never paint. The button stays disabled until a valid wall has been selected. Only that mask receives paint; there is no automatic flood fill across the house.
4. Select another sample wall, or use **Outline my wall** for a new surface. Each wall keeps its own shade. To recolour an existing wall, tap it or its wall button, choose a shade and press **Paint selected wall**. Up to eight painted walls are supported.
5. Use **Undo** to reverse a change and **Before / After** to toggle the original photo. **Save image** downloads `Areva-Paints-My-Home.png` without selection marks or controls. Save before leaving: edits live in the current browser tab, not an account or server database.

Five quick suggestions and **More colours** use the actual CMS catalogue; the full colour library remains available. Live camera is separate under an optional camera disclosure. Capturing a frame opens the same still-photo selection workflow. Printing, custom colours or quotation controls remain in a separate optional section, depending on the studio.

## Windows, doors and optional corrections

The sample-room wall masks exclude the defined openings, furniture, frames and trim. Uploaded photos use the customer's outline and do not automatically recognize windows or furniture.

For an uploaded wall containing an opening, open **Refine a wall → Protect window / door**, tap around the opening and choose **Protect opening**. This works before painting and on an already painted wall. An unpainted selection remains unpainted until **Paint selected wall** is pressed. Protected holes stay clear when recolouring.

After painting, **Add paint** brushes in a missed area and **Remove paint** restores accidental paint. Brush size appears only while these tools are selected. These corrections deliberately allow the user to adjust the mask; they do not trigger house-wide selection. **More tools** provides zoom (100–300%), Move photo, Redo, Reset photo, wall naming and removal. Reset is undoable.

Corner tools allow normal touch scrolling without adding corners during a drag. With the photo focused, arrow keys move the cursor and Enter adds a corner or selects a wall. Ctrl/Cmd+Z and Ctrl/Cmd+Y undo/redo. Backspace removes a corner and Escape cancels a draft. Uploading another photo clears old walls, selections and history. Fitted images preserve their aspect ratio, including portrait photos.

## Boundaries, rendering and local storage

Each sample photo has at least two named wall regions defined in `public/assets/photo-paint-studio.js`. Geometry uses a 0–1000 coordinate grid relative to that exact image and is scaled to the decoded photo. Cutout polygons exclude defined furniture, openings and trim. The masks are disjoint: selecting another wall cannot silently repaint the first. If a sample image is replaced, its wall geometry must be reviewed at the same time.

Uploaded photos receive no sample geometry. Customers define a polygon for the desired wall, so even touching surfaces of the same colour do not merge. Invalid/crossing outlines are refused. The previous connected-colour helper remains covered by rendering tests, but is not used to select a new wall in this workflow. This is explicit photo editing, not automatic building recognition.

Paint replaces pigment in linear light using the untouched photo's luminance and a robust reference for each wall. Shadows and texture remain, and repeated shade trials recompose from the original rather than accumulating tint. Erasing reveals lower walls or the original correctly. Use a physical shade card to confirm a final paint choice.

Masks are immutable after each committed change. An eight-step undo/redo history shares unchanged masks to bound memory. Working photos are resized to a longest side of 900 pixels in the public HTML studio and 960 in React Studio. Both use the same controller and image coordinates. Photos, masks and names stay in browser memory. Only sample photos and public catalogue/assets are fetched. Stale image responses cannot overwrite a newer room or upload.

## Code and deployment

- `public/assets/photo-paint-studio.js`: preset wall geometry, explicit selection, paint composition, cutouts, history, colour picker, comparison, corrections and PNG export.
- `public/assets/photo-paint-studio.css`: visible room-photo cards, wall choices, outline guidance, colour controls, fitted image and optional refinements.
- `src/visualizer/photo-painter.ts`: typed versioned loader, image options and local decoding with URL cleanup.
- `src/components/ColorVisualizer.tsx` and the preserved public HTML: room selection, upload, catalogue and export integration.

The script and legacy stylesheet URLs use `?v=4`; React requires controller version 4. This prevents the prior automatic tap-to-paint interaction from being reused from cache. Known room IDs must be passed to `setImage(image, { roomId })` only when that exact preset photo was decoded. Uploads, camera frames and vector fallbacks omit the ID and use manual outlines.

No backend endpoint, database table/migration, API key or dependency was added. No customer photo is uploaded to the server by this painter.

## Verification

The 16 tests in `tests/photo-paint-studio.test.mjs` include valid/disjoint masks for every room at both studio resolutions, protected furnishings, independent wall colours, pixel boundaries, brush/eraser composition, shadow rendering and source immutability.

Browser checks cover both studios with all five real room photos and a customer-photo fixture whose identical-colour walls touch. Checks include selection before painting, disabled/unconfirmed painting, protected windows before paint, independent colours, recolouring, Undo, Before/After, brush-size corrections, clean PNG downloads, touch input and layouts from 320 to 1,440 pixels. Type checking, production build and the wider application/prepared-SQL regressions also apply.
