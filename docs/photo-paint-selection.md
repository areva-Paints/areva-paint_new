# Selective wall painting — updated 27 November 2026

## Customer workflow

The desktop workspace keeps the building preview on the left and the published colour palette on the right. The palette scrolls independently. All photo actions remain below the preview; on phones the palette follows those actions. The image frame and control/status rows reserve their dimensions so selecting, priming, recolouring or filtering does not shift the workspace.

1. Choose a room or upload a JPEG, PNG or WebP photo up to 20 MiB / 40 megapixels. **Every photo loads unchanged.** No wall is automatically made white. Samples have predefined selection masks; uploaded photos load the local detector only when the customer first selects a wall.
2. Tap the wall to select it. A thin outline shows the selected surface without changing its pixels. **Apply white primer** is optional and affects that wall only. Applying primer to an already painted wall replaces its colour with white; other walls retain their finishes.
3. Select any published colour card on the right. Colour can be applied directly to the selected wall or after white primer. Repeat on other walls to build a combination; their primer and colour choices remain independent. The latest action wins inside overlapping wall/trim selections. The palette contains the Admin's saved colours and PDF shade cards; decorative image-pattern uploads are not part of this catalogue.
4. **Before** shows the untouched original and **After** shows the customer's changes. **Reset photo** removes all primer/paint and restores the exact original, without another detection download. Keyboard Undo restores the previous finish/reset.
5. **Download** saves the painted after image as PNG, without selection outlines. **Print before & after** produces an original/after comparison with chosen colours and any white primer. Both exports use the after buffer even when Before is displayed; the browser print dialog can print to paper or save PDF.

The primer button stays visible and disabled until a wall is selected. Wall detection never paints anything by itself. A failed detection retains the current preview, clears the failed selection, and offers another tap or **Retry wall selection**; an unsuccessful tap cannot accidentally paint the previously selected wall. Customers can choose another sample/photo while detection is running, which cancels the old work.

Recognition depends on photo clarity and can miss material boundaries or unusual openings. This is a lighting-preserving paint simulation, not plaster reconstruction. Review the selected outline and confirm the final shade with a physical card.

## Published catalogue and family matching

The visualizer displays `SiteContent.colours` and `SiteContent.shadeCards` from the saved Admin snapshot, including exact names, codes, HEX values, family tags and PDF links. It does not substitute a curated list, fabricate a white colour card or cap the catalogue at 48 cards. White primer is a separate wall action. Family choices come from saved metadata rather than RGB inference; a specific family shows only its corresponding colours/PDFs, with general PDFs under All Shades.

Both public versions refresh the saved catalogue on window focus or the same-origin `areva-content-updated` storage event. They retain the selected family/search, or fall back to All Shades if that family was removed. Refresh preserves the photo, masks, selected wall, primer and painted design. Existing finishes keep their colours when Admin records change. Duplicate HEX colours remain distinct records selected by their codes. Loading/refresh failures have retry; a failed refresh retains the last good catalogue.

## Detection, rendering and privacy

Samples use fixed masks with no model download. Uploaded homes use the pinned, quantized **SlimSAM** detector in a dedicated browser worker on the first wall tap. The first model/runtime download is about **25 MB**, cached locally, and encoding takes several seconds depending on the device. WebAssembly support is required. No external inference service, API key, GPU or photo-upload endpoint is used.

Detection computes building/wall bounds and a fine mask for the tapped surface. Confidence, area, position, source-material chroma, darkness and connected-region checks help protect sky, surroundings, wood, openings and glass reflections. The source photograph stays visible throughout; the detector never creates a global white foundation. Later selections reuse the photo embedding and paintable bounds.

`renderSelectedPreview` starts from an immutable original and renders only surfaces with an explicit primer or colour finish. Original lighting/shadows are retained; repeated shade choices do not accumulate previous pigment. Selection-only masks render no pixels. The latest finish is moved above overlapping earlier finishes. Up to sixteen surfaces and bounded keyboard Undo are supported; reset releases custom selections so a new combination can use all sixteen again.

Working photos have a maximum side of 1,200 pixels, with model coordinates mapped back from a padded 1,024-pixel representation. Pixels, embeddings, masks and history stay in browser memory. Changing photos terminates the worker and invalidates pending results. No SQL schema or customer-data changes are required.

## Integration and deployment

- `public/assets/photo-paint-studio.js`: shared controller, lazy surface detection, optional selected-wall primer, immutable rendering, reset and exports. Older white-foundation helpers remain for math compatibility; the editor does not call them to prepare an entire photo.
- `public/assets/shade-catalogue.js`: preserved-page catalogue rendering and live refresh.
- `src/components/ShadeLibrary.tsx`, `src/data/shadeFamilies.ts` and `src/admin/ContentContext.tsx`: published family choices, React palette and loading/refresh state.
- `src/components/ColorVisualizer.tsx` and preserved HTML: shared layout, local decoding, room choices and upload.
- `public/assets/wall-selector-worker.js`, `wall-model/` and `vendor/onnx/`: unchanged pinned Apache-2.0 SlimSAM weights, MIT runtime, manifests and notices. See [asset provenance](../public/assets/wall-model/README.md).
- `src/server/security.ts`: only the dedicated worker may compile WASM; page documents retain the strict script policy.

The painter script/legacy stylesheet use `?v=8`; React requires controller version 8. Deploy the public model/runtime assets with the application. `npm run build` copies them into `dist/assets`. Existing Render commands work; no new service, dependency, environment variable, credential or database table is needed.

## Verification

`tests/selective-wall-primer.test.mjs` covers unchanged load/selection, primer restricted to one wall, direct colour without primer, independent multi-wall combinations, overlapping finish order, exact source restoration and invalid input limits. Existing white-wall math, source protection, model integrity/licensing, CSP, catalogue/API, application, warranty and prepared-SQL regressions remain applicable.

Chromium checks exercise both public hosts with samples and actual local model weights on a customer-style upload: no initial white conversion, selection without pixel changes, optional primer, direct/primed colour, independent walls, exact reset, Undo, Before/After, PNG export and printing from Before view. They also check published catalogue/family sync, refresh with an edited photo, stable image/control geometry, failed selection/retry, cancellation after changing photos, and desktop/mobile layouts.
