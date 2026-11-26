# White-base painter — updated 26 November 2026

## Customer workflow

The desktop workspace keeps the building preview on the left and the published colour palette on the right. The left panel stays below the site navigation while the palette scrolls independently. Before/After, reset, download, printing, room choices and upload controls all follow the image. On phones the palette follows the preview and its actions. The image frame keeps a stable size when a customer changes filters, colours or photo proportions.

1. Choose a room or upload a JPEG, PNG or WebP photo up to 20 MiB / 40 megapixels. Samples immediately prepare their known walls in white. Uploaded photos automatically run local wall preparation, with visible progress; there is no manual white-preparation step.
2. Tap a white wall. A thin outline identifies the selected surface. Uploaded photos use a finer local-model selection to distinguish a wall from another facade or trim. Choose a colour card on the right to paint that surface. Repeat to make a combination; selecting another wall does not apply a colour until the customer chooses its card.
3. **Before** shows the untouched original; **After** shows the prepared/coloured preview. **Reset to white** clears the painted combination while retaining the white foundation.
4. **Download** saves the final preview as a PNG without selection outlines. **Print before & after** opens a two-image print document with the chosen colour names. Both exports use the final after buffer even when Before is displayed. The browser print dialog can print to paper or save a PDF.

Photo preparation depends on image clarity and model recognition. A failed preparation keeps the original visible and offers retry or sample rooms; it does not pretend that an unchanged photo is a white canvas. Recognition can still miss material boundaries or unusual openings. This is a lighting-preserving paint simulation, not plaster reconstruction. Confirm the final shade with a physical colour card.

## Published catalogue and family matching

The visualizer displays `SiteContent.colours` and `SiteContent.shadeCards` from the saved Admin snapshot, including exact names, codes, HEX values, family tags and uploaded PDF links. There is no separate curated five-colour list, synthetic white colour card, missing-card cap or default palette substituted while the API loads. Family choices derive from those saved records; a family filters by its explicit metadata rather than inferring a family from RGB. A specific family shows only its corresponding PDF shade cards; general PDFs remain under All Shades.

Saving in the Admin Portal publishes the catalogue through the existing content endpoint and storage. Both public versions refresh it on window focus or the same-origin `areva-content-updated` storage event. An existing family/search remains selected; a removed family falls back to All Shades. Refresh does not replace the photograph, worker, masks, selected wall or painted design. Already-painted areas keep their chosen colours when the catalogue changes. Duplicate HEX colours remain separate records selected by their shade codes. Initial loading and refresh failures are visible, with retry; a failed refresh retains the last good catalogue.

## Detection, rendering and privacy

Samples use fixed masks and need no model download. Uploaded homes use the pinned, quantized **SlimSAM** detector in a dedicated browser worker. The first model/runtime download is about **25 MB**, cached locally; encoding takes several seconds depending on the device. WebAssembly support is required. No external inference service, API key, GPU or photo-upload endpoint is used.

Automatic preparation makes several prompts against one image embedding to find enclosing building/wall masks. Confidence, area and position checks reject unsuitable sky/floor/background candidates. Source-material chroma, darkness and connected-region cleanup protect contrasting wood, openings and isolated glass reflections, while keeping concrete shadows. Tapping a prepared wall uses the finer confident model mask, constrained to the prepared foundation. Source edges and connectivity separate adjacent planes. Recognition is approximate, so customers should review the preview.

The foundation and original are immutable. Colours are recomposed from that foundation with preserved lighting and texture, without accumulating previous pigment. Up to sixteen individual surfaces and bounded keyboard Undo are supported. Working photos have a maximum side of 1,200 pixels; padded 1,024-pixel model coordinates map back to the working photo. Pixels, embeddings, masks and history stay in browser memory. Changing photos terminates the worker and invalidates pending results. No SQL schema or customer-data change is required.

## Integration and deployment

- `public/assets/photo-paint-studio.js`: shared controller, automatic preparation, surface selection, colour rendering, reset and exports.
- `public/assets/shade-catalogue.js`: catalogue rendering and live refresh for the preserved public page; DOM text rendering keeps saved names safe.
- `src/components/ShadeLibrary.tsx`, `src/data/shadeFamilies.ts` and `src/admin/ContentContext.tsx`: saved family choices, the React palette and loading/refresh state.
- `src/components/ColorVisualizer.tsx` and the preserved HTML: preview/palette layout, local photo decoding, room choices and upload.
- `public/assets/wall-selector-worker.js`, `wall-model/` and `vendor/onnx/`: pinned Apache-2.0 SlimSAM weights and MIT runtime, manifests and notices. See [asset provenance](../public/assets/wall-model/README.md).
- `src/server/security.ts`: WASM compilation is permitted only for the dedicated worker response; page documents retain the strict script policy.

The painter script/legacy stylesheet use `?v=7`; React requires controller version 7. Deploy all public model/runtime assets with the application. `npm run build` copies them into `dist/assets`. Existing Render commands work; no new service, runtime dependency, environment variable, credential or database table is needed.

## Verification

`tests/white-wall-painter.test.mjs` covers automatic enclosing-mask selection, neutral preparation across separate wall faces/shadows, protected source pixels/openings, independent recolouring, mask cleanup, facade boundaries, model file integrity/licenses and worker-only WASM CSP. `tests/colour-studio-catalogue.test.mjs` checks explicit family/HEX metadata, duplicate-HEX identity and the published API/page catalogue.

Real Chromium checks exercise both public versions against a disposable CMS: published catalogue replacement, live refresh with a painted photo, exact family filtering, fixed preview geometry, automatic preparation with actual local model weights on an uploaded exterior, two independently painted walls, protected sky/garden/glass/driveway, reset, PNG export, true two-image printing while Before is active, and 320–1,440 px layouts. Existing application, warranty, private storage and prepared-SQL regressions still apply.
