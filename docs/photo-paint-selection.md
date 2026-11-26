# Simple white-base painter — updated 26 November 2026

## Customer workflow

The photo stays above the controls. The editor has two steps and visible Before, After and Print buttons. The earlier brush, drag, zoom, outline, area naming/history and quotation panels have been removed.

1. Choose a room photo or upload a JPEG, PNG or WebP photo up to 20 MiB / 40 megapixels. Known room samples start with their defined walls prepared in white, while furnishings and openings remain unchanged.
2. For an uploaded home, press **Prepare white walls**, then tap near the centre of each wall that needs a white base. The first preparation loads and runs a local detector; a progress message remains visible. Subsequent wall taps reuse the photo embedding. Tapping a white surface again in this step removes it, so a poor selection can be retried.
3. Choose **Next: choose a colour**. Tap a prepared white wall, then choose a swatch. The whole selected surface changes colour without a separate Paint action. Other surfaces keep their colours. **More colours** searches the actual catalogue. The first swatch, **White base**, restores the selected wall's foundation.
4. **Before** shows the untouched original; **After** shows the prepared/coloured preview. **Print before & after** opens a two-image print document with the chosen colour names. It always prints the original and the computed final preview, including when Before is currently displayed. The browser's print dialog can print to paper or save a PDF.

The model assists selection; it does not guarantee a perfect architectural mask on every photo. Tap the centre of a clear surface and review its white preparation before colouring. This is a paint simulation preserving lighting and texture, not plaster reconstruction. Confirm a final colour with a physical shade card.

## Detection, rendering and privacy

Known room photos use their fixed masks and need no model download. Uploaded homes use a quantized **SlimSAM** detector in a dedicated browser worker. The initial model/runtime download is about **25 MB** and photo encoding takes several seconds, depending on the device; an up-to-date browser with WebAssembly support is required. Public model assets are cached locally. There is no external inference API, API key, GPU requirement or photo-upload endpoint.

The detector proposes masks from a tap; the editor chooses a fine confident surface and removes disconnected islands. Source colour and darkness protect contrasting objects/openings. Sustained vertical edges help separate adjoining facade planes. Small detection pinholes are closed, while large openings and cast shadows remain meaningful. Selection can still be imperfect on ambiguous surfaces; it is not a warranty of automatic wall recognition.

Selected walls first receive an immutable neutral white foundation. Colours are recomposed from that foundation using the source lighting, without accumulating the earlier pigment or leaving brush-shaped patches. The original photo remains untouched for comparison and printing. Sixteen prepared surfaces are supported, and bounded keyboard Undo remains available without an extra visible tool panel.

Both studios resize the working photo to a maximum side of 1,200 pixels. The model sees a padded, normalized 1,024-pixel representation; decoded masks map back to the original working coordinates. All photo pixels, prompts, embeddings, masks and history stay in browser memory. Changing/leaving a photo terminates its worker and ignores stale results. No warranty/customer database record or SQL table was added.

## Integration and deployment

- `public/assets/photo-paint-studio.js`: shared white preparation, selection postprocessing, minimal editor, colour rendering and before/after printing. Pure older geometry helpers remain for compatibility/regressions; their tool panels are not rendered.
- `public/assets/wall-selector-worker.js`: local encoder/decoder execution, one photo at a time.
- `public/assets/wall-model/`: pinned Apache-licensed model weights, integrity manifest and redistribution documentation.
- `public/assets/vendor/onnx/`: pinned MIT-licensed WASM-only runtime, module loader and third-party notices.
- `src/components/ColorVisualizer.tsx` and the preserved HTML: local photo decoding, room selection and upload controls. The public legacy page keeps its hidden catalogue markup for safe CMS integration; that full catalogue panel is not displayed in this editor.
- `src/server/security.ts`: permits WASM compilation only on the dedicated worker response. Page documents, including admin/auth/warranty, retain their previous strict script policy. General JavaScript `unsafe-eval` is not enabled.

The script and legacy stylesheet use `?v=6`; React requires controller version 6. Deploy all public model/runtime files with the application. The normal `npm run build` copies them into `dist/assets`; existing Render commands remain valid. No new service, npm runtime dependency, environment variable or API credential is needed. See [asset provenance](../public/assets/wall-model/README.md) before changing the model or runtime.

## Verification

`tests/white-wall-painter.test.mjs` checks neutral white preparation, preservation of source pixels/openings/shadows, independent recolouring, mask cleanup and facade boundaries, model-output decoding, bundled file hashes/licenses and worker-only WASM CSP. Existing application, private storage, warranty, prepared-SQL and geometry regressions still apply.

Real-browser checks exercise both studios with actual model weights on an uploaded exterior, white-first preparation, direct colour selection, Before/After, true two-image printing while Before is active, removed tool panels, local-only inference and layouts from 320 to 1,440 pixels. Browser checks also verify that no script/CSP errors occur.
