# Wall selection, paint and brush designs — updated 27 November 2026

## Customer workflow

The desktop grid keeps the image on the left and published colour families/cards on the right. All photo actions and brush controls sit below the image with wrapping, spaced rows. A short/zoomed desktop viewport scrolls that control stack rather than compressing its children and overlapping buttons; the image stays visible. Phones stack the image, controls and palette. Family/search changes and brush gestures do not resize the preview.

1. Choose a room or upload a JPEG, PNG or WebP up to 20 MiB / 40 megapixels. Every photo starts unchanged, with **Select wall** active. Samples use predefined masks; uploads load the local detector only after a wall tap.
2. **Select wall** shows an outline without changing pixels. **Make selected wall white** is visible throughout and becomes enabled after a valid selection. It whites that wall and clears artwork on it, while retaining other walls' finishes.
3. Choose a published palette colour to paint the selected wall. This activates **Paint wall**: tap another wall to apply the same active colour without clicking its card again. A colour chosen before a wall, or while detection is running, is retained. A newer tap during detection takes precedence over the earlier unfinished selection. Use **Select wall** when you want to change selection without painting.
4. Select **Brush**, choose a palette colour and draw a border, pattern or design. Colour changes in Brush mode change the brush colour without filling the wall. **Brush size** controls the diameter in display pixels. Mouse, pen and touch strokes stay inside the selected wall mask and its opening cutouts; other known wall masks are also protected. A stroke starting outside that boundary paints nothing. Use **Select wall** to change the brush target.
5. **Eraser** removes brush marks only, revealing the wall's current base colour, white primer or original photograph. It leaves other walls' artwork intact. **Undo** reverses one completed gesture, erasure, fill, primer or reset; Ctrl/Cmd+Z also works in the workspace while text inputs retain their native Undo. Escape or pointer cancellation discards an unfinished gesture.
6. **Before** shows the untouched upload; **After** shows base colours and artwork. **Reset photo** restores the exact original and clears selections/artwork; Undo can restore the prior design. **Download** exports the after image as PNG. **Print before & after** includes original/after images and chosen colours, including brush colours. Exports use the actual after buffer even when Before is displayed and never include selection/cursor outlines.

Failed detection preserves the current preview, disables wall-only tools and offers **Retry selection** or another tap. Changing photos cancels pending detection, queued taps and unfinished strokes. Detection is approximate on complex architecture: review the outlined mask, especially around openings, before painting. Confirm final shades with a physical card.

## Published catalogue

Both public hosts display the saved `SiteContent.colours` and `SiteContent.shadeCards`, with exact names, codes, HEX, families and PDF links. There is no curated replacement palette or fabricated primer colour card. Filters use explicit Admin family metadata. A specific family shows only its corresponding colours/PDFs, with general PDFs under All Shades. Duplicate HEX entries remain distinct by their codes.

Saved catalogue changes refresh on focus or the same-origin `areva-content-updated` storage event. Refresh retains the photo, wall masks, artwork, active colour and family/search (or All Shades if its family was removed). Existing designs retain their chosen colours. Failed refreshes retain the last good catalogue and offer retry.

The painter keeps the active paint/brush shade separate from a wall's current base finish. Host callbacks synchronize the active chip without applying a second fill, so React state changes and preserved-page callbacks cannot accidentally turn a brush-colour choice into a full-wall repaint.

## Detection, rendering and memory

Uploaded homes use the pinned Apache-2.0 **SlimSAM** model and MIT WASM runtime in a browser worker. The initial model/runtime download is about 25 MB, cached locally, and encoding takes several seconds by device. No external photo/inference API, credential or GPU service is used. Coarse building bounds exclude background; point-local material, darkness, model cutouts and edge checks refine the selected wall. A neutral dark concrete face can use its local mask rather than being vetoed by a bright neighbouring facade's global material threshold.

`renderSelectedPreview` always starts with an immutable original. Whole-wall finishes and brush rectangles render in action order, with original lighting/shadows preserved. Each brush rectangle is clipped on creation and again to its wall on rendering. Known neighbouring wall masks are subtracted from a gesture's boundary. The brush cannot expand the selection mask. Erasing edits brush coverage, never the source, wall boundary, primer or base fill.

Pointer capture tracks a gesture outside the canvas, and interpolated segments prevent gaps during fast input. Draft brush rendering uses the pre-gesture after buffer; commit creates one Undo snapshot. Stroke rectangles store only their nonzero bounding box, and snapshots share unchanged immutable layers. Up to sixteen surfaces, 64 brush layers and sixteen Undo snapshots are retained. Filling/priming a wall clears its prior artwork; reset releases custom selections and strokes. Working images have a maximum side of 1,200 pixels; model coordinates map back from the padded 1,024-pixel representation.

Photos, embeddings, masks and artwork stay in browser memory. No new database table or persistent photo-upload record is required.

## Integration and deployment

- `public/assets/photo-paint-studio.js`: shared controller, detection, modes, clipped brush/eraser, history, lighting-preserving rendering and exports.
- `public/assets/photo-paint-studio.css`: fixed preview, independent controls/palette scrolling and non-shrinking responsive tool rows.
- `public/assets/shade-catalogue.js`: preserved-page published palette and live refresh.
- `src/components/ColorVisualizer.tsx` and preserved HTML: matching control-stack layout and local photo loading.
- `src/visualizer/photo-painter.ts`: shared controller version and typed active-colour/mode callbacks.
- Existing `wall-selector-worker.js`, `wall-model/`, `vendor/onnx/` and strict worker-only WASM CSP remain unchanged. See [asset provenance](../public/assets/wall-model/README.md).

Assets/React require painter version **9** (`?v=9`). Deploy all public model/runtime files with the app; the normal build/Render commands remain valid. No new npm dependency, environment variable, service, credential or SQL migration is needed.

## Verification

`tests/wall-brush.test.mjs` checks fast-stroke boundary clipping, windows/adjacent walls/roof-background exclusions, compact rectangles, wall-relative lighting, multi-colour action order, eraser restoration/immutability, dark-wall acceptance and invalid inputs. Existing selective-primer, catalogue, model integrity/licensing, CSP, warranty, private storage and SQL regressions remain applicable.

Chromium checks cover both public hosts with real uploaded-house inference: colour before/during selection, repeated same-colour wall switches, primer activation, brush-colour callbacks without unwanted fill, multi-colour strokes, masked eraser, one-gesture Undo, cancellation, active catalogue refresh, source restoration and artwork in PNG/print exports. They also check overlapping button rectangles at 320–1,920 px, short desktop heights and enlarged control fonts, plus touch input and rapid wall changes.
