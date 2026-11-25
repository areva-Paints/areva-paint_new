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

  /* Sample photos have explicit architectural boundaries. Coordinates use a
   * 0–1000 photo grid, so both studios share the same walls at every resolution.
   * Furniture, openings, frames and trim are cut out before any paint is applied.
   */
  const roomWalls = {
    "nordic-living": [
      {
        id: "feature",
        label: "Sofa wall",
        outline: [
          [286, 64],
          [857, 64],
          [857, 796],
          [233, 796],
          [233, 148],
          [286, 148],
        ],
        cuts: [
          [
            [347, 652],
            [362, 617],
            [444, 610],
            [510, 617],
            [518, 612],
            [736, 612],
            [779, 642],
            [800, 674],
            [822, 665],
            [837, 685],
            [837, 810],
            [347, 810],
          ],
          [
            [650, 281],
            [737, 281],
            [737, 492],
            [650, 492],
          ],
          [
            [260, 489],
            [280, 489],
            [280, 525],
            [260, 525],
          ],
        ],
      },
      {
        id: "window",
        label: "Window wall",
        outline: [
          [860, 64],
          [896, 2],
          [999, 2],
          [999, 945],
          [860, 828],
        ],
        cuts: [
          [
            [892, 96],
            [999, 3],
            [999, 758],
            [892, 720],
          ],
        ],
      },
    ],
    "master-bedroom": [
      {
        id: "feature",
        label: "Bed wall",
        outline: [
          [168, 43],
          [826, 43],
          [826, 725],
          [168, 725],
        ],
        cuts: [
          [
            [342, 388],
            [665, 388],
            [670, 598],
            [800, 725],
            [800, 800],
            [200, 800],
            [200, 589],
            [316, 580],
            [342, 595],
          ],
          [
            [271, 414],
            [321, 414],
            [321, 594],
            [268, 594],
          ],
          [
            [191, 416],
            [254, 407],
            [265, 565],
            [246, 599],
            [206, 599],
          ],
          [
            [729, 545],
            [754, 504],
            [785, 483],
            [819, 518],
            [826, 564],
            [826, 735],
            [748, 735],
          ],
        ],
      },
      {
        id: "side",
        label: "Side wall",
        outline: [
          [2, 2],
          [164, 40],
          [164, 725],
          [2, 892],
        ],
        cuts: [
          [
            [46, 96],
            [119, 139],
            [119, 413],
            [46, 390],
          ],
        ],
      },
    ],
    "kitchen-studio": [
      {
        id: "kitchen",
        label: "Kitchen wall",
        outline: [
          [94, 112],
          [257, 249],
          [257, 314],
          [138, 314],
          [138, 795],
          [94, 795],
        ],
        cuts: [
          [
            [136, 319],
            [257, 338],
            [257, 359],
            [136, 344],
          ],
        ],
      },
      {
        id: "dining",
        label: "Dining wall",
        outline: [
          [744, 248],
          [896, 241],
          [896, 556],
          [744, 594],
        ],
        cuts: [
          [
            [790, 322],
            [896, 317],
            [896, 559],
            [790, 590],
          ],
        ],
      },
    ],
    "modern-villa": [
      {
        id: "front",
        label: "Front wall",
        outline: [
          [675, 446],
          [776, 397],
          [776, 742],
          [675, 715],
        ],
        cuts: [
          [
            [713, 494],
            [736, 491],
            [736, 716],
            [713, 716],
          ],
          [
            [749, 548],
            [760, 548],
            [760, 571],
            [749, 571],
          ],
          [
            [665, 675],
            [703, 678],
            [720, 727],
            [720, 750],
            [665, 750],
          ],
        ],
      },
      {
        id: "side",
        label: "Side wall",
        outline: [
          [838, 86],
          [935, 199],
          [935, 699],
          [838, 746],
        ],
        cuts: [
          [
            [841, 519],
            [913, 529],
            [913, 715],
            [841, 743],
          ],
          [
            [888, 248],
            [904, 260],
            [904, 455],
            [888, 445],
          ],
          [
            [923, 511],
            [932, 511],
            [932, 525],
            [923, 525],
          ],
          [
            [919, 674],
            [935, 655],
            [935, 712],
            [917, 721],
          ],
        ],
      },
      {
        id: "upper",
        label: "Upper wall",
        outline: [
          [335, 105],
          [530, 270],
          [530, 287],
          [501, 318],
          [501, 507],
          [445, 501],
          [445, 262],
          [383, 227],
          [335, 257],
        ],
        cuts: [],
      },
    ],
    "office-studio": [
      {
        id: "feature",
        label: "Feature wall",
        outline: [
          [2, 97],
          [433, 247],
          [433, 638],
          [2, 890],
        ],
        cuts: [
          [
            [127, 292],
            [264, 327],
            [264, 622],
            [127, 637],
          ],
          [
            [279, 331],
            [373, 353],
            [373, 600],
            [279, 620],
          ],
          [
            [258, 702],
            [281, 676],
            [393, 637],
            [433, 630],
            [433, 900],
            [258, 900],
          ],
        ],
      },
      {
        id: "side",
        label: "Side wall",
        outline: [
          [505, 284],
          [579, 304],
          [579, 584],
          [505, 584],
        ],
        cuts: [
          [
            [516, 457],
            [547, 460],
            [551, 582],
            [516, 582],
          ],
          [
            [535, 581],
            [579, 573],
            [579, 603],
            [535, 603],
          ],
        ],
      },
    ],
  };
  function presetWallRegions(width, height, roomId) {
    size(width, height);
    const polygon = (points) =>
      polygonMask(
        width,
        height,
        points.map(([x, y]) => [(x * width) / 1000, (y * height) / 1000]),
      );
    return (roomWalls[roomId] || []).map(({ id, label, outline, cuts }) => ({
      regionKey: `${roomId}:${id}`,
      label,
      mask: cuts.reduce(
        (mask, cut) => subtractMask(mask, polygon(cut)),
        polygon(outline),
      ),
    }));
  }

  /* Smooth only the selection analysis, not the displayed photograph. This makes
   * small texture changes tolerable without erasing real light/shadow detail.
   */
  const selectionImages = new WeakMap();
  function selectionImage(image) {
    if (selectionImages.has(image)) return selectionImages.get(image);
    const { width, height, data } = image,
      horizontal = new Uint8ClampedArray(data.length),
      blurred = new Uint8ClampedArray(data.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        for (let k = 0; k < 3; k++)
          horizontal[(y * width + x) * 4 + k] =
            (data[(y * width + Math.max(0, x - 1)) * 4 + k] +
              data[(y * width + x) * 4 + k] +
              data[(y * width + Math.min(width - 1, x + 1)) * 4 + k]) /
            3;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        for (let k = 0; k < 3; k++)
          blurred[(y * width + x) * 4 + k] =
            (horizontal[(Math.max(0, y - 1) * width + x) * 4 + k] +
              horizontal[(y * width + x) * 4 + k] +
              horizontal[(Math.min(height - 1, y + 1) * width + x) * 4 + k]) /
            3;
    selectionImages.set(image, blurred);
    return blurred;
  }
  /* Follow connected wall colour through lighting changes, while stopping at
   * strong object boundaries. A final raw-pixel edge pass restores sharp borders.
   */
  function connectedMask(image, x, y, tolerance = 24) {
    const { width, height, data } = image,
      count = size(width, height);
    if (data.length !== count * 4 || !Number.isFinite(x) || !Number.isFinite(y))
      throw Error("Choose a point in the photo.");
    x = clamp(Math.floor(x), 0, width - 1);
    y = clamp(Math.floor(y), 0, height - 1);
    const smooth = selectionImage(image),
      seedIndex = (y * width + x) * 4;
    const sr = smooth[seedIndex],
      sg = smooth[seedIndex + 1],
      sb = smooth[seedIndex + 2],
      sum = Math.max(80, sr + sg + sb);
    const seedChroma = [(sr - sg) / sum, (sb - sg) / sum],
      seedLight = (0.2126 * sr + 0.7152 * sg + 0.0722 * sb) / 255;
    const range = clamp(Number.isFinite(tolerance) ? tolerance : 24, 8, 50),
      chromaLimit = (0.018 + range / 2000) ** 2;
    const edgeLimit = (5 + range * 0.22) ** 2 * 3,
      minLight = Math.max(0.055, seedLight * 0.28),
      maxLight = Math.min(1, seedLight * 1.7 + 0.05);
    const visited = new Uint8Array(count),
      mask = new Uint8Array(count),
      queue = new Int32Array(count);
    let head = 0,
      tail = 1;
    queue[0] = y * width + x;
    visited[queue[0]] = 1;
    const eligible = (p) => {
      const i = p * 4,
        r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        s = Math.max(80, r + g + b),
        light = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      return (
        data[i + 3] >= 128 &&
        light >= minLight &&
        light <= maxLight &&
        ((r - g) / s - seedChroma[0]) ** 2 +
          ((b - g) / s - seedChroma[1]) ** 2 <=
          chromaLimit
      );
    };
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
        const edge =
          (smooth[ni] - smooth[i]) ** 2 +
          (smooth[ni + 1] - smooth[i + 1]) ** 2 +
          (smooth[ni + 2] - smooth[i + 2]) ** 2;
        if (edge <= edgeLimit && eligible(next)) queue[tail++] = next;
      }
    }
    const refined = new Uint8Array(mask),
      rawLimit = (range * 1.5) ** 2 * 3;
    for (let p = 0; p < count; p++)
      if (mask[p]) {
        const px = p % width,
          i = p * 4;
        for (const next of [
          px > 0 ? p - 1 : -1,
          px < width - 1 ? p + 1 : -1,
          p >= width ? p - width : -1,
          p < count - width ? p + width : -1,
        ]) {
          if (next < 0 || mask[next] || !eligible(next)) continue;
          const ni = next * 4;
          const edge =
            (data[ni] - data[i]) ** 2 +
            (data[ni + 1] - data[i + 1]) ** 2 +
            (data[ni + 2] - data[i + 2]) ** 2;
          const largestStep = Math.max(
            Math.abs(data[ni] - data[i]),
            Math.abs(data[ni + 1] - data[i + 1]),
            Math.abs(data[ni + 2] - data[i + 2]),
          );
          if (edge <= rawLimit && largestStep <= range * 1.5)
            refined[next] = 255;
        }
      }
    return refined;
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

  /* Brush capsules interpolate between pointer samples, so fast strokes have no
   * gaps. Masks are copied per gesture; saved walls and undo snapshots stay immutable.
   */
  function strokeInto(mask, width, height, from, to, radius, erase = false) {
    const count = size(width, height);
    if (
      mask.length !== count ||
      ![...from, ...to, radius].every(Number.isFinite) ||
      radius <= 0 ||
      radius > 512
    )
      throw Error("Choose a valid brush size and position.");
    const ax = from[0],
      ay = from[1],
      dx = to[0] - ax,
      dy = to[1] - ay,
      length = dx * dx + dy * dy;
    const left = clamp(Math.floor(Math.min(ax, to[0]) - radius - 1), 0, width);
    const right = clamp(Math.ceil(Math.max(ax, to[0]) + radius + 1), 0, width);
    const top = clamp(Math.floor(Math.min(ay, to[1]) - radius - 1), 0, height);
    const bottom = clamp(
      Math.ceil(Math.max(ay, to[1]) + radius + 1),
      0,
      height,
    );
    for (let y = top; y < bottom; y++)
      for (let x = left; x < right; x++) {
        const t = length
          ? clamp(((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / length, 0, 1)
          : 0;
        const distance = Math.hypot(
          x + 0.5 - ax - t * dx,
          y + 0.5 - ay - t * dy,
        );
        const alpha = Math.round(clamp(radius + 0.5 - distance, 0, 1) * 255),
          p = y * width + x;
        if (alpha)
          mask[p] = erase
            ? Math.min(mask[p], 255 - alpha)
            : Math.max(mask[p], alpha);
      }
    return mask;
  }
  function brushMask(width, height, mask, points, radius, erase = false) {
    if (!points.length) return new Uint8Array(mask);
    const next = new Uint8Array(mask);
    points.forEach((point, i) =>
      strokeInto(
        next,
        width,
        height,
        points[Math.max(0, i - 1)],
        point,
        radius,
        erase,
      ),
    );
    return next;
  }
  /* Rebuild from the untouched photo and named walls. Erasing a wall or changing
   * a shade therefore restores the correct underlying image without colour buildup.
   */
  function composeImage(original, walls) {
    const count = size(original.width, original.height);
    if (original.data.length !== count * 4)
      throw Error("This photo could not be read.");
    if (!Array.isArray(walls) || walls.length > 8)
      throw Error("Keep up to eight walls in a photo.");
    let data = new Uint8ClampedArray(original.data);
    for (const wall of walls)
      data = paintImage(original, data, wall.mask, wall.hex);
    return { width: original.width, height: original.height, data };
  }

  /* Select a bounded wall first, then explicitly paint that selection. Sample
   * photos use known wall regions; uploads use the customer's own corner outline.
   */
  function createEditor({
    canvas,
    controls,
    toolbar = null,
    viewport = canvas.parentElement,
    shade,
    swatches = [],
    onSelectShade = () => {},
    onStatus = () => {},
    onChange = () => {},
    onBeforeSelect = () => {},
  }) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const stage = canvas.parentElement;
    const ownsToolbar = !toolbar;
    if (!toolbar) {
      toolbar = document.createElement("div");
      stage.before(toolbar);
    }
    const overlay = document.createElement("canvas"),
      oc = overlay.getContext("2d");
    overlay.className = "ap-selection";
    overlay.tabIndex = 0;
    overlay.hidden = true;
    overlay.setAttribute(
      "aria-label",
      "Select one wall. In your own photo, tap around its corners and finish the selection.",
    );
    overlay.setAttribute(
      "aria-keyshortcuts",
      "ArrowUp ArrowDown ArrowLeft ArrowRight Enter Escape Control+z Control+y",
    );
    stage.append(overlay);
    toolbar.classList.add("ap-toolbar");
    controls.classList.add("ap-tools");
    viewport.classList.add("ap-viewport");
    const icon = (path) =>
      `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    const brushIcon = icon(
      '<path d="m14 3 7 7-9 9-7-7zM5 12l-2 9 9-2M14 3l-4 4"/>',
    );
    const eraserIcon = icon(
      '<path d="m15 3 6 6-11 12H5l-3-4L15 3zM9 9l7 7M10 21h11"/>',
    );
    toolbar.innerHTML = `<div class="ap-select-heading"><p>2. Select one wall</p><span class="ap-selected-name" role="status">No wall selected</span></div>
      <div class="ap-wall-choices" role="group" aria-label="Select a wall"></div>
      <div class="ap-selection-actions"><button type="button" data-tool="outline">Outline my wall</button><div class="ap-outline-actions" hidden><button type="button" data-action="finish">Finish selection</button><button type="button" data-action="back">Undo corner</button><button type="button" data-action="cancel">Cancel</button><span class="ap-points"></span></div></div>
      <p class="ap-selection-help">Tap a wall in the sample photo, or select its name above.</p>
      <div class="ap-heading"><p>3. Choose a colour</p><div class="ap-shade"><i></i><div><strong></strong><span hidden></span></div></div></div>
      <div class="ap-colour-options"><div class="ap-quick-swatches" role="group" aria-label="Quick shades"></div><details class="ap-palette"><summary>More colours</summary><div class="ap-palette-panel"><label>Find a shade<input type="search" aria-label="Find a paint shade" placeholder="Name or colour code" autocomplete="off"></label><div class="ap-palette-results" role="group" aria-label="Paint shades"></div><p class="ap-palette-count" role="status"></p><button type="button" data-action="close-palette">Close colours</button></div></details></div>`;
    toolbar.insertAdjacentHTML(
      "beforeend",
      '<button type="button" class="ap-paint" data-action="paint">Paint selected wall</button>',
    );
    controls.innerHTML = `<div class="ap-footer"><div class="ap-history" role="group" aria-label="Paint history"><button type="button" data-action="undo" aria-label="Undo">↶ Undo</button><button type="button" data-action="compare" aria-pressed="false">Before / After</button></div><button type="button" data-action="save" class="ap-save">${icon('<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>')}Save image</button></div>
      <p class="ap-feedback" role="status"></p>
      <details class="ap-refine"><summary>Refine a wall <span>Optional</span></summary><div class="ap-refine-body">
        <p class="ap-refine-hint">Only needed if a wall edge needs correcting.</p>
        <div class="ap-main-tools" role="group" aria-label="Correction tools"><button type="button" data-tool="tap" aria-pressed="true">Select a wall</button><button type="button" data-tool="brush" aria-pressed="false">${brushIcon}Add paint</button><button type="button" data-tool="erase" aria-pressed="false">${eraserIcon}Remove paint</button><button type="button" data-tool="cutout" aria-pressed="false">Protect window / door</button></div>
        <div class="ap-settings"><label class="ap-brush-size" hidden>Brush size <input data-brush type="range" min="6" max="100" value="36" aria-label="Brush size"><output>36 px</output></label></div>
        <details class="ap-more"><summary>More tools</summary>
          <div class="ap-settings"><div class="ap-zoom" role="group" aria-label="Photo zoom"><button type="button" data-action="out" aria-label="Zoom out">−</button><button type="button" data-action="fit" aria-label="Fit photo">100%</button><button type="button" data-action="in" aria-label="Zoom in">+</button></div><button type="button" data-tool="pan" aria-pressed="false">Move photo</button><button type="button" data-action="redo" aria-label="Redo">↷ Redo</button><button type="button" data-action="reset">Reset photo</button><button type="button" data-action="original" hidden>Hold original</button></div>
          <div class="ap-wall-heading"><h4>Painted walls</h4><button type="button" data-action="add" aria-label="Add wall" class="ap-add">+ Add wall</button></div><div class="ap-walls" role="group" aria-label="Painted walls"></div><p class="ap-empty" hidden>Tap a wall in the photo to begin.</p><div class="ap-wall-edit" hidden><label>Wall name <input type="text" maxlength="32" aria-label="Wall name" placeholder="e.g. Front wall"></label><button type="button" data-action="delete">Remove wall</button></div>
        </details></div></details>
      <p class="ap-note">Save your image before leaving. Your photo stays on this device.</p>`;
    const normalizeSwatches = (values) =>
      Array.isArray(values)
        ? values
            .slice(0, 5000)
            .filter(
              (value) =>
                value &&
                typeof value.name === "string" &&
                /^#[0-9a-f]{6}$/i.test(value.hex),
            )
            .map((value) => ({
              hex: value.hex.toLowerCase(),
              name: value.name,
              code: typeof value.code === "string" ? value.code : "",
            }))
        : [];
    let palette = normalizeSwatches(swatches);
    let original = null,
      current = null,
      walls = [],
      regions = [],
      pendingWall = null,
      activeId = null,
      nextId = 1,
      history = [],
      future = [];
    let mode = "tap",
      points = [],
      cursor = null,
      zoom = 1,
      enabled = true,
      comparing = false,
      holding = false,
      destroyed = false,
      gesture = null,
      frame = 0,
      lastFrame = 0;
    const removers = [],
      objectUrls = new Map();
    const all = (selector) => [
      ...toolbar.querySelectorAll(selector),
      ...controls.querySelectorAll(selector),
    ];
    const find = (selector) =>
      toolbar.querySelector(selector) || controls.querySelector(selector);
    const byAction = (name) => all(`[data-action="${name}"]`)[0];
    const active = () => walls.find((wall) => wall.id === activeId);
    const selectedWall = () => pendingWall || active();
    const shadeValue = () => {
      const value = shade();
      return /^#[0-9a-f]{6}$/i.test(value.hex)
        ? {
            hex: value.hex.toLowerCase(),
            name: String(value.name || value.hex),
          }
        : { hex: "#a89ba9", name: "Soft neutral" };
    };
    const listen = (el, event, handler) => {
      el.addEventListener(event, handler);
      removers.push(() => el.removeEventListener(event, handler));
    };
    const report = (message) => {
      if (!destroyed) {
        controls.querySelector(".ap-feedback").textContent = message;
        onStatus(message);
      }
    };
    const snapshot = () => ({ walls: [...walls], activeId, pendingWall });
    const remember = () => {
      history.push(snapshot());
      if (history.length > 8) history.shift();
      future = [];
    };
    const state = () => ({
      canUndo: history.length > 0,
      canRedo: future.length > 0,
      colors: walls.map(({ hex, name }) => ({ hex, name })),
      walls: walls.map(({ id, label, hex, name }) => ({
        id,
        label,
        hex,
        name,
      })),
      activeId,
    });
    function notify() {
      onChange(state());
    }
    function renderPalette() {
      const quick = toolbar.querySelector(".ap-quick-swatches"),
        results = toolbar.querySelector(".ap-palette-results"),
        query = toolbar
          .querySelector('[aria-label="Find a paint shade"]')
          .value.trim()
          .toLowerCase();
      quick.replaceChildren();
      results.replaceChildren();
      const seen = new Set();
      const entries = palette.map((item, index) => ({ item, index }));
      const light = entries
        .filter(({ item }) => {
          const rgb = [1, 3, 5].map((i) =>
            parseInt(item.hex.slice(i, i + 2), 16),
          );
          return (
            Math.max(...rgb) - Math.min(...rgb) < 75 &&
            rgb.reduce((a, b) => a + b) / 3 > 175
          );
        })
        .slice(0, 3);
      const muted = entries
        .filter(({ item }) => {
          const rgb = [1, 3, 5].map((i) =>
            parseInt(item.hex.slice(i, i + 2), 16),
          );
          const mean = rgb.reduce((a, b) => a + b) / 3;
          return (
            Math.max(...rgb) - Math.min(...rgb) < 100 &&
            mean >= 85 &&
            mean <= 175
          );
        })
        .slice(0, 2);
      [...light, ...muted, ...entries].forEach(({ item, index }) => {
        if (seen.has(item.hex) || seen.size >= 5) return;
        seen.add(item.hex);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ap-swatch";
        button.dataset.shadeIndex = String(index);
        button.style.background = item.hex;
        button.title = item.name + (item.code ? " (" + item.code + ")" : "");
        button.setAttribute("aria-label", "Try " + button.title);
        button.setAttribute(
          "aria-pressed",
          String(item.hex === shadeValue().hex),
        );
        quick.append(button);
      });
      const matched = palette
        .map((item, index) => ({ item, index }))
        .filter(({ item }) =>
          (item.name + " " + item.code + " " + item.hex)
            .toLowerCase()
            .includes(query),
        );
      matched.slice(0, 48).forEach(({ item, index }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.shadeIndex = String(index);
        button.setAttribute(
          "aria-label",
          "Use " + item.name + (item.code ? " (" + item.code + ")" : ""),
        );
        button.setAttribute(
          "aria-pressed",
          String(item.hex === shadeValue().hex),
        );
        const chip = document.createElement("i");
        chip.style.background = item.hex;
        const text = document.createElement("span");
        text.textContent = item.name;
        const code = document.createElement("small");
        code.textContent = item.code || item.hex;
        button.append(chip, text, code);
        results.append(button);
      });
      toolbar.querySelector(".ap-palette-count").textContent = matched.length
        ? `${matched.length} shades${matched.length > 48 ? " · refine your search to see more" : ""}`
        : "No shades found. Try a different name or code.";
    }
    function updateShadeChip() {
      const chosen = shadeValue(),
        chip = toolbar.querySelector(".ap-shade");
      chip.querySelector("i").style.background = chosen.hex;
      chip.querySelector("strong").textContent = chosen.name;
      chip.querySelector("span").textContent = chosen.hex.toUpperCase();
      toolbar
        .querySelectorAll("[data-shade-index]")
        .forEach((button) =>
          button.setAttribute(
            "aria-pressed",
            String(palette[+button.dataset.shadeIndex]?.hex === chosen.hex),
          ),
        );
    }
    function refresh() {
      const ready = !!original && enabled,
        wall = active(),
        selection = selectedWall();
      all("button").forEach((button) => (button.disabled = !ready));
      all("[data-tool]").forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.tool === mode),
        ),
      );
      all('[data-tool="brush"], [data-tool="erase"]').forEach(
        (button) => (button.disabled = !ready || !wall),
      );
      find('[data-tool="cutout"]').disabled = !ready || !selection;
      byAction("finish").disabled = !ready || points.length < 3;
      byAction("finish").textContent =
        mode === "cutout" ? "Protect opening" : "Finish selection";
      byAction("back").disabled = !ready || !points.length;
      byAction("cancel").disabled = !ready || !points.length;
      byAction("undo").disabled = !ready || !history.length;
      byAction("redo").disabled = !ready || !future.length;
      byAction("reset").disabled =
        !ready || (!walls.length && !points.length && !pendingWall);
      byAction("add").disabled = !ready || walls.length >= 8;
      byAction("save").disabled = !ready || !walls.length;
      byAction("compare").disabled = !ready || !walls.length;
      byAction("paint").disabled =
        !ready ||
        !selection ||
        points.length > 0 ||
        ["outline", "cutout"].includes(mode);
      byAction("compare").setAttribute("aria-pressed", String(holding));
      byAction("compare").textContent = holding
        ? "Show painted"
        : "Before / After";
      byAction("in").disabled = !ready || zoom >= 3;
      byAction("out").disabled = !ready || zoom <= 1;
      byAction("fit").textContent = Math.round(zoom * 100) + "%";
      find(".ap-brush-size").hidden = !["brush", "erase"].includes(mode);
      find(".ap-outline-actions").hidden = !["outline", "cutout"].includes(
        mode,
      );
      find(".ap-selected-name").textContent = selection
        ? `${selection.label} selected`
        : "No wall selected";
      find(".ap-selection-help").textContent = ["outline", "cutout"].includes(
        mode,
      )
        ? mode === "cutout"
          ? "Tap around a window or door, then Protect opening."
          : `Tap around ONE wall, then Finish selection. ${points.length ? points.length + " corners added." : "Start at a corner."}`
        : selection
          ? "Only the outlined wall will be painted. Choose a colour, then Paint selected wall."
          : regions.length
            ? "Tap a wall in the sample photo, or select its name above."
            : "Use Outline my wall to select one surface in your photo.";
      const choices = find(".ap-wall-choices"),
        focusedChoice = choices.contains(document.activeElement)
          ? document.activeElement.dataset.region ||
            document.activeElement.dataset.wall
          : null;
      choices.replaceChildren();
      for (const region of regions) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.region = region.regionKey;
        button.textContent = region.label;
        button.disabled = !ready;
        button.setAttribute(
          "aria-pressed",
          String(selection?.regionKey === region.regionKey),
        );
        choices.append(button);
      }
      for (const item of walls.filter((wall) => !wall.regionKey)) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.wall = String(item.id);
        button.textContent = item.label;
        button.disabled = !ready;
        button.setAttribute("aria-pressed", String(item.id === activeId));
        choices.append(button);
      }
      if (focusedChoice)
        [...choices.children]
          .find(
            (button) =>
              (button.dataset.region || button.dataset.wall) === focusedChoice,
          )
          ?.focus({ preventScroll: true });
      find(".ap-points").textContent = points.length
        ? `${points.length} corners`
        : "";
      controls.querySelector(".ap-empty").hidden = walls.length > 0;
      controls.querySelector(".ap-wall-edit").hidden = !wall;
      const input = controls.querySelector('[aria-label="Wall name"]');
      input.disabled = !ready || !wall;
      if (document.activeElement !== input) input.value = wall?.label || "";
      const list = controls.querySelector(".ap-walls");
      const focusedWall = list.contains(document.activeElement)
        ? document.activeElement.dataset.wall
        : null;
      list.replaceChildren();
      [...walls]
        .sort((a, b) => a.number - b.number)
        .forEach((item) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.wall = String(item.id);
          button.disabled = !ready;
          button.setAttribute("aria-pressed", String(item.id === activeId));
          const swatch = document.createElement("i");
          swatch.style.background = item.hex;
          const text = document.createElement("span");
          text.textContent = item.label;
          button.append(swatch, text);
          list.append(button);
        });
      if (focusedWall)
        list
          .querySelector(`[data-wall="${focusedWall}"]`)
          ?.focus({ preventScroll: true });
      stage.style.width =
        zoom === 1 ? "min(100%, var(--ap-fit-width, 100%))" : `${zoom * 100}%`;
      stage.style.marginInline = zoom === 1 ? "auto" : "0";
      stage.style.maxWidth = "none";
      overlay.hidden = !ready;
      overlay.style.touchAction = ["brush", "erase", "pan"].includes(mode)
        ? "none"
        : "manipulation";
      overlay.dataset.mode = mode;
      updateShadeChip();
      draw();
    }
    function begin() {
      const wasOriginal = holding;
      holding = false;
      comparing = false;
      onBeforeSelect();
      if (wasOriginal && current)
        context.putImageData(
          new ImageData(current.data, current.width, current.height),
          0,
          0,
        );
    }
    function draw() {
      oc.clearRect(0, 0, overlay.width, overlay.height);
      if (!original || comparing || holding) return;
      const scale =
          overlay.width / Math.max(1, overlay.getBoundingClientRect().width),
        wall = selectedWall();
      if (wall && !gesture && !points.length) {
        const edge = oc.createImageData(overlay.width, overlay.height),
          w = overlay.width,
          mask = wall.mask;
        for (let p = 0; p < mask.length; p++) {
          if (pendingWall && mask[p]) {
            edge.data[p * 4] = 111;
            edge.data[p * 4 + 1] = 68;
            edge.data[p * 4 + 2] = 153;
            edge.data[p * 4 + 3] = Math.round(mask[p] * 0.18);
          }
          if (
            mask[p] &&
            (p < w ||
              p >= mask.length - w ||
              p % w === 0 ||
              p % w === w - 1 ||
              !mask[p - 1] ||
              !mask[p + 1] ||
              !mask[p - w] ||
              !mask[p + w])
          ) {
            const i = p * 4;
            edge.data[i] = 115;
            edge.data[i + 1] = 54;
            edge.data[i + 2] = 161;
            edge.data[i + 3] = 255;
          }
        }
        oc.putImageData(edge, 0, 0);
      }
      oc.lineWidth = Math.max(1, 2 * scale);
      oc.strokeStyle =
        mode === "erase" || mode === "cutout" ? "#e36948" : "#703995";
      oc.fillStyle = "#fff";
      if (points.length) {
        oc.beginPath();
        points.forEach(([x, y], i) => (i ? oc.lineTo(x, y) : oc.moveTo(x, y)));
        oc.stroke();
        points.forEach(([x, y], i) => {
          oc.beginPath();
          oc.arc(x, y, 4 * scale, 0, Math.PI * 2);
          oc.fill();
          oc.stroke();
          oc.font = `bold ${12 * scale}px Arial`;
          oc.fillStyle = "#32104c";
          oc.fillText(String(i + 1), x + 7 * scale, y - 5 * scale);
          oc.fillStyle = "#fff";
        });
      }
      if (cursor && ["brush", "erase"].includes(mode)) {
        const radius = (+find("[data-brush]").value * scale) / 2;
        oc.lineWidth = 3 * scale;
        oc.strokeStyle = "#fff";
        oc.beginPath();
        oc.arc(...cursor, radius, 0, Math.PI * 2);
        oc.stroke();
        oc.lineWidth = 1.3 * scale;
        oc.strokeStyle = mode === "erase" ? "#b83e29" : "#542474";
        oc.stroke();
      } else if (cursor && mode !== "tap") {
        oc.beginPath();
        oc.moveTo(cursor[0] - 7 * scale, cursor[1]);
        oc.lineTo(cursor[0] + 7 * scale, cursor[1]);
        oc.moveTo(cursor[0], cursor[1] - 7 * scale);
        oc.lineTo(cursor[0], cursor[1] + 7 * scale);
        oc.stroke();
      }
    }
    function render() {
      if (!original) return;
      current = composeImage(original, walls);
      context.putImageData(
        new ImageData(current.data, current.width, current.height),
        0,
        0,
      );
      draw();
    }
    function syncShade() {
      const wall = active();
      if (wall) onSelectShade({ hex: wall.hex, name: wall.name });
    }
    function makeWall(mask, existing = active()) {
      const chosen = shadeValue();
      return existing
        ? { ...existing, mask, hex: chosen.hex, name: chosen.name }
        : {
            id: nextId,
            number: nextId++,
            label: pendingWall?.label || `Wall ${nextId - 1}`,
            regionKey: pendingWall?.regionKey || null,
            mask,
            hex: chosen.hex,
            name: chosen.name,
          };
    }
    function commitMask(mask, message) {
      if (!original) return;
      if (!mask.some((value) => value >= 128)) {
        if (active()) {
          remember();
          walls = walls.filter((wall) => wall.id !== activeId);
          activeId = walls.at(-1)?.id ?? null;
          pendingWall = null;
          points = [];
          if (!activeId) mode = "tap";
          render();
          syncShade();
          refresh();
          notify();
        }
        return report("Paint removed from this wall. Undo restores it.");
      }
      if (!active() && walls.length >= 8)
        return report(
          "You can paint eight walls in one photo. Choose an existing wall to edit it.",
        );
      const previous = active(),
        chosen = shadeValue();
      if (
        previous &&
        previous.hex === chosen.hex &&
        mask.every((value, index) => value === previous.mask[index])
      ) {
        points = [];
        context.putImageData(
          new ImageData(current.data, current.width, current.height),
          0,
          0,
        );
        refresh();
        return report("This part of the wall is already up to date.");
      }
      remember();
      const wall = makeWall(mask);
      walls = [...walls.filter((item) => item.id !== wall.id), wall];
      activeId = wall.id;
      pendingWall = null;
      points = [];
      render();
      refresh();
      notify();
      report(
        message ||
          "Selected wall painted. Choose another colour and Paint selected wall to try it.",
      );
    }
    function finishOutline() {
      if (!original || points.length < 3) return;
      try {
        const shape = polygonMask(original.width, original.height, points);
        const wall = selectedWall();
        if (mode === "cutout" && wall) {
          if (pendingWall) {
            pendingWall = {
              ...pendingWall,
              mask: subtractMask(pendingWall.mask, shape),
            };
            points = [];
            report(
              "Opening protected. Choose a colour and Paint selected wall.",
            );
          } else
            commitMask(
              subtractMask(wall.mask, shape),
              "Opening protected. Paint stays outside the opening.",
            );
          mode = "tap";
          refresh();
        } else
          selectWall({ mask: shape, label: `Wall ${nextId}`, regionKey: null });
      } catch (error) {
        report(error.message);
      }
    }
    /* Selecting a surface never paints it. Paint always uses this fixed mask,
     * rather than recomputing a flood fill through other same-colour walls.
     */
    function selectWall(region, wall = null) {
      cancelGesture();
      begin();
      activeId = wall?.id ?? null;
      pendingWall = wall ? null : region;
      points = [];
      mode = "tap";
      refresh();
      notify();
      report(
        `${selectedWall().label} selected. Choose a colour, then Paint selected wall.`,
      );
    }
    function tapPoint(x, y) {
      if (!enabled || !original) return;
      begin();
      if (mode === "tap") {
        const position =
          clamp(Math.floor(y), 0, original.height - 1) * original.width +
          clamp(Math.floor(x), 0, original.width - 1);
        const existing = [...walls]
          .reverse()
          .find((wall) => wall.mask[position] > 127);
        if (existing) {
          selectWall(null, existing);
          return;
        }
        const region = regions.find((region) => region.mask[position] > 127);
        if (region) {
          selectWall(
            region,
            walls.find((wall) => wall.regionKey === region.regionKey),
          );
          return;
        }
        if (regions.length)
          return report(
            "Choose a wall button above, or use Outline my wall for a different surface.",
          );
        activeId = null;
        pendingWall = null;
        mode = "outline";
        tapPoint(x, y);
      } else if (mode === "outline" || mode === "cutout") {
        if (points.length >= MAX_POINTS)
          return report("Close this outline before adding more corners.");
        const scale =
          overlay.width / Math.max(1, overlay.getBoundingClientRect().width);
        if (
          points.length >= 3 &&
          Math.hypot(x - points[0][0], y - points[0][1]) < 9 * scale
        ) {
          finishOutline();
          return;
        }
        if (
          !points.length ||
          Math.hypot(x - points.at(-1)[0], y - points.at(-1)[1]) > 1
        )
          points.push([
            clamp(x, 0, original.width),
            clamp(y, 0, original.height),
          ]);
        refresh();
        report(
          mode === "cutout"
            ? "Tap around the opening, then Protect opening to keep it unpainted."
            : "Tap around just this wall, then Finish selection. Nothing is painted until you confirm.",
        );
      }
    }
    function cancelGesture() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      const previous = gesture;
      gesture = null;
      if (previous && overlay.hasPointerCapture?.(previous.id))
        overlay.releasePointerCapture(previous.id);
      if (current && !holding)
        context.putImageData(
          new ImageData(current.data, current.width, current.height),
          0,
          0,
        );
      draw();
    }
    function renderWorking() {
      frame = 0;
      if (!gesture?.mask || !original) return;
      const data = paintImage(
        original,
        gesture.underlay.data,
        gesture.mask,
        gesture.hex,
      );
      context.putImageData(
        new ImageData(data, original.width, original.height),
        0,
        0,
      );
      lastFrame = performance.now();
      draw();
    }
    function queueWorking() {
      if (!frame && performance.now() - lastFrame > 35)
        frame = requestAnimationFrame(renderWorking);
    }
    function imagePoint(event) {
      const rect = overlay.getBoundingClientRect();
      return [
        ((event.clientX - rect.left) * overlay.width) / rect.width,
        ((event.clientY - rect.top) * overlay.height) / rect.height,
      ];
    }
    function changeZoom(value) {
      if (!original) return;
      cancelGesture();
      const left =
          (viewport.scrollLeft + viewport.clientWidth / 2) /
          (stage.scrollWidth || 1),
        top =
          (viewport.scrollTop + viewport.clientHeight / 2) /
          (stage.scrollHeight || 1);
      zoom = clamp(value, 1, 3);
      refresh();
      if (zoom === 1) {
        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;
      } else {
        viewport.scrollLeft =
          left * stage.scrollWidth - viewport.clientWidth / 2;
        viewport.scrollTop =
          top * stage.scrollHeight - viewport.clientHeight / 2;
      }
      report(
        zoom === 1
          ? "Photo fits the workspace."
          : `${Math.round(zoom * 100)}% zoom. Choose Move photo to reach another part of the wall.`,
      );
    }
    function doAction(event) {
      const button = event.target.closest("button");
      if (!button || button.disabled || !original || !enabled) return;
      if (button.dataset.shadeIndex !== undefined) {
        const item = palette[+button.dataset.shadeIndex];
        if (item)
          onSelectShade({
            hex: item.hex,
            name: item.name + (item.code ? " (" + item.code + ")" : ""),
          });
        toolbar.querySelector(".ap-palette").open = false;
        return;
      }
      if (button.dataset.wall) {
        const wall = walls.find(
          (wall) => wall.id === Number(button.dataset.wall),
        );
        if (wall) selectWall(null, wall);
        return;
      }
      if (button.dataset.region) {
        const region = regions.find(
          (region) => region.regionKey === button.dataset.region,
        );
        if (region)
          selectWall(
            region,
            walls.find((wall) => wall.regionKey === region.regionKey),
          );
        return;
      }
      if (button.dataset.tool) {
        cancelGesture();
        mode = button.dataset.tool;
        if (mode === "outline") {
          activeId = null;
          pendingWall = null;
        }
        points = [];
        cursor = null;
        begin();
        refresh();
        report(
          {
            brush:
              "Drag over the selected wall to adjust its paint. Use Paint selected wall after choosing a new shade.",
            erase:
              "Drag over windows, doors or furniture to restore the photo there.",
            tap: "Select one wall, then choose a colour and Paint selected wall.",
            pan: "Drag the photo to move around. Use zoom for small details.",
            outline:
              "Tap around ONE wall, then Finish selection. You can add more than four corners.",
            cutout: "Tap around a window or door, then Protect opening.",
          }[mode],
        );
        return;
      }
      switch (button.dataset.action) {
        case "paint": {
          const selection = selectedWall();
          if (!selection || points.length) break;
          cancelGesture();
          begin();
          commitMask(
            selection.mask,
            `${selection.label} painted. Other walls keep their colours.`,
          );
          mode = "tap";
          refresh();
          break;
        }
        case "close-palette":
          toolbar.querySelector(".ap-palette").open = false;
          toolbar.querySelector(".ap-palette summary").focus();
          break;
        case "finish":
          finishOutline();
          break;
        case "back":
          points.pop();
          refresh();
          break;
        case "cancel":
          points = [];
          mode = "tap";
          refresh();
          report("Outline cancelled. Your painted walls are unchanged.");
          break;
        case "add":
          cancelGesture();
          activeId = null;
          pendingWall = null;
          points = [];
          mode = "outline";
          refresh();
          notify();
          report(
            "Outline another wall. Its colour will stay separate from the walls already painted.",
          );
          break;
        case "delete":
          if (active()) {
            remember();
            walls = walls.filter((wall) => wall.id !== activeId);
            activeId = walls.at(-1)?.id ?? null;
            pendingWall = null;
            render();
            syncShade();
            refresh();
            notify();
            report(
              "Wall removed. The original photo is restored wherever it was the only paint.",
            );
          }
          break;
        case "undo":
          api.undo();
          break;
        case "redo":
          api.redo();
          break;
        case "reset":
          api.reset();
          break;
        case "in":
          changeZoom(zoom + 0.5);
          break;
        case "out":
          changeZoom(zoom - 0.5);
          break;
        case "fit":
          changeZoom(1);
          break;
        case "compare":
          showOriginal(!holding);
          refresh();
          break;
        case "save":
          savePreview();
          break;
      }
    }
    listen(toolbar, "click", doAction);
    if (controls !== toolbar) listen(controls, "click", doAction);
    listen(find("[data-brush]"), "input", (event) => {
      find(".ap-brush-size output").textContent = event.target.value + " px";
      draw();
    });
    listen(
      toolbar.querySelector('[aria-label="Find a paint shade"]'),
      "input",
      renderPalette,
    );
    listen(toolbar.querySelector(".ap-palette"), "keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        toolbar.querySelector(".ap-palette").open = false;
        toolbar.querySelector(".ap-palette summary").focus();
      }
    });
    listen(document, "pointerdown", (event) => {
      const picker = toolbar.querySelector(".ap-palette");
      if (
        picker.open &&
        !picker.contains(event.target) &&
        !overlay.contains(event.target)
      )
        picker.open = false;
    });
    listen(controls.querySelector(".ap-refine"), "toggle", () => {
      if (
        !controls.querySelector(".ap-refine").open &&
        ["brush", "erase", "pan", "cutout"].includes(mode)
      ) {
        cancelGesture();
        mode = "tap";
        points = [];
        cursor = null;
        changeZoom(1);
        refresh();
        report("Select one wall, choose a colour, then Paint selected wall.");
      }
    });
    const nameInput = controls.querySelector('[aria-label="Wall name"]');
    listen(nameInput, "change", () => {
      const wall = active(),
        label = nameInput.value.trim().slice(0, 32);
      if (wall && label && label !== wall.label) {
        remember();
        walls = walls.map((item) =>
          item.id === wall.id ? { ...item, label } : item,
        );
        refresh();
        notify();
      }
    });
    listen(nameInput, "keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        nameInput.blur();
      }
    });
    listen(overlay, "pointerdown", (event) => {
      if (toolbar.querySelector(".ap-palette").open) {
        toolbar.querySelector(".ap-palette").open = false;
        return;
      }
      if (!event.isPrimary) {
        cancelGesture();
        return;
      }
      if (event.button !== 0 || !original || !enabled) return;
      if (["brush", "erase"].includes(mode) && !active() && walls.length >= 8)
        return report("Select an existing wall to continue painting.");
      begin();
      const point = imagePoint(event);
      cursor = point;
      if (["brush", "erase"].includes(mode)) {
        if (mode === "erase" && !active()) return;
        event.preventDefault();
        const wall = active();
        gesture = {
          id: event.pointerId,
          start: point,
          last: point,
          mask: new Uint8Array(wall?.mask || original.width * original.height),
          underlay: composeImage(
            original,
            walls.filter((item) => item.id !== activeId),
          ),
          hex: shadeValue().hex,
          radius:
            (+find("[data-brush]").value * original.width) /
            Math.max(1, overlay.getBoundingClientRect().width) /
            2,
          erase: mode === "erase",
          changed: false,
        };
        strokeInto(
          gesture.mask,
          original.width,
          original.height,
          point,
          point,
          gesture.radius,
          gesture.erase,
        );
        gesture.changed = true;
        overlay.setPointerCapture(event.pointerId);
        renderWorking();
      } else if (mode === "pan") {
        event.preventDefault();
        gesture = {
          id: event.pointerId,
          startClient: [event.clientX, event.clientY],
          scroll: [viewport.scrollLeft, viewport.scrollTop],
        };
        overlay.setPointerCapture(event.pointerId);
      } else
        gesture = {
          id: event.pointerId,
          startClient: [event.clientX, event.clientY],
          start: point,
        };
      draw();
    });
    listen(overlay, "pointermove", (event) => {
      if (!original || !enabled) return;
      const point = imagePoint(event);
      cursor = point;
      if (gesture?.id === event.pointerId && gesture.mask) {
        strokeInto(
          gesture.mask,
          original.width,
          original.height,
          gesture.last,
          point,
          gesture.radius,
          gesture.erase,
        );
        gesture.last = point;
        queueWorking();
      } else if (gesture?.id === event.pointerId && mode === "pan") {
        viewport.scrollLeft =
          gesture.scroll[0] + gesture.startClient[0] - event.clientX;
        viewport.scrollTop =
          gesture.scroll[1] + gesture.startClient[1] - event.clientY;
      }
      draw();
    });
    listen(overlay, "pointerup", (event) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const saved = gesture,
        point = imagePoint(event);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      gesture = null;
      if (overlay.hasPointerCapture?.(event.pointerId))
        overlay.releasePointerCapture(event.pointerId);
      if (saved.mask) {
        strokeInto(
          saved.mask,
          original.width,
          original.height,
          saved.last,
          point,
          saved.radius,
          saved.erase,
        );
        if (saved.mask.some((value) => value >= 128))
          commitMask(
            saved.mask,
            saved.erase
              ? "Paint removed from that part of the wall. Try a smaller eraser for fine edges."
              : "Wall adjusted. Choose a shade and Paint selected wall to recolour it.",
          );
        else if (active()) {
          remember();
          walls = walls.filter((item) => item.id !== activeId);
          activeId = null;
          render();
          refresh();
          notify();
          report("Paint removed from this wall.");
        }
      } else if (
        mode !== "pan" &&
        Math.hypot(
          event.clientX - saved.startClient[0],
          event.clientY - saved.startClient[1],
        ) <= 8
      )
        tapPoint(...point);
      if (event.pointerType === "touch") cursor = null;
      draw();
    });
    listen(overlay, "pointercancel", cancelGesture);
    listen(overlay, "lostpointercapture", () => {
      if (gesture) cancelGesture();
    });
    listen(overlay, "pointerleave", () => {
      if (!gesture) {
        cursor = null;
        draw();
      }
    });
    listen(overlay, "keydown", (event) => {
      if (!enabled || !original) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? api.redo() : api.undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        api.redo();
        return;
      }
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
        const from = [...cursor],
          step = event.shiftKey ? 20 : 2;
        cursor = [
          clamp(cursor[0] + delta[0] * step, 0, overlay.width),
          clamp(cursor[1] + delta[1] * step, 0, overlay.height),
        ];
        if (event.altKey && ["brush", "erase"].includes(mode)) {
          const mask = brushMask(
            original.width,
            original.height,
            active()?.mask || new Uint8Array(original.width * original.height),
            [from, cursor],
            (+find("[data-brush]").value * original.width) /
              Math.max(1, overlay.getBoundingClientRect().width) /
              2,
            mode === "erase",
          );
          commitMask(mask);
        }
        draw();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        cursor ||= [overlay.width / 2, overlay.height / 2];
        if (["brush", "erase"].includes(mode)) {
          const mask = brushMask(
            original.width,
            original.height,
            active()?.mask || new Uint8Array(original.width * original.height),
            [cursor],
            (+find("[data-brush]").value * original.width) /
              Math.max(1, overlay.getBoundingClientRect().width) /
              2,
            mode === "erase",
          );
          commitMask(mask);
        } else tapPoint(...cursor);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        points.pop();
        refresh();
      } else if (event.key === "Escape") {
        cancelGesture();
        points = [];
        cursor = null;
        refresh();
        report("Outline cancelled.");
      }
    });
    function showOriginal(value) {
      if (!original || !enabled) return;
      if (value) {
        cancelGesture();
        begin();
        holding = true;
        context.putImageData(
          new ImageData(original.data, original.width, original.height),
          0,
          0,
        );
      } else {
        holding = false;
        if (current)
          context.putImageData(
            new ImageData(current.data, current.width, current.height),
            0,
            0,
          );
      }
      draw();
    }
    const originalButton = byAction("original");
    listen(originalButton, "pointerdown", (event) => {
      event.preventDefault();
      originalButton.setPointerCapture(event.pointerId);
      showOriginal(true);
    });
    for (const name of [
      "pointerup",
      "pointercancel",
      "lostpointercapture",
      "blur",
    ])
      listen(originalButton, name, () => showOriginal(false));
    listen(originalButton, "keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showOriginal(true);
      }
    });
    listen(originalButton, "keyup", () => showOriginal(false));
    function savePreview() {
      if (!current || !walls.length) return;
      const target = document.createElement("canvas");
      target.width = current.width;
      target.height = current.height;
      target
        .getContext("2d")
        .putImageData(
          new ImageData(current.data, current.width, current.height),
          0,
          0,
        );
      target.toBlob((blob) => {
        if (!blob || destroyed) return;
        const url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = "Areva-Paints-My-Home.png";
        document.body.append(a);
        a.click();
        a.remove();
        const timer = setTimeout(() => {
          URL.revokeObjectURL(url);
          objectUrls.delete(url);
        }, 1500);
        objectUrls.set(url, timer);
        report("Your painted home preview is ready to save.");
      }, "image/png");
    }
    const api = {
      setImage(image, { roomId = null } = {}) {
        const count = size(image.width, image.height);
        if (image.data.length !== count * 4)
          throw Error("This photo could not be read.");
        cancelGesture();
        original = {
          width: image.width,
          height: image.height,
          data: new Uint8ClampedArray(image.data),
        };
        stage.style.setProperty(
          "--ap-fit-width",
          `${(image.width / image.height) * 60}dvh`,
        );
        controls.querySelector(".ap-refine").open = false;
        overlay.width = image.width;
        overlay.height = image.height;
        enabled = true;
        toolbar.hidden = controls.hidden = false;
        walls = [];
        regions = presetWallRegions(image.width, image.height, roomId);
        pendingWall = null;
        activeId = null;
        nextId = 1;
        history = [];
        future = [];
        points = [];
        mode = regions.length ? "tap" : "outline";
        holding = comparing = false;
        zoom = 1;
        cursor = null;
        viewport.scrollLeft = viewport.scrollTop = 0;
        render();
        refresh();
        notify();
        report(
          regions.length
            ? "Choose one wall in the sample photo, then choose a colour and Paint selected wall."
            : "Your photo is ready. Tap the corners around ONE wall, then Finish selection.",
        );
      },
      reset() {
        if (!original || !enabled) return;
        cancelGesture();
        if (walls.length) {
          remember();
          walls = [];
          activeId = null;
        }
        points = [];
        pendingWall = null;
        cursor = null;
        mode = regions.length ? "tap" : "outline";
        begin();
        render();
        refresh();
        notify();
        report("Original photo restored. Undo brings your walls back.");
      },
      undo() {
        if (!original || !enabled || !history.length) return;
        cancelGesture();
        future.push(snapshot());
        const saved = history.pop();
        walls = saved.walls;
        activeId = saved.activeId;
        pendingWall = saved.pendingWall;
        points = [];
        mode = selectedWall() || regions.length ? "tap" : "outline";
        begin();
        render();
        syncShade();
        refresh();
        notify();
        report("Last change undone.");
      },
      redo() {
        if (!original || !enabled || !future.length) return;
        cancelGesture();
        history.push(snapshot());
        const saved = future.pop();
        walls = saved.walls;
        activeId = saved.activeId;
        pendingWall = saved.pendingWall;
        points = [];
        mode = selectedWall() || regions.length ? "tap" : "outline";
        begin();
        render();
        syncShade();
        refresh();
        notify();
        report("Change restored.");
      },
      setEnabled(value) {
        cancelGesture();
        enabled = value;
        toolbar.hidden = controls.hidden = !value;
        refresh();
      },
      setComparison(value) {
        if (value) cancelGesture();
        comparing = value;
        draw();
      },
      setSwatches(values) {
        palette = normalizeSwatches(values);
        renderPalette();
        updateShadeChip();
      },
      shadeChanged() {
        updateShadeChip();
        if (!original || !enabled) return;
        report(
          selectedWall()
            ? `${shadeValue().name} chosen. Press Paint selected wall to apply it only here.`
            : "Colour chosen. Select one wall before painting.",
        );
      },
      destroy() {
        cancelGesture();
        destroyed = true;
        removers.forEach((remove) => remove());
        objectUrls.forEach((timer, url) => {
          clearTimeout(timer);
          URL.revokeObjectURL(url);
        });
        objectUrls.clear();
        overlay.remove();
        toolbar.replaceChildren();
        controls.replaceChildren();
        if (ownsToolbar) toolbar.remove();
        stage.style.width = "";
        stage.style.maxWidth = "";
        stage.style.marginInline = "";
        stage.style.removeProperty("--ap-fit-width");
        original = current = null;
        walls = [];
        regions = [];
        pendingWall = null;
        history = [];
        future = [];
      },
    };
    renderPalette();
    refresh();
    return api;
  }
  globalThis.ArevaPaintStudio = Object.freeze({
    version: 4,
    polygonMask,
    subtractMask,
    connectedMask,
    paintImage,
    validPolygon,
    brushMask,
    composeImage,
    presetWallRegions,
    createEditor,
  });
})();
