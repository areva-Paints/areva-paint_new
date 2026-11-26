/* Apache-licensed SlimSAM runs in this worker. Only public model files are fetched;
 * the customer's image and prompts remain on this device. One photo is kept at a time.
 */
importScripts("/assets/vendor/onnx/ort.wasm.min.js");
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = "/assets/vendor/onnx/";
let encoder, decoder, embedding;
async function session(file) {
  const response = await fetch("/assets/wall-model/v1/" + file, {
    cache: "force-cache",
  });
  if (!response.ok) throw Error("Wall selection is unavailable.");
  return ort.InferenceSession.create(await response.arrayBuffer(), {
    executionProviders: ["wasm"],
  });
}
self.onmessage = async ({ data }) => {
  try {
    if (data.kind === "encode") {
      self.postMessage({ id: data.id, progress: "Preparing your photo…" });
      encoder ||= await session("encoder.onnx");
      decoder ||= await session("decoder.onnx");
      if (embedding) Object.values(embedding).forEach((t) => t.dispose());
      const input = new ort.Tensor("float32", data.pixels, [1, 3, 1024, 1024]);
      embedding = await encoder.run({ pixel_values: input });
      input.dispose();
      self.postMessage({ id: data.id, ready: true });
    } else if (data.kind === "select" && embedding) {
      const points = new ort.Tensor(
        "float32",
        Float32Array.from(data.point),
        [1, 1, 1, 2],
      );
      const labels = new ort.Tensor(
        "int64",
        BigInt64Array.from([1n]),
        [1, 1, 1],
      );
      const result = await decoder.run({
        ...embedding,
        input_points: points,
        input_labels: labels,
      });
      const masks = result.pred_masks.data.slice(),
        scores = result.iou_scores.data.slice();
      Object.values(result).forEach((t) => t.dispose());
      points.dispose();
      labels.dispose();
      self.postMessage({ id: data.id, masks, scores }, [
        masks.buffer,
        scores.buffer,
      ]);
    } else throw Error("Prepare the photo first.");
  } catch {
    self.postMessage({
      id: data.id,
      error:
        "Wall selection could not finish. Please try again or choose a room photo.",
    });
  }
};
