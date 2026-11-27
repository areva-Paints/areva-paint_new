/* Shared photo painter for the public HTML and React studios. This dependency-free
 * browser asset also exposes its pure geometry/colour functions to regression tests.
 * Photos and masks stay in browser memory; the worker loads bundled model assets.
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

  /* A drag makes a wall-sized box; corner handles turn it into a perspective
   * quadrilateral. All coordinates stay in the photo, independent of zoom.
   */
  function boxCorners(width, height, from, to) {
    size(width, height);
    if (![...from, ...to].every(Number.isFinite))
      throw Error("Drag inside the photo.");
    const left = clamp(Math.min(from[0], to[0]), 0, width),
      right = clamp(Math.max(from[0], to[0]), 0, width),
      top = clamp(Math.min(from[1], to[1]), 0, height),
      bottom = clamp(Math.max(from[1], to[1]), 0, height);
    if (right - left < 2 || bottom - top < 2)
      throw Error("Drag across the area you want to paint.");
    return [
      [left, top],
      [right, top],
      [right, bottom],
      [left, bottom],
    ];
  }
  function moveAreaCorner(width, height, corners, index, point) {
    size(width, height);
    if (
      corners.length !== 4 ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > 3 ||
      !point.every(Number.isFinite)
    )
      throw Error("Choose a corner of the selected area.");
    const next = corners.map((p) => [...p]);
    next[index] = [clamp(point[0], 0, width), clamp(point[1], 0, height)];
    if (!validPolygon(next))
      throw Error(
        "Keep the corner handles around the same surface without crossing them.",
      );
    return next;
  }

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
  /* Brush coverage is always intersected with a selected wall, including its
   * opening cutouts. Other known walls are protected even if masks overlap.
   */
  function brushBoundary(width, height, selectedMask, protectedMasks = []) {
    const count = size(width, height);
    if (
      selectedMask.length !== count ||
      protectedMasks.some((m) => m.length !== count)
    )
      throw Error("Wall sizes do not match.");
    const mask = new Uint8Array(selectedMask);
    for (const other of protectedMasks)
      for (let p = 0; p < count; p++)
        if (other[p]) mask[p] = Math.min(mask[p], 255 - other[p]);
    return mask;
  }
  function constrainedBrushMask(width, height, boundary, mask, points, radius) {
    if (boundary.length !== size(width, height))
      throw Error("Wall sizes do not match.");
    const next = brushMask(width, height, mask, points, radius);
    for (let p = 0; p < next.length; p++)
      next[p] = Math.min(next[p], boundary[p]);
    return next;
  }
  /* Store just a stroke's bounding rectangle, rather than one full-photo mask
   * per stroke. Undo snapshots share immutable rectangles and unchanged walls.
   */
  function cropBrushMask(mask, width, height, bounds = [0, 0, width, height]) {
    if (mask.length !== size(width, height))
      throw Error("Brush sizes do not match.");
    const x0 = clamp(Math.floor(bounds[0]), 0, width),
      y0 = clamp(Math.floor(bounds[1]), 0, height),
      x1 = clamp(Math.ceil(bounds[2]), x0, width),
      y1 = clamp(Math.ceil(bounds[3]), y0, height);
    let left = x1,
      right = x0,
      top = y1,
      bottom = y0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        if (mask[y * width + x]) {
          left = Math.min(left, x);
          right = Math.max(right, x + 1);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y + 1);
        }
    if (left >= right || top >= bottom) return null;
    const data = new Uint8Array((right - left) * (bottom - top));
    for (let y = top; y < bottom; y++)
      data.set(
        mask.subarray(y * width + left, y * width + right),
        (y - top) * (right - left),
      );
    return { x: left, y: top, width: right - left, height: bottom - top, data };
  }
  const wallReferences = new WeakMap();
  function wallLightReference(original, mask) {
    let refs = wallReferences.get(original);
    if (!refs) {
      refs = new WeakMap();
      wallReferences.set(original, refs);
    }
    if (refs.has(mask)) return refs.get(mask);
    const histogram = new Uint32Array(256);
    let total = 0;
    for (let p = 0; p < mask.length; p++)
      if (mask[p] >= 128 && original.data[p * 4 + 3] >= 128) {
        histogram[Math.round(luminance(original.data, p * 4) * 255)]++;
        total++;
      }
    let level = 0,
      cumulative = 0;
    while (level < 255) {
      cumulative += histogram[level];
      if (cumulative >= total * 0.75) break;
      level++;
    }
    const reference = Math.max(0.015, level / 255);
    refs.set(mask, reference);
    return reference;
  }
  function writeBrushLayer(original, data, boundary, layer) {
    const count = size(original.width, original.height);
    if (
      boundary.length !== count ||
      data.length !== count * 4 ||
      original.data.length !== count * 4 ||
      ![layer.x, layer.y, layer.width, layer.height].every(Number.isInteger) ||
      layer.x < 0 ||
      layer.y < 0 ||
      layer.width < 1 ||
      layer.height < 1 ||
      layer.x + layer.width > original.width ||
      layer.y + layer.height > original.height ||
      layer.data.length !== layer.width * layer.height ||
      !/^#[0-9a-f]{6}$/i.test(layer.hex)
    )
      throw Error("This brush stroke could not be read.");
    const reference = wallLightReference(original, boundary),
      target = [1, 3, 5].map(
        (i) => linear[parseInt(layer.hex.slice(i, i + 2), 16)],
      ),
      source = original.data;
    for (let y = 0; y < layer.height; y++)
      for (let x = 0; x < layer.width; x++) {
        const p = (layer.y + y) * original.width + layer.x + x,
          alpha = Math.min(boundary[p], layer.data[y * layer.width + x]) / 255;
        if (!alpha || source[p * 4 + 3] < 128) continue;
        const i = p * 4,
          ratio = luminance(source, i) / reference,
          shadow = Math.min(1, Math.max(0.025, ratio) ** 0.85),
          highlight = clamp((ratio - 1) * 0.12, 0, 0.16);
        for (let k = 0; k < 3; k++)
          data[i + k] = encode(
            clamp(
              linear[data[i + k]] * (1 - alpha) +
                (target[k] * shadow * (1 - highlight) + highlight) * alpha,
              0,
              1,
            ),
          );
      }
  }
  function paintBrushLayer(original, current, boundary, layer) {
    const data = new Uint8ClampedArray(current);
    writeBrushLayer(original, data, boundary, layer);
    return data;
  }
  function eraseBrushLayers(width, height, layers, eraser, boundary) {
    const count = size(width, height);
    if (eraser.length !== count || boundary.length !== count)
      throw Error("Brush sizes do not match.");
    let any = false;
    const next = layers
      .map((layer) => {
        let data = null;
        for (let y = 0; y < layer.height; y++)
          for (let x = 0; x < layer.width; x++) {
            const p = (layer.y + y) * width + layer.x + x,
              j = y * layer.width + x,
              // Normalize to the wall's coverage so a full eraser pass also
              // clears soft boundary pixels, rather than leaving a faint rim.
              a = boundary[p]
                ? Math.min(eraser[p], boundary[p]) / boundary[p]
                : 0;
            if (a && layer.data[j]) {
              if (!data) data = new Uint8Array(layer.data);
              data[j] = Math.round(layer.data[j] * (1 - a));
            }
          }
        if (!data) return layer;
        any = true;
        return data.some(Boolean) ? { ...layer, data } : null;
      })
      .filter(Boolean);
    return any ? next : layers;
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

  /* Prepare an immutable white foundation, then replace pigment only on a
   * selected prepared surface. Before always refers to the untouched upload.
   */
  function whiteWallBase(original, surfaces) {
    const count = size(original.width, original.height);
    if (!Array.isArray(surfaces) || surfaces.length > 16)
      throw Error("Prepare up to sixteen wall surfaces.");
    const mask = new Uint8Array(count);
    for (const surface of surfaces) {
      if (surface.mask.length !== count)
        throw Error("Wall sizes do not match.");
      for (let p = 0; p < count; p++)
        mask[p] = Math.max(mask[p], surface.mask[p]);
    }
    return {
      width: original.width,
      height: original.height,
      data: paintImage(original, original.data, mask, "#ffffff"),
    };
  }
  function renderWhitePreview(base, surfaces) {
    let data = new Uint8ClampedArray(base.data);
    for (const surface of surfaces)
      if (surface.hex) data = paintImage(base, data, surface.mask, surface.hex);
    return { width: base.width, height: base.height, data };
  }
  /* Selection never edits pixels. A surface changes only after an explicit
   * primer or colour action; untouched surfaces retain the exact source pixels.
   * Every edit uses the immutable original lighting, so recolouring is stable.
   */
  function renderSelectedPreview(original, surfaces) {
    const count = size(original.width, original.height);
    if (original.data.length !== count * 4)
      throw Error("This photo could not be read.");
    if (!Array.isArray(surfaces) || surfaces.length > 16)
      throw Error("Keep up to sixteen wall surfaces.");
    let data = new Uint8ClampedArray(original.data);
    const operations = [];
    for (const surface of surfaces) {
      if (surface.mask.length !== original.width * original.height)
        throw Error("Wall sizes do not match.");
      if (surface.hex || surface.primed)
        operations.push({ surface, order: surface.order ?? operations.length });
      for (const brush of surface.brushes || [])
        operations.push({
          surface,
          brush,
          order: brush.order ?? operations.length,
        });
    }
    operations.sort((a, b) => a.order - b.order);
    for (const { surface, brush } of operations) {
      if (brush) writeBrushLayer(original, data, surface.mask, brush);
      else
        data = paintImage(
          original,
          data,
          surface.mask,
          surface.hex || "#ffffff",
        );
    }
    return { width: original.width, height: original.height, data };
  }
  /* Decode the model's padded 256px logits into original-photo coordinates.
   * Prefer its finest confident surface containing the customer's tap, and use
   * source edges/colour to keep openings and unrelated objects out of the wall.
   */
  /* Close single-pixel detection gaps and fill small enclosed pinholes, leaving
   * large openings intact. Source colour/edge protection is applied afterwards.
   */
  function cleanWallMask(mask, width, height) {
    size(width, height);
    let current = new Uint8Array(mask);
    for (const dilate of [true, false]) {
      const next = new Uint8Array(current.length);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          let value = dilate ? 0 : 255;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = clamp(x + dx, 0, width - 1),
                yy = clamp(y + dy, 0, height - 1);
              value = dilate
                ? Math.max(value, current[yy * width + xx])
                : Math.min(value, current[yy * width + xx]);
            }
          next[y * width + x] = value;
        }
      current = next;
    }
    const visited = new Uint8Array(current.length),
      queue = new Int32Array(current.length),
      limit = Math.max(24, current.filter((v) => v >= 128).length * 0.005);
    for (let seed = 0; seed < current.length; seed++) {
      if (current[seed] || visited[seed]) continue;
      let head = 0,
        tail = 1,
        border = false;
      queue[0] = seed;
      visited[seed] = 1;
      while (head < tail) {
        const p = queue[head++],
          x = p % width,
          y = Math.floor(p / width);
        if (!x || x === width - 1 || !y || y === height - 1) border = true;
        for (const n of [
          x ? p - 1 : -1,
          x < width - 1 ? p + 1 : -1,
          y ? p - width : -1,
          y < height - 1 ? p + width : -1,
        ])
          if (n >= 0 && !current[n] && !visited[n]) {
            visited[n] = 1;
            queue[tail++] = n;
          }
      }
      if (!border && tail <= limit)
        for (let i = 0; i < tail; i++) current[queue[i]] = 255;
    }
    return current;
  }
  /* Keep the seed's connected surface. Sustained vertical source edges separate
   * adjoining facade planes; short texture marks do not become wall boundaries.
   */
  function refineWallBoundary(original, mask, point) {
    const { width, height } = original,
      count = size(width, height),
      smooth = selectionImage(original);
    const hits = new Uint8Array(count),
      wide = new Uint8Array(count),
      barrier = new Uint8Array(count);
    const grey = (p) =>
      (smooth[p * 4] + smooth[p * 4 + 1] + smooth[p * 4 + 2]) / 3;
    for (let y = 2; y < height - 2; y++)
      for (let x = 2; x < width - 2; x++) {
        const p = y * width + x,
          gx = Math.abs(grey(p + 2) - grey(p - 2)),
          gy = Math.abs(grey(p + width * 2) - grey(p - width * 2));
        if (gx >= 5 && gx > gy * 1.5) hits[p] = 1;
      }
    for (let y = 0; y < height; y++)
      for (let x = 1; x < width - 1; x++)
        wide[y * width + x] = Math.max(
          hits[y * width + x - 1],
          hits[y * width + x],
          hits[y * width + x + 1],
        );
    const radius = Math.max(10, Math.round(height * 0.018)),
      span = radius * 2 + 1;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let yy = 0; yy <= radius && yy < height; yy++)
        sum += wide[yy * width + x];
      for (let y = 0; y < height; y++) {
        if (y > 0) {
          if (y + radius < height) sum += wide[(y + radius) * width + x];
          if (y - radius - 1 >= 0) sum -= wide[(y - radius - 1) * width + x];
        }
        if (sum >= span * 0.78) barrier[y * width + x] = 1;
      }
    }
    const seed =
      clamp(Math.floor(point[1]), 0, height - 1) * width +
      clamp(Math.floor(point[0]), 0, width - 1);
    function connected(useBarrier) {
      const out = new Uint8Array(count),
        queue = new Int32Array(count);
      let head = 0,
        tail = 1;
      queue[0] = seed;
      out[seed] = 255;
      while (head < tail) {
        const p = queue[head++],
          x = p % width;
        for (const n of [
          x ? p - 1 : -1,
          x < width - 1 ? p + 1 : -1,
          p >= width ? p - width : -1,
          p < count - width ? p + width : -1,
        ])
          if (n >= 0 && mask[n] && !out[n] && (!useBarrier || !barrier[n])) {
            out[n] = mask[n];
            queue[tail++] = n;
          }
      }
      return { out, area: tail };
    }
    const plain = connected(false);
    let minY = height,
      maxY = 0;
    for (let p = 0; p < count; p++)
      if (plain.out[p]) {
        minY = Math.min(minY, Math.floor(p / width));
        maxY = Math.max(maxY, Math.floor(p / width));
      }
    const planes = new Uint8Array(count),
      support = Math.max(20, (maxY - minY) * 0.55);
    for (let x = 8; x < width - 8; x++) {
      let total = 0;
      for (let y = minY; y <= maxY; y++) {
        const p = y * width + x;
        if (barrier[p] && plain.out[p - 8] && plain.out[p + 8]) total++;
      }
      if (total >= support)
        for (let y = minY; y <= maxY; y++) planes[y * width + x] = 1;
    }
    barrier.set(planes);
    if (barrier[seed]) return plain.out;
    const bounded = connected(true);
    return bounded.area >= plain.area * 0.12 ? bounded.out : plain.out;
  }
  function decodeModelMasks(original, logits, scores, resized) {
    const { width, height } = original,
      count = size(width, height);
    if (
      logits.length !== 3 * 256 * 256 ||
      scores.length !== 3 ||
      resized.length !== 2 ||
      !resized.every((v) => Number.isFinite(v) && v > 0 && v <= 1024)
    )
      throw Error("Wall selection could not be read.");
    const candidates = [];
    for (let k = 0; k < 3; k++) {
      if (!Number.isFinite(scores[k]) || scores[k] < 0.55) continue;
      const mask = new Uint8Array(count);
      let area = 0;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const fx = clamp(((x + 0.5) * resized[0]) / width / 4 - 0.5, 0, 255),
            fy = clamp(((y + 0.5) * resized[1]) / height / 4 - 0.5, 0, 255);
          const ax = Math.floor(fx),
            ay = Math.floor(fy),
            bx = Math.min(255, ax + 1),
            by = Math.min(255, ay + 1),
            dx = fx - ax,
            dy = fy - ay,
            o = k * 65536;
          const v =
            (logits[o + ay * 256 + ax] * (1 - dx) +
              logits[o + ay * 256 + bx] * dx) *
              (1 - dy) +
            (logits[o + by * 256 + ax] * (1 - dx) +
              logits[o + by * 256 + bx] * dx) *
              dy;
          if (v > 0) {
            mask[y * width + x] = 255;
            area++;
          }
        }
      if (area) candidates.push({ mask, area, score: scores[k] });
    }
    return candidates;
  }
  function modelWallMask(original, logits, scores, resized, point) {
    const { width, height } = original,
      count = size(width, height);
    if (!point.every(Number.isFinite))
      throw Error("Wall selection could not be read.");
    const px = clamp(Math.floor(point[0]), 0, width - 1),
      py = clamp(Math.floor(point[1]), 0, height - 1);
    const candidates = decodeModelMasks(original, logits, scores, resized)
      .filter(
        (c) =>
          c.mask[py * width + px] &&
          c.area > count * 0.001 &&
          c.area < count * 0.6,
      )
      .sort((a, b) => a.area - b.area);
    let best = candidates[0]?.mask;
    if (!best) throw Error("Tap nearer the centre of a wall to select it.");
    best = cleanWallMask(best, width, height);
    const source = original.data,
      smooth = selectionImage(original),
      seed = (py * width + px) * 4,
      denom = Math.max(80, smooth[seed] + smooth[seed + 1] + smooth[seed + 2]);
    const chroma = [
      (smooth[seed] - smooth[seed + 1]) / denom,
      (smooth[seed + 2] - smooth[seed + 1]) / denom,
    ];
    const histogram = new Uint32Array(256);
    let total = 0;
    for (let p = 0; p < count; p++)
      if (best[p]) {
        histogram[Math.round(luminance(source, p * 4) * 255)]++;
        total++;
      }
    let cumulative = 0,
      level = 0;
    while (level < 255) {
      cumulative += histogram[level];
      if (cumulative >= total * 0.75) break;
      level++;
    }
    for (let p = 0; p < count; p++)
      if (best[p]) {
        const i = p * 4,
          sum = Math.max(80, source[i] + source[i + 1] + source[i + 2]);
        const difference =
          ((source[i] - source[i + 1]) / sum - chroma[0]) ** 2 +
          ((source[i + 2] - source[i + 1]) / sum - chroma[1]) ** 2;
        if (
          difference > 0.09 ** 2 ||
          luminance(source, i) < Math.max(0.001, (level / 255) * 0.06) ||
          source[i + 3] < 128
        )
          best[p] = 0;
      }
    if (!best[py * width + px])
      throw Error("Tap the wall surface rather than a window or opening.");
    return refineWallBoundary(original, best, point);
  }
  /* Automatic preparation asks the local model for the enclosing building/wall,
   * rather than painting the whole photograph or using a tap's tiny object mask.
   * Wide sky bands, floors and small foreground objects are not white foundations.
   */
  function modelBuildingMask(original, logits, scores, resized, point) {
    const { width, height } = original,
      count = size(width, height);
    if (point.length !== 2 || !point.every(Number.isFinite))
      throw Error("Building selection could not be read.");
    const at =
      clamp(Math.floor(point[1]), 0, height - 1) * width +
      clamp(Math.floor(point[0]), 0, width - 1);
    const candidates = decodeModelMasks(original, logits, scores, resized)
      .filter((c) => {
        if (
          c.score < 0.68 ||
          !c.mask[at] ||
          c.area < count * 0.035 ||
          c.area > count * 0.94
        )
          return false;
        let sx = 0,
          sy = 0,
          top = 0,
          bottom = 0,
          sides = 0;
        for (let p = 0; p < count; p++)
          if (c.mask[p]) {
            const x = p % width,
              y = Math.floor(p / width);
            sx += x;
            sy += y;
            if (y < height * 0.035) top++;
            if (y > height * 0.96) bottom++;
            if (x < width * 0.025 || x > width * 0.975) sides++;
          }
        const cy = sy / c.area / height,
          cx = sx / c.area / width;
        return (
          cy < 0.73 &&
          cx > 0.12 &&
          cx < 0.88 &&
          !(
            top > width * height * 0.018 &&
            sides > count * 0.012 &&
            cy < 0.42
          ) &&
          !(bottom > count * 0.022 && cy > 0.63)
        );
      })
      .sort((a, b) => b.area - a.area);
    return candidates[0]?.mask || null;
  }
  /* Separate wall material from openings and contrasting wood/glass/vegetation.
   * Chroma is independent of illumination, so concrete in cast shadow still
   * becomes white. Source pixels outside the model boundary remain byte-exact.
   */
  function paintableBuildingMask(original, body) {
    const count = size(original.width, original.height);
    if (body.length !== count) throw Error("Building sizes do not match.");
    const source = original.data,
      smooth = selectionImage(original),
      bins = new Uint32Array(41 * 41),
      histogram = new Uint32Array(256);
    let total = 0;
    for (let p = 0; p < count; p++)
      if (body[p] && source[p * 4 + 3] >= 128) {
        const i = p * 4,
          l = Math.round(luminance(source, i) * 255);
        histogram[l]++;
        total++;
        if (l < 10) continue;
        const sum = Math.max(80, smooth[i] + smooth[i + 1] + smooth[i + 2]);
        const a = clamp(
          Math.round(((smooth[i] - smooth[i + 1]) / sum) * 40) + 20,
          0,
          40,
        );
        const b = clamp(
          Math.round(((smooth[i + 2] - smooth[i + 1]) / sum) * 40) + 20,
          0,
          40,
        );
        bins[b * 41 + a]++;
      }
    if (!total) return new Uint8Array(count);
    let mode = 0;
    for (let i = 1; i < bins.length; i++) if (bins[i] > bins[mode]) mode = i;
    const chroma = [((mode % 41) - 20) / 40, (Math.floor(mode / 41) - 20) / 40];
    let level = 0,
      cumulative = 0;
    while (level < 255) {
      cumulative += histogram[level];
      if (cumulative >= total * 0.65) break;
      level++;
    }
    const mask = new Uint8Array(count),
      dark = Math.max(0.004, (level / 255) * 0.12);
    for (let p = 0; p < count; p++)
      if (body[p]) {
        const i = p * 4,
          sum = Math.max(80, smooth[i] + smooth[i + 1] + smooth[i + 2]);
        const a = (smooth[i] - smooth[i + 1]) / sum,
          b = (smooth[i + 2] - smooth[i + 1]) / sum;
        const sameMaterial =
          (a - chroma[0]) ** 2 + (b - chroma[1]) ** 2 < 0.075 ** 2;
        const neutralTrim = a * a + b * b < 0.045 ** 2;
        if (
          (sameMaterial || neutralTrim) &&
          luminance(source, i) >= dark &&
          source[i + 3] >= 128
        )
          mask[p] = 255;
      }
    /* Reflections can have the same neutral RGB as concrete. Remove their
     * isolated speckles instead of whitening patches of glass between frames.
     * Erosion separates those islands; dilation restores the original wall edge.
     */
    const { width, height } = original,
      core = new Uint8Array(count),
      queue = new Int32Array(count),
      seen = new Uint8Array(count);
    for (let y = 1; y < height - 1; y++)
      for (let x = 1; x < width - 1; x++) {
        const p = y * width + x;
        if (
          mask[p] &&
          mask[p - 1] &&
          mask[p + 1] &&
          mask[p - width] &&
          mask[p + width]
        )
          core[p] = 255;
      }
    const kept = new Uint8Array(count),
      minimum = Math.max(4, count * 0.0015);
    for (let start = 0; start < count; start++)
      if (core[start] && !seen[start]) {
        let head = 0,
          tail = 1;
        queue[0] = start;
        seen[start] = 1;
        while (head < tail) {
          const p = queue[head++],
            x = p % width;
          for (const n of [
            x ? p - 1 : -1,
            x < width - 1 ? p + 1 : -1,
            p - width,
            p + width,
          ])
            if (n >= 0 && n < count && core[n] && !seen[n]) {
              seen[n] = 1;
              queue[tail++] = n;
            }
        }
        if (tail >= minimum)
          for (let i = 0; i < tail; i++) kept[queue[i]] = 255;
      }
    for (let p = 0; p < count; p++)
      if (mask[p] && !kept[p]) {
        const x = p % width;
        if (!(
          (x && kept[p - 1]) ||
          (x < width - 1 && kept[p + 1]) ||
          kept[p - width] ||
          kept[p + width]
        ))
          mask[p] = 0;
      }
    return mask;
  }
  /* Let a neutral concrete wall in deep shade use its own local mask rather
   * than a bright neighbouring facade's material threshold. Bounds still keep
   * background out, and the fine mask retains its window/opening exclusions.
   */
  function constrainDetectedWall(original, fine, building, material, point) {
    const count = size(original.width, original.height);
    if ([fine, building, material].some((m) => m.length !== count))
      throw Error("Wall sizes do not match.");
    const x = clamp(Math.floor(point[0]), 0, original.width - 1),
      y = clamp(Math.floor(point[1]), 0, original.height - 1),
      at = y * original.width + x;
    if (!building[at] || !fine[at])
      throw Error("Tap the middle of a wall, away from the background.");
    if (!material[at]) {
      const i = at * 4,
        source = original.data,
        sum = Math.max(80, source[i] + source[i + 1] + source[i + 2]);
      const chroma =
        ((source[i] - source[i + 1]) / sum) ** 2 +
        ((source[i + 2] - source[i + 1]) / sum) ** 2;
      if (chroma > 0.085 ** 2 || luminance(source, i) < 0.006)
        throw Error("Tap the wall surface rather than a window or opening.");
    }
    const mask = new Uint8Array(count);
    let area = 0;
    for (let p = 0; p < count; p++) {
      mask[p] = Math.min(fine[p], building[p]);
      if (mask[p]) area++;
    }
    if (area < count * 0.0005)
      throw Error("Tap nearer the centre of the wall.");
    return mask;
  }
  /* Print the actual before/after buffers, even while Before is displayed.
   * The same-origin print document contains images and text only, with no scripts.
   */
  async function printComparison(original, after, colours = []) {
    const frame = document.createElement("iframe");
    frame.title = "Areva Paints — before and after";
    frame.className = "ap-print-frame";
    frame.style.cssText =
      "position:fixed;left:-10000px;top:0;width:1100px;height:800px;border:0";
    document.body.append(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(
      "<!doctype html><html><head><title>Areva Paints — Before and After</title></head><body></body></html>",
    );
    doc.close();
    const style = doc.createElement("style");
    style.textContent =
      "@page{size:A4 landscape;margin:12mm}body{font:14px Arial,sans-serif;color:#321149;margin:0}h1{font-size:24px}main{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;break-inside:avoid}img{width:100%;height:auto}figcaption{font-weight:bold;margin:8px 0}p{color:#675a70;font-size:12px}";
    doc.head.append(style);
    const title = doc.createElement("h1");
    title.textContent = "Areva Paints — Your home, your colours";
    doc.body.append(title);
    const row = doc.createElement("main");
    doc.body.append(row);
    const images = [];
    for (const [label, data] of [
      ["Before painting", original],
      ["After painting", after],
    ]) {
      const c = document.createElement("canvas");
      c.width = data.width;
      c.height = data.height;
      c.getContext("2d").putImageData(
        new ImageData(
          new Uint8ClampedArray(data.data),
          data.width,
          data.height,
        ),
        0,
        0,
      );
      const figure = doc.createElement("figure"),
        caption = doc.createElement("figcaption"),
        img = doc.createElement("img");
      caption.textContent = label;
      img.alt = label;
      img.src = c.toDataURL("image/jpeg", 0.94);
      figure.append(caption, img);
      row.append(figure);
      images.push(img);
    }
    const note = doc.createElement("p");
    note.textContent =
      (colours.length
        ? "Chosen colours: " + colours.map((c) => c.name).join(", ") + ". "
        : "") +
      "Digital preview. Confirm your final choice with a physical shade card.";
    doc.body.append(note);
    await Promise.all(images.map((img) => img.decode()));
    frame.dataset.ready = "true";
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
    return frame;
  }

  /* Both public hosts share one controller: select a wall, optionally apply
   * white primer, or choose a published colour directly. Photos load unchanged.
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
    const ctx = canvas.getContext("2d", { willReadFrequently: true }),
      stage = canvas.parentElement,
      ownsToolbar = !toolbar;
    if (!toolbar) {
      toolbar = document.createElement("div");
      viewport.after(toolbar);
    }
    toolbar.classList.add("ap-toolbar");
    controls.classList.add("ap-tools");
    viewport.classList.add("ap-viewport");
    toolbar.innerHTML =
      '<p class="ap-instruction"></p><div class="ap-wall-actions"><button type="button" data-action="primer">Make selected wall white</button><button type="button" data-action="retry" hidden>Retry selection</button><span class="ap-shade-name"></span></div><div class="ap-mode-tools" role="group" aria-label="Painting tools"><button type="button" data-tool="select">Select wall</button><button type="button" data-tool="fill">Paint wall</button><button type="button" data-tool="brush">Brush</button><button type="button" data-tool="erase">Eraser</button><button type="button" data-action="undo">Undo</button></div><div class="ap-brush-options"><label for="areva-brush-size">Brush size</label><input id="areva-brush-size" aria-label="Brush size" type="range" min="6" max="64" step="2" value="24"><output>24 px</output></div><p class="ap-active-colour"><i aria-hidden="true"></i><span></span></p>';
    controls.innerHTML =
      '<div class="ap-footer"><div class="ap-view" role="group" aria-label="Photo comparison"><button type="button" data-action="before">Before</button><button type="button" data-action="after">After</button></div><button type="button" data-action="reset">Reset photo</button><button type="button" data-action="download">Download</button><button type="button" class="ap-print" data-action="print">Print before &amp; after</button></div><p class="ap-feedback" role="status" aria-live="polite"></p>';
    const overlay = document.createElement("canvas"),
      oc = overlay.getContext("2d");
    overlay.className = "ap-selection";
    overlay.tabIndex = 0;
    overlay.setAttribute(
      "aria-label",
      "Select a wall or paint inside the selected wall with the brush.",
    );
    stage.append(overlay);
    const find = (s) => toolbar.querySelector(s) || controls.querySelector(s),
      root = viewport.closest("#visualizer"),
      header = document.querySelector("header");
    let original = null,
      after = null,
      allowedMask = null,
      buildingMask = null,
      surfaces = [],
      regions = [],
      selected = null,
      view = "after",
      enabled = true,
      busy = false,
      encoded = false,
      destroyed = false,
      failed = false,
      generation = 0,
      worker = null,
      sequence = 0,
      requestSequence = 0,
      editSequence = 0,
      history = [],
      palette = [],
      resized = [1024, 1024],
      gesture = null,
      retryPoint = null,
      queuedPoint = null,
      mode = "select",
      activeShade = null,
      brushSize = 24,
      paintFrame = 0,
      fitFrame = 0,
      cursor = null;
    const requests = new Map(),
      listeners = [];
    const listen = (target, event, fn) => {
      target.addEventListener(event, fn);
      listeners.push(() => target.removeEventListener(event, fn));
    };
    const report = (message) => {
      if (!destroyed) {
        find(".ap-feedback").textContent = message;
        onStatus(message);
      }
    };
    const selectedSurface = () => surfaces.find((s) => s.id === selected);
    const remember = () => {
      history.push({ surfaces: [...surfaces], selected });
      if (history.length > 16) history.shift();
    };
    const editedColours = () => {
      const entries = [];
      for (const wall of surfaces) {
        if (wall.hex || wall.primed)
          entries.push({
            hex: wall.hex || "#ffffff",
            name: wall.hex ? wall.name : "White primer",
            code: wall.code,
          });
        for (const brush of wall.brushes || [])
          entries.push({ hex: brush.hex, name: brush.name, code: brush.code });
      }
      return entries.filter(
        (v, i) =>
          entries.findIndex((c) => c.hex === v.hex && c.name === v.name) === i,
      );
    };
    const notify = () => {
      const wall = selectedSurface();
      controls.dataset.selectedCode = activeShade?.code || "";
      controls.dataset.wallId = wall?.id || "";
      onChange({
        canUndo: history.length > 0,
        colors: editedColours(),
        activeShade: activeShade || undefined,
        mode,
        selectedShade: wall?.hex
          ? { hex: wall.hex, name: wall.name, code: wall.code }
          : undefined,
      });
    };
    const pixel = (point) =>
      clamp(Math.floor(point[1]), 0, original.height - 1) * original.width +
      clamp(Math.floor(point[0]), 0, original.width - 1);
    const photoPoint = (e) => {
      const r = overlay.getBoundingClientRect();
      return [
        ((e.clientX - r.left) * overlay.width) / r.width,
        ((e.clientY - r.top) * overlay.height) / r.height,
      ];
    };
    function fit() {
      if (root)
        root.style.setProperty(
          "--ap-sticky-top",
          Math.max(12, (header?.getBoundingClientRect().height || 0) + 12) +
            "px",
        );
      if (original) {
        if (gesture?.painting) {
          const r = overlay.getBoundingClientRect();
          if (
            Math.abs(r.width - gesture.rect.width) > 1 ||
            Math.abs(r.height - gesture.rect.height) > 1
          )
            cancelStroke();
        }
        stage.style.aspectRatio = original.width + " / " + original.height;
        stage.style.width =
          Math.max(
            1,
            Math.min(
              viewport.clientWidth - 2,
              ((viewport.clientHeight - 2) * original.width) / original.height,
            ),
          ) + "px";
      }
    }
    const fitSoon = () => {
      if (!fitFrame)
        fitFrame = requestAnimationFrame(() => {
          fitFrame = 0;
          if (!destroyed) fit();
        });
    };
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(fitSoon) : null;
    if (header) observer?.observe(header);
    observer?.observe(viewport);
    observer?.observe(viewport.parentElement);
    listen(window, "resize", fitSoon);
    function refresh() {
      const ready = !!original && enabled,
        wall = selectedSurface(),
        locked = busy || !!gesture?.painting;
      for (const b of [
        ...toolbar.querySelectorAll("button"),
        ...controls.querySelectorAll("button"),
      ])
        b.disabled = !ready || locked;
      for (const action of ["before", "after"]) {
        const b = find('[data-action="' + action + '"]');
        b.disabled = !ready || !!gesture?.painting;
        b.setAttribute("aria-pressed", String(view === action));
      }
      const retry = find('[data-action="retry"]');
      retry.hidden = !failed;
      const primer = find('[data-action="primer"]');
      primer.disabled = !ready || locked || !wall;
      primer.dataset.applied = String(
        !!wall?.primed && !wall.hex && !(wall.brushes || []).length,
      );
      find('[data-action="undo"]').disabled =
        !ready || busy || (!history.length && !gesture?.painting);
      for (const b of toolbar.querySelectorAll("[data-tool]")) {
        const tool = b.dataset.tool;
        b.setAttribute("aria-pressed", String(mode === tool));
        b.disabled =
          !ready ||
          !!gesture?.painting ||
          ((tool === "brush" || tool === "erase") && (busy || !wall));
      }
      find('[aria-label="Brush size"]').disabled =
        !ready || locked || !wall || (mode !== "brush" && mode !== "erase");
      find(".ap-brush-options output").textContent = brushSize + " px";
      find(".ap-instruction").textContent = busy
        ? "Finding the selected wall…"
        : failed
          ? "Selection failed. Tap another wall or retry."
          : mode === "brush"
            ? "Brush is locked to the selected wall. Choose a colour, then draw."
            : mode === "erase"
              ? "Erase brush marks inside this wall. Its base colour stays in place."
              : mode === "fill"
                ? activeShade
                  ? "Tap another wall to paint it with " +
                    activeShade.name +
                    "."
                  : "Choose a colour, then tap a wall to paint it."
                : wall
                  ? "Wall selected. Make it white, choose a colour, or use Brush."
                  : "Tap a wall to select it. White primer is optional.";
      find(".ap-shade-name").textContent = wall
        ? wall.hex
          ? wall.name
          : wall.primed
            ? "White primer applied"
            : "Wall selected"
        : "No wall selected";
      find(".ap-active-colour i").style.background =
        activeShade?.hex || "transparent";
      find(".ap-active-colour span").textContent = activeShade
        ? "Current colour: " +
          activeShade.name +
          (activeShade.code ? " (" + activeShade.code + ")" : "")
        : "Choose your paint colour on the right.";
      overlay.hidden = !ready;
      overlay.dataset.mode = busy
        ? "selecting"
        : failed
          ? "error"
          : ready
            ? "colour"
            : "loading";
      overlay.dataset.tool = mode;
      overlay.setAttribute("aria-busy", String(busy));
      overlay.style.cursor = busy
        ? "progress"
        : mode === "brush" || mode === "erase"
          ? "crosshair"
          : "pointer";
      overlay.style.touchAction =
        mode === "brush" || mode === "erase" ? "none" : "manipulation";
      viewport.setAttribute("aria-busy", String(busy));
      draw();
    }
    function draw() {
      oc.clearRect(0, 0, overlay.width, overlay.height);
      if (!original || view === "before") return;
      const wall = selectedSurface();
      if (!wall) return;
      const edge = oc.createImageData(overlay.width, overlay.height),
        w = overlay.width;
      for (let p = 0; p < wall.mask.length; p++)
        if (
          wall.mask[p] &&
          (p < w ||
            p >= wall.mask.length - w ||
            p % w === 0 ||
            p % w === w - 1 ||
            !wall.mask[p - 1] ||
            !wall.mask[p + 1] ||
            !wall.mask[p - w] ||
            !wall.mask[p + w])
        ) {
          edge.data[p * 4] = 110;
          edge.data[p * 4 + 1] = 62;
          edge.data[p * 4 + 2] = 148;
          edge.data[p * 4 + 3] = 230;
        }
      oc.putImageData(edge, 0, 0);
      if (cursor && (mode === "brush" || mode === "erase")) {
        const scale =
          overlay.width / Math.max(1, overlay.getBoundingClientRect().width);
        oc.beginPath();
        oc.arc(cursor[0], cursor[1], (brushSize * scale) / 2, 0, Math.PI * 2);
        oc.lineWidth = 2 * scale;
        oc.strokeStyle = "#ffffff";
        oc.stroke();
        oc.lineWidth = scale;
        oc.strokeStyle = "#65358b";
        oc.stroke();
      }
    }
    function show(data) {
      ctx.putImageData(
        new ImageData(
          new Uint8ClampedArray(data.data),
          data.width,
          data.height,
        ),
        0,
        0,
      );
    }
    function render() {
      if (!original) return;
      after = renderSelectedPreview(original, surfaces);
      show(view === "before" ? original : after);
      refresh();
      notify();
    }
    function normalize(values) {
      return (Array.isArray(values) ? values : [])
        .slice(0, 5000)
        .filter(
          (s) =>
            s && typeof s.name === "string" && /^#[0-9a-f]{6}$/i.test(s.hex),
        )
        .map((s) => ({ ...s, tones: [...(s.tones || [])] }));
    }
    function stopWorker() {
      worker?.terminate();
      worker = null;
      encoded = false;
      for (const job of requests.values()) {
        clearTimeout(job.timer);
        job.reject(new DOMException("Photo changed", "AbortError"));
      }
      requests.clear();
    }
    function request(kind, payload = {}) {
      if (!worker) {
        worker = new Worker("/assets/wall-selector-worker.js?v=1");
        const ownedWorker = worker;
        worker.onmessage = ({ data }) => {
          if (worker !== ownedWorker) return;
          const job = requests.get(data.id);
          if (!job) return;
          if (data.progress) {
            report(data.progress);
            return;
          }
          clearTimeout(job.timer);
          requests.delete(data.id);
          data.error ? job.reject(Error(data.error)) : job.resolve(data);
        };
        worker.onerror = () => {
          if (worker !== ownedWorker) return;
          for (const job of requests.values()) {
            clearTimeout(job.timer);
            job.reject(Error("Wall preparation could not load. Please retry."));
          }
          requests.clear();
          worker?.terminate();
          worker = null;
          encoded = false;
        };
      }
      return new Promise((resolve, reject) => {
        const id = ++requestSequence,
          timer = setTimeout(() => {
            if (!requests.has(id)) return;
            requests.delete(id);
            worker?.terminate();
            worker = null;
            encoded = false;
            reject(Error("Photo preparation took too long. Please try again."));
          }, 90000);
        requests.set(id, { resolve, reject, timer });
        worker.postMessage(
          { id, kind, ...payload },
          payload.pixels ? [payload.pixels.buffer] : [],
        );
      });
    }
    async function encode() {
      if (encoded) return;
      const token = generation,
        c = document.createElement("canvas"),
        scale = 1024 / Math.max(original.width, original.height);
      resized = [
        Math.round(original.width * scale),
        Math.round(original.height * scale),
      ];
      c.width = original.width;
      c.height = original.height;
      c.getContext("2d").putImageData(
        new ImageData(
          new Uint8ClampedArray(original.data),
          original.width,
          original.height,
        ),
        0,
        0,
      );
      const small = document.createElement("canvas");
      small.width = resized[0];
      small.height = resized[1];
      small.getContext("2d").drawImage(c, 0, 0, ...resized);
      const rgba = small.getContext("2d").getImageData(0, 0, ...resized).data,
        pixels = new Float32Array(3 * 1024 * 1024),
        mean = [0.485, 0.456, 0.406],
        std = [0.229, 0.224, 0.225];
      for (let y = 0; y < resized[1]; y++)
        for (let x = 0; x < resized[0]; x++)
          for (let k = 0; k < 3; k++)
            pixels[k * 1024 * 1024 + y * 1024 + x] =
              (rgba[(y * resized[0] + x) * 4 + k] / 255 - mean[k]) / std[k];
      await request("encode", { pixels });
      if (token === generation) encoded = true;
    }
    async function selectModel(point) {
      return request("select", {
        point: [
          (point[0] * resized[0]) / original.width,
          (point[1] * resized[1]) / original.height,
        ],
      });
    }

    /* Coarse geometry protects background, while point-local material filtering
     * keeps a dark concrete wall selectable instead of using a bright facade's
     * global brightness threshold as a veto on every other wall.
     */
    async function detectSurfaces(point, token) {
      const count = original.width * original.height,
        body = new Uint8Array(count),
        probes = [
          point,
          ...[
            [0.5, 0.4],
            [0.3, 0.35],
            [0.7, 0.45],
          ].map(([x, y]) => [x * original.width, y * original.height]),
        ];
      let tapped = null;
      for (let i = 0; i < probes.length; i++) {
        const probe = probes[i],
          result = await selectModel(probe);
        if (token !== generation || destroyed) return null;
        if (!i) tapped = result;
        const mask = modelBuildingMask(
          original,
          result.masks,
          result.scores,
          resized,
          probe,
        );
        if (mask)
          for (let p = 0; p < count; p++) body[p] = Math.max(body[p], mask[p]);
      }
      if (body.reduce((n, v) => n + (v ? 1 : 0), 0) < count * 0.025)
        throw Error(
          "This wall could not be identified. Try a clearer building photo.",
        );
      buildingMask = body;
      allowedMask = paintableBuildingMask(original, body);
      return tapped;
    }
    function selectedReady() {
      failed = false;
      retryPoint = null;
      if (mode === "fill" && activeShade)
        finishWall(selectedSurface(), {
          ...activeShade,
          primed: selectedSurface().primed,
        });
      else render();
      report(
        mode === "fill" && activeShade
          ? activeShade.name + " applied to this wall."
          : "Wall selected. Make it white, choose a colour, or use Brush.",
      );
    }
    async function tap(point) {
      if (!original || !enabled || gesture?.painting) return;
      if (busy) {
        queuedPoint = [...point];
        report("Switching to the latest wall you tapped…");
        return;
      }
      const at = pixel(point);
      view = "after";
      selected = null;
      failed = false;
      retryPoint = [...point];
      onBeforeSelect();
      const known = regions.find((r) => r.mask[at] >= 128);
      if (known) {
        selected = surfaces.find((s) => s.mask === known.mask)?.id ?? null;
        selectedReady();
        return;
      }
      if (regions.length) {
        render();
        report("Tap a wall surface, away from windows and doors.");
        return;
      }
      const token = generation;
      busy = true;
      refresh();
      notify();
      report("Finding your selected wall…");
      try {
        await encode();
        if (token !== generation || destroyed) return;
        let result = buildingMask ? null : await detectSurfaces(point, token);
        if (token !== generation || destroyed) return;
        if (queuedPoint) return;
        if (!buildingMask[at])
          throw Error(
            "Tap a wall surface, away from the sky and surroundings.",
          );
        if (!result) result = await selectModel(point);
        if (token !== generation || destroyed) return;
        if (queuedPoint) return;
        const fine = modelWallMask(
            original,
            result.masks,
            result.scores,
            resized,
            point,
          ),
          mask = constrainDetectedWall(
            original,
            fine,
            buildingMask,
            allowedMask,
            point,
          );
        let matching = null;
        for (const wall of surfaces) {
          let intersection = 0,
            union = 0;
          for (let p = 0; p < mask.length; p++) {
            if (mask[p] && wall.mask[p]) intersection++;
            if (mask[p] || wall.mask[p]) union++;
          }
          if (intersection / Math.max(1, union) > 0.85) {
            matching = wall;
            break;
          }
        }
        if (matching) selected = matching.id;
        else {
          if (surfaces.length >= 16)
            throw Error(
              "Up to sixteen walls can be edited. Reset the photo to start another combination.",
            );
          const wall = {
            id: ++sequence,
            mask,
            primed: false,
            hex: null,
            name: "",
            code: "",
            brushes: [],
          };
          surfaces = [...surfaces, wall];
          selected = wall.id;
        }
        busy = false;
        selectedReady();
      } catch (error) {
        if (token === generation && error.name !== "AbortError") {
          failed = true;
          report(error.message);
        }
      } finally {
        if (token === generation && !destroyed) {
          busy = false;
          const next = queuedPoint;
          queuedPoint = null;
          if (next) void tap(next);
          else render();
        }
      }
    }
    function finishWall(wall, finish) {
      if (!wall) return;
      const laterOverlap = surfaces.some(
        (s) =>
          s.id !== wall.id &&
          ((s.order || 0) > (wall.order || 0) ||
            (s.brushes || []).some((b) => b.order > (wall.order || 0))) &&
          s.mask.some((v, p) => v && wall.mask[p]),
      );
      if (
        ["hex", "primed", "name", "code"].some((k) => wall[k] !== finish[k]) ||
        (wall.brushes || []).length ||
        laterOverlap
      ) {
        remember();
        surfaces = [
          ...surfaces.filter((s) => s.id !== wall.id),
          {
            ...wall,
            ...finish,
            id: wall.id,
            mask: wall.mask,
            brushes: [],
            order: ++editSequence,
          },
        ];
      }
      view = "after";
      render();
    }
    function resolveShade(value) {
      if (!value || !/^#[0-9a-f]{6}$/i.test(value.hex)) return null;
      return (
        palette.find((s) =>
          value.code
            ? s.code === value.code
            : s.hex.toLowerCase() === value.hex.toLowerCase() &&
              (s.name === value.name ||
                value.name === s.name + " (" + s.code + ")"),
        ) || null
      );
    }
    function chooseColour(value) {
      const record = resolveShade(value);
      if (!record) return report("Choose a published colour from the palette.");
      if (gesture?.painting) cancelStroke();
      activeShade = { ...record };
      if (mode === "brush" || mode === "erase") mode = "brush";
      else mode = "fill";
      const wall = selectedSurface();
      if (wall && !busy && mode === "fill")
        finishWall(wall, { ...record, primed: wall.primed });
      else {
        refresh();
        notify();
      }
      onSelectShade(record);
      report(
        busy
          ? record.name +
              " selected. It will be ready when wall selection finishes."
          : mode === "brush"
            ? record.name +
              " ready for the brush. Strokes stay inside the selected wall."
            : wall
              ? record.name + " applied to this wall."
              : "Tap a wall to paint it with " + record.name + ".",
      );
    }
    function applyPrimer() {
      const wall = selectedSurface();
      if (!original || !enabled || busy || !wall) return;
      cancelStroke();
      mode = "select";
      finishWall(wall, { primed: true, hex: null, name: "", code: "" });
      report("The selected wall is now white. Other walls keep their colours.");
    }
    function setTool(tool) {
      if (!["select", "fill", "brush", "erase"].includes(tool)) return;
      cancelStroke();
      mode = tool;
      cursor = null;
      if (tool === "fill" && selectedSurface() && activeShade && !busy)
        finishWall(selectedSurface(), {
          ...activeShade,
          primed: selectedSurface().primed,
        });
      else {
        refresh();
        notify();
      }
      report(
        tool === "select"
          ? "Tap a wall to select it without changing its colour."
          : tool === "fill"
            ? activeShade
              ? "Tap a wall to paint it with " + activeShade.name + "."
              : "Choose a paint colour on the right."
            : tool === "brush"
              ? "Draw inside the selected wall. Use Select wall to change walls."
              : "Erase brush marks inside the selected wall. Base paint and primer are preserved.",
      );
    }
    /* A gesture owns one immutable wall boundary and one Undo entry. Pointer
     * capture and clipping cover fast strokes, holes, photo edges and touch input.
     */
    function cancelStroke() {
      const current = gesture;
      gesture = null;
      cancelAnimationFrame(paintFrame);
      paintFrame = 0;
      if (current?.painting) {
        if (overlay.hasPointerCapture?.(current.id))
          overlay.releasePointerCapture(current.id);
        if (original && after) {
          show(view === "before" ? original : after);
          refresh();
        }
      }
    }
    function strokeSegment(point) {
      const g = gesture;
      if (!g?.painting) return;
      strokeInto(
        g.mask,
        original.width,
        original.height,
        g.last,
        point,
        g.radius,
      );
      const left = clamp(
          Math.floor(Math.min(g.last[0], point[0]) - g.radius - 1),
          0,
          original.width,
        ),
        right = clamp(
          Math.ceil(Math.max(g.last[0], point[0]) + g.radius + 1),
          0,
          original.width,
        ),
        top = clamp(
          Math.floor(Math.min(g.last[1], point[1]) - g.radius - 1),
          0,
          original.height,
        ),
        bottom = clamp(
          Math.ceil(Math.max(g.last[1], point[1]) + g.radius + 1),
          0,
          original.height,
        );
      for (let y = top; y < bottom; y++)
        for (let x = left; x < right; x++) {
          const p = y * original.width + x;
          g.mask[p] = Math.min(g.mask[p], g.boundary[p]);
        }
      g.bounds = [
        Math.min(g.bounds[0], left),
        Math.min(g.bounds[1], top),
        Math.max(g.bounds[2], right),
        Math.max(g.bounds[3], bottom),
      ];
      g.last = point;
      cursor = point;
    }
    function draftStroke() {
      paintFrame = 0;
      const g = gesture;
      if (!g?.painting || g.generation !== generation) return;
      const crop = cropBrushMask(
        g.mask,
        original.width,
        original.height,
        g.bounds,
      );
      if (!crop) return;
      let data;
      if (g.tool === "brush")
        data = paintBrushLayer(original, after.data, g.wall.mask, {
          ...crop,
          ...g.colour,
          order: editSequence + 1,
        });
      else {
        const brushes = eraseBrushLayers(
          original.width,
          original.height,
          g.wall.brushes || [],
          g.mask,
          g.boundary,
        );
        data = renderSelectedPreview(
          original,
          surfaces.map((s) => (s.id === g.wall.id ? { ...s, brushes } : s)),
        ).data;
      }
      show({ ...original, data });
      draw();
    }
    function commitStroke() {
      const g = gesture;
      if (!g?.painting) return;
      cancelAnimationFrame(paintFrame);
      paintFrame = 0;
      gesture = null;
      if (overlay.hasPointerCapture?.(g.id))
        overlay.releasePointerCapture(g.id);
      if (
        g.generation !== generation ||
        !selectedSurface() ||
        selectedSurface().id !== g.wall.id
      )
        return;
      const crop = cropBrushMask(
        g.mask,
        original.width,
        original.height,
        g.bounds,
      );
      if (!crop) {
        render();
        return;
      }
      let brushes;
      if (g.tool === "brush") {
        if (surfaces.reduce((n, s) => n + (s.brushes || []).length, 0) >= 64) {
          render();
          report(
            "The design has 64 brush strokes. Use Undo, Eraser or Reset photo to make room.",
          );
          return;
        }
        brushes = [
          ...(g.wall.brushes || []),
          { ...crop, ...g.colour, order: ++editSequence },
        ];
      } else {
        brushes = eraseBrushLayers(
          original.width,
          original.height,
          g.wall.brushes || [],
          g.mask,
          g.boundary,
        );
        if (brushes === g.wall.brushes) {
          render();
          report(
            "No brush marks in this area. The wall's base finish is unchanged.",
          );
          return;
        }
      }
      remember();
      surfaces = surfaces.map((s) =>
        s.id === g.wall.id ? { ...s, brushes } : s,
      );
      view = "after";
      render();
      report(
        g.tool === "brush"
          ? "Brush stroke added inside the selected wall."
          : "Brush marks erased inside the selected wall.",
      );
    }
    function startPointer(e) {
      if (!e.isPrimary || e.button !== 0 || !original || !enabled) return;
      if (mode !== "brush" && mode !== "erase") {
        gesture = { id: e.pointerId, x: e.clientX, y: e.clientY };
        return;
      }
      if (busy) return;
      const wall = selectedSurface();
      if (!wall) return report("Use Select wall before drawing.");
      if (mode === "brush" && !activeShade)
        return report("Choose a brush colour on the right.");
      const boundary = brushBoundary(
          original.width,
          original.height,
          wall.mask,
          surfaces.filter((s) => s.id !== wall.id).map((s) => s.mask),
        ),
        point = photoPoint(e);
      if (!boundary[pixel(point)])
        return report(
          "Brush locked to this wall. Use Select wall to change walls.",
        );
      e.preventDefault();
      view = "after";
      show(after);
      gesture = {
        id: e.pointerId,
        painting: true,
        generation,
        wall,
        boundary,
        tool: mode,
        colour: activeShade ? { ...activeShade } : null,
        radius:
          ((brushSize / 2) * overlay.width) /
          overlay.getBoundingClientRect().width,
        mask: new Uint8Array(original.width * original.height),
        rect: overlay.getBoundingClientRect(),
        last: point,
        bounds: [original.width, original.height, 0, 0],
      };
      overlay.setPointerCapture(e.pointerId);
      strokeSegment(point);
      refresh();
      paintFrame = requestAnimationFrame(draftStroke);
    }
    function movePointer(e) {
      if (!original) return;
      const point = photoPoint(e);
      cursor = point;
      if (gesture?.painting && gesture.id === e.pointerId) {
        e.preventDefault();
        const samples = e.getCoalescedEvents?.();
        for (const sample of samples?.length ? samples : [e])
          strokeSegment(photoPoint(sample));
        if (!paintFrame) paintFrame = requestAnimationFrame(draftStroke);
      } else draw();
    }
    function endPointer(e) {
      if (gesture?.painting && gesture.id === e.pointerId) {
        strokeSegment(photoPoint(e));
        commitStroke();
        return;
      }
      const start = gesture;
      gesture = null;
      if (
        start &&
        start.id === e.pointerId &&
        Math.hypot(start.x - e.clientX, start.y - e.clientY) < 8
      )
        void tap(photoPoint(e));
    }
    function download() {
      const c = document.createElement("canvas");
      c.width = after.width;
      c.height = after.height;
      c.getContext("2d").putImageData(
        new ImageData(
          new Uint8ClampedArray(after.data),
          after.width,
          after.height,
        ),
        0,
        0,
      );
      const a = document.createElement("a");
      a.download = "areva-home-colours.png";
      a.href = c.toDataURL("image/png");
      a.click();
      report("Your painted preview has been downloaded.");
    }
    const action = (event) => {
      const b = event.target.closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.tool) {
        setTool(b.dataset.tool);
        return;
      }
      switch (b.dataset.action) {
        case "retry":
          if (retryPoint) void tap(retryPoint);
          break;
        case "before":
        case "after":
          cancelStroke();
          view = b.dataset.action;
          render();
          break;
        case "primer":
          applyPrimer();
          break;
        case "undo":
          api.undo();
          break;
        case "reset":
          api.reset();
          break;
        case "download":
          download();
          break;
        case "print":
          void printComparison(original, after, editedColours()).catch(() =>
            report("The print view could not open. Please try again."),
          );
          break;
      }
    };
    listen(toolbar, "click", action);
    listen(controls, "click", action);
    listen(find('[aria-label="Brush size"]'), "input", (e) => {
      brushSize = +e.target.value;
      find(".ap-brush-options output").textContent = brushSize + " px";
      draw();
    });
    listen(overlay, "pointerdown", startPointer);
    listen(overlay, "pointermove", movePointer);
    listen(overlay, "pointerup", endPointer);
    listen(overlay, "pointercancel", cancelStroke);
    listen(overlay, "lostpointercapture", () => {
      if (gesture?.painting) cancelStroke();
    });
    listen(overlay, "pointerleave", () => {
      if (!gesture?.painting) {
        cursor = null;
        draw();
      }
    });
    listen(overlay, "keydown", (e) => {
      if (e.key === "Enter" && (mode === "select" || mode === "fill")) {
        e.preventDefault();
        void tap([overlay.width / 2, overlay.height / 2]);
      }
    });
    listen(root || viewport.parentElement, "keydown", (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "z" &&
        !e.target.closest('input,textarea,select,[contenteditable="true"]')
      ) {
        e.preventDefault();
        api.undo();
      } else if (e.key === "Escape" && gesture?.painting) {
        cancelStroke();
        report("Brush stroke cancelled.");
      }
    });
    const api = {
      setImage(image, { roomId = null } = {}) {
        size(image.width, image.height);
        if (image.data.length !== image.width * image.height * 4)
          throw Error("This photo could not be read.");
        cancelStroke();
        generation++;
        stopWorker();
        busy = false;
        enabled = true;
        failed = false;
        original = {
          width: image.width,
          height: image.height,
          data: new Uint8ClampedArray(image.data),
        };
        regions = presetWallRegions(image.width, image.height, roomId);
        surfaces = regions.map((r, i) => ({
          id: i + 1,
          mask: r.mask,
          primed: false,
          hex: null,
          name: "",
          code: "",
          brushes: [],
        }));
        sequence = surfaces.length;
        editSequence = 0;
        selected = null;
        history = [];
        view = "after";
        mode = "select";
        activeShade = null;
        cursor = null;
        allowedMask = buildingMask = null;
        retryPoint = null;
        queuedPoint = null;
        overlay.width = image.width;
        overlay.height = image.height;
        fit();
        render();
        report(
          "Photo ready. Select a wall to make it white, paint it, or add a brush design.",
        );
      },
      undo() {
        if (gesture?.painting) {
          cancelStroke();
          report("Brush stroke cancelled.");
          return;
        }
        if (busy || !history.length) return;
        const saved = history.pop();
        surfaces = saved.surfaces;
        selected = saved.selected;
        failed = false;
        view = "after";
        render();
        report("Last change undone.");
      },
      reset() {
        if (!original || busy) return;
        cancelStroke();
        remember();
        surfaces = regions.map((r, i) => ({
          id: i + 1,
          mask: r.mask,
          primed: false,
          hex: null,
          name: "",
          code: "",
          brushes: [],
        }));
        selected = null;
        failed = false;
        retryPoint = null;
        queuedPoint = null;
        view = "after";
        mode = "select";
        activeShade = null;
        cursor = null;
        render();
        report("Original photo restored. Select a wall to start again.");
      },
      setEnabled(value) {
        if (!value) {
          cancelStroke();
          generation++;
          queuedPoint = null;
          stopWorker();
          busy = false;
        }
        enabled = value;
        refresh();
      },
      setComparison(value) {
        cancelStroke();
        view = value ? "before" : "after";
        render();
      },
      shadeChanged() {
        /* Host callbacks synchronize the selected chip only. They must never
         * turn a brush-colour choice into a full-wall fill or lose duplicate codes.
         */
        const value = shade();
        if (
          activeShade?.hex.toLowerCase() === value.hex?.toLowerCase() &&
          (activeShade.name === value.name ||
            value.name === activeShade.name + " (" + activeShade.code + ")")
        )
          return;
        const record = resolveShade(value);
        if (record) {
          activeShade = { ...record };
          refresh();
          notify();
        }
      },
      applyShade: chooseColour,
      setSwatches(values) {
        palette = normalize(values);
        notify();
      },
      destroy() {
        cancelStroke();
        destroyed = true;
        generation++;
        stopWorker();
        observer?.disconnect();
        cancelAnimationFrame(fitFrame);
        cancelAnimationFrame(paintFrame);
        listeners.forEach((remove) => remove());
        overlay.remove();
        toolbar.replaceChildren();
        controls.replaceChildren();
        if (ownsToolbar) toolbar.remove();
        stage.style.aspectRatio = "";
        stage.style.width = "";
        original = after = allowedMask = buildingMask = null;
        surfaces = [];
        history = [];
      },
    };
    palette = normalize(swatches);
    fit();
    refresh();
    return api;
  }
  globalThis.ArevaPaintStudio = Object.freeze({
    version: 9,
    polygonMask,
    subtractMask,
    connectedMask,
    paintImage,
    validPolygon,
    brushMask,
    brushBoundary,
    constrainedBrushMask,
    cropBrushMask,
    paintBrushLayer,
    eraseBrushLayers,
    constrainDetectedWall,
    composeImage,
    boxCorners,
    moveAreaCorner,
    presetWallRegions,
    whiteWallBase,
    renderWhitePreview,
    renderSelectedPreview,
    cleanWallMask,
    refineWallBoundary,
    modelWallMask,
    modelBuildingMask,
    paintableBuildingMask,
    printComparison,
    createEditor,
  });
})();
