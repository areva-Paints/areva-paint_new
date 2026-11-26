# Local wall selection assets

These public files are fetched by the browser worker. Customer photos and prompts are never uploaded to a model service.

- **SlimSAM** ONNX conversion: [Xenova/slimsam-77-uniform](https://huggingface.co/Xenova/slimsam-77-uniform), revision `5850ab45f587c112167512ffef949107115e26a0`, derived from `nielsr/slimsam-77-uniform`. Distributed under Apache-2.0; see `LICENSE.txt`. The files are the quantized vision encoder and quantized prompt encoder/mask decoder, renamed `v1/encoder.onnx` and `v1/decoder.onnx`.
- **ONNX Runtime Web 1.22.0**, from the `onnxruntime-web` npm release, is distributed under MIT. The WASM-only JavaScript entry, SIMD WASM module and its module loader are under `../vendor/onnx/`, with the release's license and third-party notices.

`manifest.json` pins SHA-256 hashes for the five model/runtime files. Regression tests check those hashes and the included licenses. Keep the assets together when deploying; `npm run build` copies them into `dist/assets`. No new environment variables, API keys or server-side inference process are required.

To reproduce a model update, download the quantized ONNX files from the specified immutable Hugging Face revision and the runtime files from the exact npm package version. Review the license, evaluate selection and browser performance, update the manifest hashes, bump the model directory/worker URL as appropriate, and run the white-wall and browser checks. Do not replace a published `v1` model with different bytes.
