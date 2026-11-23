/* Shared photo painter for the public HTML and React studios. This dependency-free
 * browser asset also exposes its pure geometry/colour functions to regression tests.
 * Photos and masks stay in browser memory; this code makes no network requests.
 */
(() => {
  const MAX_PIXELS = 1500000,
    MAX_POINTS = 80;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const linear = Float64Array.from({ length: 256 }, (_, i) => {
    const value = i / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const encode = (value) =>
    Math.round(
      255 *
        (value <= 0.0031308
          ? 12.92 * value
          : 1.055 * value ** (1 / 2.4) - 0.055),
    );
  const luminance = (data, i) =>
    0.2126 * linear[data[i]] +
    0.7152 * linear[data[i + 1]] +
    0.0722 * linear[data[i + 2]];
  function size(width, height) {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width * height > MAX_PIXELS
    )
      throw Error("Choose a smaller photo to preview.");
    return width * height;
  }

  /* Refuse crossing outlines rather than silently painting an unexpected shape. */
  function validPolygon(points) {
    if (
      points.length < 3 ||
      points.length > MAX_POINTS ||
      points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))
    )
      return false;
    const cross = (a, b, c) =>
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const on = (a, b, p) =>
      Math.abs(cross(a, b, p)) < 1e-7 &&
      p[0] >= Math.min(a[0], b[0]) &&
      p[0] <= Math.max(a[0], b[0]) &&
      p[1] >= Math.min(a[1], b[1]) &&
      p[1] <= Math.max(a[1], b[1]);
    const intersects = (a, b, c, d) =>
      (cross(a, b, c) * cross(a, b, d) < 0 &&
        cross(c, d, a) * cross(c, d, b) < 0) ||
      on(a, b, c) ||
      on(a, b, d) ||
      on(c, d, a) ||
      on(c, d, b);
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01) return false;
      area += a[0] * b[1] - b[0] * a[1];
      for (let j = i + 2; j < points.length; j++) {
        if (i === 0 && j === points.length - 1) continue;
        if (intersects(a, b, points[j], points[(j + 1) % points.length]))
          return false;
      }
    }
    return Math.abs(area) >= 2;
  }

  /* Scan-convert four subpixel samples per pixel for smooth, bounded polygon edges.
   * Coordinates always refer to the image, independent of display size or zoom.
   */
  function polygonMask(width, height, points) {
    const count = size(width, height);
    if (!validPolygon(points))
      throw Error("Outline at least three corners without crossing the edges.");
    const hits = new Uint8Array(count);
    const minY = clamp(
      Math.floor(Math.min(...points.map((p) => p[1]))),
      0,
      height,
    );
    const maxY = clamp(
      Math.ceil(Math.max(...points.map((p) => p[1]))),
      0,
      height,
    );
    for (let y = minY; y < maxY; y++)
      for (const dy of [0.25, 0.75]) {
        const scan = y + dy,
          cuts = [];
        for (let i = 0; i < points.length; i++) {
          const [ax, ay] = points[i],
            [bx, by] = points[(i + 1) % points.length];
          if (ay > scan !== by > scan)
            cuts.push(ax + ((scan - ay) * (bx - ax)) / (by - ay));
        }
        cuts.sort((a, b) => a - b);
        for (let j = 0; j + 1 < cuts.length; j += 2) {
          const start = clamp(Math.floor(cuts[j]), 0, width),
            end = clamp(Math.ceil(cuts[j + 1]), 0, width);
          for (let x = start; x < end; x++) {
            if (x + 0.25 >= cuts[j] && x + 0.25 < cuts[j + 1])
              hits[y * width + x]++;
            if (x + 0.75 >= cuts[j] && x + 0.75 < cuts[j + 1])
              hits[y * width + x]++;
          }
        }
      }
    return hits.map((value) => Math.round((value * 255) / 4));
  }
  const subtractMask = (mask, cut) => {
    if (mask.length !== cut.length)
      throw Error("Selection sizes do not match.");
    return mask.map((value, i) => Math.round(value * (1 - cut[i] / 255)));
  };

  /* Optional connected selection is deliberately conservative. It previews a mask
   * only; it never changes the photo before the user presses Paint selected area.
   */
  function connectedMask(image, x, y, tolerance = 24) {
    const { width, height, data } = image,
      count = size(width, height);
    if (data.length !== count * 4 || !Number.isFinite(x) || !Number.isFinite(y))
      throw Error("Choose a point in the photo.");
    x = clamp(Math.floor(x), 0, width - 1);
    y = clamp(Math.floor(y), 0, height - 1);
    const samples = [[], [], []];
    for (let sy = Math.max(0, y - 1); sy <= Math.min(height - 1, y + 1); sy++)
      for (let sx = Math.max(0, x - 1); sx <= Math.min(width - 1, x + 1); sx++)
        for (let k = 0; k < 3; k++)
          samples[k].push(data[(sy * width + sx) * 4 + k]);
    const seed = samples.map(
      (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)],
    );
    const limit =
      clamp(Number.isFinite(tolerance) ? tolerance : 24, 8, 50) ** 2 * 3;
    const visited = new Uint8Array(count),
      mask = new Uint8Array(count),
      queue = new Int32Array(count);
    let head = 0,
      tail = 1;
    queue[0] = y * width + x;
    visited[queue[0]] = 1;
    while (head < tail) {
      const p = queue[head++],
        i = p * 4;
      if (data[i + 3] < 128) continue;
      mask[p] = 255;
      const px = p % width;
      for (const next of [
        px > 0 ? p - 1 : -1,
        px < width - 1 ? p + 1 : -1,
        p >= width ? p - width : -1,
        p < count - width ? p + width : -1,
      ]) {
        if (next < 0 || visited[next]) continue;
        visited[next] = 1;
        const ni = next * 4;
        const distance =
          (data[ni] - seed[0]) ** 2 +
          (data[ni + 1] - seed[1]) ** 2 +
          (data[ni + 2] - seed[2]) ** 2;
        const edge =
          (data[ni] - data[i]) ** 2 +
          (data[ni + 1] - data[i + 1]) ** 2 +
          (data[ni + 2] - data[i + 2]) ** 2;
        if (distance <= limit && edge <= 38 ** 2 * 3) queue[tail++] = next;
      }
    }
    return mask;
  }

  /* Replace the old pigment in linear light, using a robust selection-wide light
   * reference instead of the tapped pixel. Shadows remain textured, bright shades
   * retain their hue, and soft highlights never flatten into clipped neon RGB.
   */
  function paintImage(original, current, mask, hex) {
    const { width, height, data: source } = original,
      count = size(width, height);
    if (
      source.length !== count * 4 ||
      current.length !== source.length ||
      mask.length !== count ||
      !/^#[a-f0-9]{6}$/i.test(hex)
    )
      throw Error("Choose a valid shade and selection.");
    const histogram = new Uint32Array(256);
    let selected = 0;
    for (let p = 0; p < count; p++)
      if (mask[p] >= 128 && source[p * 4 + 3] >= 128) {
        histogram[Math.round(luminance(source, p * 4) * 255)]++;
        selected++;
      }
    if (!selected) return new Uint8ClampedArray(current);
    let cumulative = 0,
      level = 0;
    while (level < 255) {
      cumulative += histogram[level];
      if (cumulative >= selected * 0.75) break;
      level++;
    }
    const reference = Math.max(0.015, level / 255);
    const target = [1, 3, 5].map(
      (offset) => linear[parseInt(hex.slice(offset, offset + 2), 16)],
    );
    const output = new Uint8ClampedArray(current);
    for (let p = 0; p < count; p++) {
      if (!mask[p] || !source[p * 4 + 3]) continue;
      const i = p * 4,
        ratio = luminance(source, i) / reference;
      const shadow = Math.min(1, Math.max(0.025, ratio) ** 0.85);
      const highlight = clamp((ratio - 1) * 0.12, 0, 0.16);
      const alpha = mask[p] / 255;
      for (let k = 0; k < 3; k++) {
        const painted = target[k] * shadow * (1 - highlight) + highlight;
        output[i + k] = encode(
          clamp(linear[current[i + k]] * (1 - alpha) + painted * alpha, 0, 1),
        );
      }
    }
    return output;
  }

  /* One controller owns selection, exclusion, pointer/keyboard coordinates and
   * bounded undo in both public renderers. CMS shade names only enter textContent.
   */
  function createEditor({
    canvas,
    controls,
    shade,
    onStatus = () => {},
    onChange = () => {},
    onBeforeSelect = () => {},
  }) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const overlay = document.createElement("canvas"),
      oc = overlay.getContext("2d");
    overlay.className = "ap-selection";
    overlay.tabIndex = 0;
    overlay.setAttribute(
      "aria-label",
      "Select a paint area. Tap corners, or use arrow keys and Enter to add corners.",
    );
    overlay.setAttribute(
      "aria-keyshortcuts",
      "ArrowUp ArrowDown ArrowLeft ArrowRight Enter Escape Backspace",
    );
    overlay.hidden = true;
    canvas.parentElement.append(overlay);
    controls.classList.add("ap-tools");
    controls.innerHTML = `<p class="ap-instructions">1. Outline a wall by tapping its corners. 2. Finish the area. 3. Choose a shade and paint.</p>
      <div class="ap-tool-row" role="group" aria-label="Area selection tools">
        <button type="button" data-tool="outline" aria-pressed="true">Select area</button>
        <button type="button" data-tool="quick" aria-pressed="false">Quick select</button>
        <button type="button" data-tool="exclude" aria-pressed="false">Exclude window / door</button>
      </div>
      <div class="ap-tool-row">
        <button type="button" data-action="finish">Finish area</button>
        <button type="button" data-action="back">Remove last point</button>
        <button type="button" data-action="clear">Clear selection</button>
        <span class="ap-points"></span>
      </div>
      <label class="ap-range" hidden>Quick selection range <input type="range" min="8" max="50" value="24"><span>24</span></label>
      <button type="button" data-action="paint" class="ap-paint">Paint selected area</button>
      <p class="ap-note">Exclude windows and doors before painting. Select a new area to use another shade. Photos stay on your device.</p>`;
    let original = null,
      current = null,
      mask = null,
      selectionBase = null,
      points = [],
      mode = "outline",
      history = [],
      colors = [];
    let enabled = true,
      comparing = false,
      applied = false,
      destroyed = false,
      pointer = null,
      cursor = null,
      quickPoint = null;
    const listeners = [];
    const listen = (element, event, handler) => {
      element.addEventListener(event, handler);
      listeners.push(() => element.removeEventListener(event, handler));
    };
    const button = (action) =>
      controls.querySelector(`[data-action="${action}"]`);
    const hasMask = () => !!mask?.some((value) => value > 0);
    const report = (message) => {
      if (!destroyed) onStatus(message);
    };
    const state = () => ({
      canUndo: history.length > 0,
      colors: colors.map((color) => ({ ...color })),
    });
    function refresh() {
      const ready = enabled && !!original;
      controls.querySelectorAll("button").forEach((element) => {
        element.disabled = !ready;
      });
      controls
        .querySelectorAll("[data-tool]")
        .forEach((element) =>
          element.setAttribute(
            "aria-pressed",
            String(element.dataset.tool === mode),
          ),
        );
      button("finish").disabled = !ready || points.length < 3;
      button("back").disabled = !ready || !points.length;
      button("clear").disabled = !ready || (!mask && !points.length);
      button("paint").disabled = !ready || !hasMask() || points.length > 0;
      controls.querySelector('[data-tool="exclude"]').disabled =
        !ready || !hasMask();
      controls.querySelector(".ap-points").textContent = points.length
        ? `${points.length} corners`
        : hasMask()
          ? "Area selected"
          : "No area selected";
      controls.querySelector(".ap-range").hidden = mode !== "quick";
      overlay.hidden = !ready;
      draw();
    }
    function draw() {
      oc.clearRect(0, 0, overlay.width, overlay.height);
      if (!original || comparing) return;
      if (mask) {
        const tint = oc.createImageData(overlay.width, overlay.height),
          w = overlay.width;
        for (let p = 0; p < mask.length; p++)
          if (mask[p]) {
            const edge =
              p < w ||
              p >= mask.length - w ||
              p % w === 0 ||
              p % w === w - 1 ||
              !mask[p - 1] ||
              !mask[p + 1] ||
              !mask[p - w] ||
              !mask[p + w];
            const i = p * 4;
            tint.data[i] = 114;
            tint.data[i + 1] = 51;
            tint.data[i + 2] = 169;
            tint.data[i + 3] = edge
              ? 230
              : applied
                ? 0
                : Math.round(mask[p] * 0.18);
          }
        oc.putImageData(tint, 0, 0);
      }
      const scale =
          overlay.width / Math.max(1, overlay.getBoundingClientRect().width),
        line = Math.max(1, scale * 2);
      oc.lineWidth = line;
      oc.strokeStyle = mode === "exclude" ? "#e24e30" : "#7233a9";
      oc.fillStyle = "#fff";
      if (points.length) {
        oc.beginPath();
        points.forEach(([x, y], index) =>
          index ? oc.lineTo(x, y) : oc.moveTo(x, y),
        );
        oc.stroke();
        points.forEach(([x, y], index) => {
          oc.beginPath();
          oc.arc(x, y, Math.max(3, scale * 4), 0, Math.PI * 2);
          oc.fill();
          oc.stroke();
          oc.font = `bold ${Math.max(11, scale * 12)}px Arial`;
          oc.fillStyle = "#32104c";
          oc.fillText(String(index + 1), x + scale * 7, y - scale * 5);
          oc.fillStyle = "#fff";
        });
      }
      if (cursor) {
        oc.beginPath();
        oc.moveTo(cursor[0] - 8 * scale, cursor[1]);
        oc.lineTo(cursor[0] + 8 * scale, cursor[1]);
        oc.moveTo(cursor[0], cursor[1] - 8 * scale);
        oc.lineTo(cursor[0], cursor[1] + 8 * scale);
        oc.stroke();
      }
    }
    function begin() {
      comparing = false;
      onBeforeSelect();
    }
    function addPoint(x, y) {
      if (!enabled || !original) return;
      begin();
      if (mode === "quick") {
        quickPoint = [x, y];
        mask = connectedMask(
          original,
          x,
          y,
          +controls.querySelector("input").value,
        );
        selectionBase = current.data;
        applied = false;
        report(
          "Check the highlighted area. Use Select area for precise edges, or Paint selected area to apply your shade.",
        );
      } else {
        if (points.length >= MAX_POINTS)
          return report("Finish this outline before adding more corners.");
        if (
          points.length &&
          Math.hypot(x - points[0][0], y - points[0][1]) <
            Math.max(
              3,
              (overlay.width / overlay.getBoundingClientRect().width) * 9,
            ) &&
          points.length >= 3
        ) {
          finish();
          return;
        }
        if (
          points.length &&
          Math.hypot(x - points.at(-1)[0], y - points.at(-1)[1]) < 1
        )
          return;
        if (mode === "outline" && !points.length) {
          mask = null;
          selectionBase = null;
          applied = false;
        }
        points.push([
          clamp(x, 0, original.width),
          clamp(y, 0, original.height),
        ]);
        report(
          mode === "exclude"
            ? "Outline the window or door, then choose Finish area to exclude it."
            : "Keep tapping the wall corners, then choose Finish area. Nothing is painted yet.",
        );
      }
      refresh();
    }
    function finish() {
      if (!original || points.length < 3) return;
      try {
        const polygon = polygonMask(original.width, original.height, points);
        if (mode !== "exclude" || !selectionBase) selectionBase = current.data;
        mask =
          mode === "exclude" && mask ? subtractMask(mask, polygon) : polygon;
        points = [];
        applied = false;
        if (mode === "exclude") mode = "outline";
        report(
          hasMask()
            ? "Area selected. Exclude any windows or doors, choose a shade, then click Paint selected area."
            : "The selection is empty. Select a wall area again.",
        );
        refresh();
      } catch (error) {
        report(error.message);
      }
    }
    function apply() {
      if (!original || !hasMask() || points.length) return;
      begin();
      const chosen = shade();
      try {
        // Recolour a retained selection from its pre-paint pixels, including soft
        // boundary coverage. Trying shades must not accumulate a coloured fringe.
        const base = new Uint8ClampedArray(current.data);
        if (selectionBase)
          for (let p = 0; p < mask.length; p++)
            if (mask[p])
              for (let k = 0; k < 3; k++)
                base[p * 4 + k] = selectionBase[p * 4 + k];
        const data = paintImage(original, base, mask, chosen.hex);
        history.push({ data: current, colors });
        if (history.length > 8) history.shift();
        current = new ImageData(data, original.width, original.height);
        colors = [
          ...colors.filter(
            (color) => color.hex.toLowerCase() !== chosen.hex.toLowerCase(),
          ),
          { hex: chosen.hex, name: chosen.name },
        ].slice(-50);
        context.putImageData(current, 0, 0);
        applied = true;
        report(
          `Painted the selected area with ${chosen.name || chosen.hex}. Choose Select area for another wall, or try another shade here.`,
        );
        refresh();
        onChange(state());
      } catch (error) {
        report(error.message);
      }
    }
    listen(controls, "click", (event) => {
      const target = event.target.closest("button");
      if (!target || target.disabled || !enabled || !original) return;
      const tool = target.dataset.tool;
      if (tool) {
        begin();
        mode = tool;
        points = [];
        cursor = null;
        quickPoint = null;
        if (tool !== "exclude") {
          mask = null;
          selectionBase = null;
          applied = false;
        }
        report(
          tool === "quick"
            ? "Tap one wall to preview a connected selection. Check its edges before painting."
            : tool === "exclude"
              ? "Tap around a window or door to leave it unpainted, then choose Finish area."
              : "Tap the corners of one wall section, then choose Finish area.",
        );
      } else if (target.dataset.action === "finish") finish();
      else if (target.dataset.action === "back") points.pop();
      else if (target.dataset.action === "clear") {
        points = [];
        mask = null;
        selectionBase = null;
        cursor = null;
        quickPoint = null;
        mode = "outline";
        report("Selection cleared. Painted areas are unchanged.");
      } else if (target.dataset.action === "paint") apply();
      refresh();
    });
    listen(controls.querySelector("input"), "input", (event) => {
      controls.querySelector(".ap-range span").textContent = event.target.value;
      if (mode === "quick" && quickPoint) addPoint(...quickPoint);
    });
    listen(overlay, "pointerdown", (event) => {
      if (event.isPrimary && event.button === 0)
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    listen(overlay, "pointercancel", () => {
      pointer = null;
    });
    listen(overlay, "pointerup", (event) => {
      if (
        !pointer ||
        event.pointerId !== pointer.id ||
        Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8
      ) {
        pointer = null;
        return;
      }
      pointer = null;
      const rect = overlay.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      addPoint(
        ((event.clientX - rect.left) * overlay.width) / rect.width,
        ((event.clientY - rect.top) * overlay.height) / rect.height,
      );
    });
    listen(overlay, "keydown", (event) => {
      if (!enabled || !original) return;
      const delta = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[event.key];
      if (delta) {
        event.preventDefault();
        begin();
        cursor ||= [overlay.width / 2, overlay.height / 2];
        const step = event.shiftKey ? 20 : 2;
        cursor = [
          clamp(cursor[0] + delta[0] * step, 0, overlay.width),
          clamp(cursor[1] + delta[1] * step, 0, overlay.height),
        ];
        draw();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        cursor ||= [overlay.width / 2, overlay.height / 2];
        addPoint(...cursor);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        points.pop();
        refresh();
      } else if (event.key === "Escape") {
        points = [];
        cursor = null;
        if (mode === "exclude") mode = "outline";
        refresh();
        report("Outline cancelled.");
      }
    });
    const api = {
      setImage(image) {
        const count = size(image.width, image.height);
        if (image.data.length !== count * 4)
          throw Error("This photo could not be read.");
        enabled = true;
        controls.hidden = false;
        original = new ImageData(
          new Uint8ClampedArray(image.data),
          image.width,
          image.height,
        );
        current = new ImageData(
          new Uint8ClampedArray(image.data),
          image.width,
          image.height,
        );
        overlay.width = image.width;
        overlay.height = image.height;
        api.reset();
      },
      reset() {
        if (!enabled || !original) return;
        begin();
        current = new ImageData(
          new Uint8ClampedArray(original.data),
          original.width,
          original.height,
        );
        context.putImageData(current, 0, 0);
        history = [];
        colors = [];
        mask = null;
        selectionBase = null;
        points = [];
        cursor = null;
        quickPoint = null;
        applied = false;
        mode = "outline";
        refresh();
        onChange(state());
        report(
          "Photo ready. Select one wall area by tapping its corners, then choose Finish area.",
        );
      },
      undo() {
        if (!enabled || !history.length || !original) return;
        begin();
        const previous = history.pop();
        current = previous.data;
        colors = previous.colors;
        context.putImageData(current, 0, 0);
        mask = null;
        selectionBase = null;
        points = [];
        cursor = null;
        quickPoint = null;
        mode = "outline";
        refresh();
        onChange(state());
        report("Last paint action undone.");
      },
      setEnabled(value) {
        enabled = value;
        controls.hidden = !value;
        refresh();
      },
      setComparison(value) {
        comparing = value;
        draw();
      },
      shadeChanged() {
        report(
          hasMask()
            ? "Shade selected. Click Paint selected area to apply it within your selection."
            : "Shade selected. Outline one wall area, then finish and paint it.",
        );
      },
      destroy() {
        destroyed = true;
        listeners.forEach((remove) => remove());
        overlay.remove();
        controls.replaceChildren();
        original = current = mask = selectionBase = null;
        history = [];
        colors = [];
      },
    };
    refresh();
    return api;
  }
  globalThis.ArevaPaintStudio = Object.freeze({
    polygonMask,
    subtractMask,
    connectedMask,
    paintImage,
    validPolygon,
    createEditor,
  });
})();
