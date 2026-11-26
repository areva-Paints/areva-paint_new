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
  function modelWallMask(original, logits, scores, resized, point) {
    const { width, height } = original,
      count = size(width, height);
    if (
      logits.length !== 3 * 256 * 256 ||
      scores.length !== 3 ||
      !point.every(Number.isFinite)
    )
      throw Error("Wall selection could not be read.");
    const px = clamp(Math.floor(point[0]), 0, width - 1),
      py = clamp(Math.floor(point[1]), 0, height - 1);
    let best = null,
      bestArea = Infinity;
    for (let k = 0; k < 3; k++) {
      if (scores[k] < 0.55) continue;
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
      if (
        mask[py * width + px] &&
        area > count * 0.001 &&
        area < count * 0.6 &&
        area < bestArea
      ) {
        best = mask;
        bestArea = area;
      }
    }
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

  /* A deliberately small workflow: white foundation, tap a wall, choose colour.
   * No brush panels, editable area lists, zoom controls or hidden advanced tools.
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
      '<div class="ap-steps" role="group" aria-label="Painting steps"><button type="button" data-phase="white">1. White base</button><button type="button" data-phase="colour">2. Choose colour</button></div><p class="ap-instruction"></p><button class="ap-prepare" type="button" data-action="prepare">Prepare white walls</button><div class="ap-colour-options" hidden><div class="ap-quick-swatches" role="group" aria-label="Choose a paint colour"></div><details class="ap-palette"><summary>More colours</summary><div class="ap-palette-panel"><label>Find a colour<input type="search" aria-label="Find a paint shade" placeholder="Colour name or code"></label><div class="ap-palette-results"></div><button type="button" data-action="close-colours">Close</button></div></details></div><p class="ap-shade-name"></p>';
    controls.innerHTML =
      '<div class="ap-footer"><div class="ap-view" role="group" aria-label="Photo comparison"><button type="button" data-action="before">Before</button><button type="button" data-action="after">After</button></div><button type="button" class="ap-print" data-action="print">Print before &amp; after</button></div><p class="ap-feedback" role="status" aria-live="polite"></p>';
    const overlay = document.createElement("canvas"),
      oc = overlay.getContext("2d");
    overlay.className = "ap-selection";
    overlay.tabIndex = 0;
    overlay.setAttribute("aria-label", "Tap a wall to prepare or colour it.");
    stage.append(overlay);
    const find = (s) => toolbar.querySelector(s) || controls.querySelector(s),
      all = (s) => [
        ...toolbar.querySelectorAll(s),
        ...controls.querySelectorAll(s),
      ];
    let original = null,
      base = null,
      after = null,
      surfaces = [],
      regions = [],
      selected = null,
      phase = "white",
      view = "after",
      enabled = true,
      busy = false,
      encoded = false,
      destroyed = false,
      generation = 0,
      worker = null,
      sequence = 0,
      requestSequence = 0,
      history = [],
      palette = [],
      resized = [1024, 1024],
      gesture = null;
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
    const cloneState = () => ({ surfaces: [...surfaces], selected, phase });
    const remember = () => {
      history.push(cloneState());
      if (history.length > 8) history.shift();
    };
    const notify = () =>
      onChange({
        canUndo: history.length > 0,
        colors: surfaces
          .filter((s) => s.hex)
          .map((s) => ({ hex: s.hex, name: s.name })),
      });
    const selectedSurface = () => surfaces.find((s) => s.id === selected);
    const photoPoint = (e) => {
      const r = overlay.getBoundingClientRect();
      return [
        ((e.clientX - r.left) * overlay.width) / r.width,
        ((e.clientY - r.top) * overlay.height) / r.height,
      ];
    };
    const pixel = (p) =>
      clamp(Math.floor(p[1]), 0, original.height - 1) * original.width +
      clamp(Math.floor(p[0]), 0, original.width - 1);
    function refresh() {
      const ready = !!original && enabled;
      all("button").forEach((b) => (b.disabled = !ready || busy));
      all("[data-phase]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.phase === phase));
        if (b.dataset.phase === "colour")
          b.disabled = !ready || busy || !surfaces.length;
      });
      const action = find('[data-action="prepare"]');
      action.hidden =
        phase === "colour" || (!busy && encoded && !surfaces.length);
      action.textContent = busy
        ? "Preparing your photo…"
        : surfaces.length
          ? "Next: choose a colour"
          : "Prepare white walls";
      find(".ap-colour-options").hidden = phase !== "colour";
      all("[data-colour]").forEach((b) => {
        b.disabled = !ready || busy || phase !== "colour" || !selectedSurface();
        b.setAttribute(
          "aria-pressed",
          String(
            !!selectedSurface() &&
              (selectedSurface().hex || "#ffffff") ===
                palette[+b.dataset.colour]?.hex,
          ),
        );
      });
      find(".ap-instruction").textContent =
        phase === "white"
          ? encoded
            ? "Tap each wall to make it white. Tap a white wall again to remove it."
            : "Start with a clean white base for your walls."
          : selectedSurface()
            ? "Choose a colour for this wall."
            : "Tap a white wall in the photo, then choose its colour.";
      all('[data-action="before"],[data-action="after"]').forEach((b) => {
        b.disabled = !ready;
        b.setAttribute("aria-pressed", String(view === b.dataset.action));
      });
      find('[data-action="print"]').disabled =
        !ready || busy || !surfaces.length;
      find(".ap-shade-name").textContent = selectedSurface()?.name || "";
      overlay.hidden = !ready;
      overlay.dataset.mode = phase;
      toolbar.hidden = controls.hidden = !enabled;
      draw();
    }
    function draw() {
      oc.clearRect(0, 0, overlay.width, overlay.height);
      if (!original || view === "before" || phase === "white") return;
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
    }
    function render(rebuild = false) {
      if (!original) return;
      if (rebuild || !base) base = whiteWallBase(original, surfaces);
      after = renderWhitePreview(base, surfaces);
      const shown =
        view === "before" ? original : phase === "white" ? base : after;
      ctx.putImageData(
        new ImageData(
          new Uint8ClampedArray(shown.data),
          shown.width,
          shown.height,
        ),
        0,
        0,
      );
      refresh();
      notify();
    }
    function normalize(values) {
      const items = Array.isArray(values)
        ? values
            .slice(0, 5000)
            .filter(
              (s) =>
                s &&
                typeof s.name === "string" &&
                /^#[0-9a-f]{6}$/i.test(s.hex),
            )
            .map((s) => ({
              hex: s.hex.toLowerCase(),
              name: s.name,
              code: s.code || "",
            }))
        : [];
      return [
        { hex: "#ffffff", name: "White base", code: "" },
        ...items.filter((s) => s.hex !== "#ffffff"),
      ];
    }
    function renderPalette() {
      const quick = find(".ap-quick-swatches"),
        results = find(".ap-palette-results"),
        query = find('[aria-label="Find a paint shade"]')
          .value.trim()
          .toLowerCase();
      quick.replaceChildren();
      results.replaceChildren();
      const preferred = [
        ...palette.filter((s) => {
          const v = [1, 3, 5].map((i) => parseInt(s.hex.slice(i, i + 2), 16));
          return (
            Math.max(...v) - Math.min(...v) < 100 &&
            v.reduce((a, b) => a + b) / 3 > 130
          );
        }),
        ...palette,
      ];
      const used = new Set();
      function button(item, compact) {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.colour = String(palette.indexOf(item));
        b.setAttribute(
          "aria-label",
          item.name + (item.code ? " (" + item.code + ")" : ""),
        );
        b.title = b.getAttribute("aria-label");
        const chip = document.createElement("i");
        chip.style.background = item.hex;
        b.append(chip);
        if (!compact) {
          const label = document.createElement("span");
          label.textContent = b.title;
          b.append(label);
        } else b.className = "ap-swatch";
        return b;
      }
      for (const item of preferred) {
        if (used.size >= 5) break;
        if (!used.has(item.hex)) {
          used.add(item.hex);
          quick.append(button(item, true));
        }
      }
      for (const item of palette
        .filter((s) =>
          (s.name + " " + s.code + " " + s.hex).toLowerCase().includes(query),
        )
        .slice(0, 48))
        results.append(button(item, false));
      refresh();
    }
    function stopWorker() {
      if (worker) worker.terminate();
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
            job.reject(
              Error(
                "Wall selection could not load. Try again or choose a room photo.",
              ),
            );
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
      const c = document.createElement("canvas"),
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
      encoded = true;
    }
    async function prepare() {
      if (!original || busy) return;
      if (regions.length && !surfaces.length) {
        remember();
        surfaces = regions.map((r, i) => ({
          id: ++sequence,
          mask: r.mask,
          hex: null,
          name: "",
        }));
        phase = "colour";
        view = "after";
        render(true);
        return;
      }
      if (surfaces.length) {
        phase = "colour";
        selected = null;
        view = "after";
        render();
        report("Tap a white wall and choose a colour.");
        return;
      }
      const token = generation;
      busy = true;
      refresh();
      try {
        await encode();
        if (token !== generation || destroyed) return;
        report("Tap the centre of each wall to make it white.");
        viewport.scrollIntoView({ block: "start", behavior: "instant" });
      } catch (error) {
        if (token === generation && error.name !== "AbortError")
          report(error.message);
      } finally {
        if (token === generation) {
          busy = false;
          refresh();
        }
      }
    }
    async function tap(point) {
      if (!original || !enabled || busy) return;
      view = "after";
      onBeforeSelect();
      const hit = [...surfaces]
        .reverse()
        .find((s) => s.mask[pixel(point)] >= 128);
      if (phase === "colour") {
        selected = hit?.id ?? null;
        render();
        report(
          hit
            ? "Choose a colour for the selected wall."
            : "Use White base to prepare this wall first.",
        );
        return;
      }
      if (hit) {
        remember();
        surfaces = surfaces.filter((s) => s.id !== hit.id);
        selected = null;
        render(true);
        report(
          "Wall removed from the white base. Tap another wall to prepare it.",
        );
        return;
      }
      if (surfaces.length >= 16)
        return report(
          "Sixteen surfaces are prepared. Tap a white surface to remove it.",
        );
      const token = generation;
      busy = true;
      refresh();
      try {
        let mask = regions.find((r) => r.mask[pixel(point)] >= 128)?.mask;
        if (!mask) {
          await encode();
          if (token !== generation || destroyed) return;
          report("Finding this wall…");
          const result = await request("select", {
            point: [
              (point[0] * resized[0]) / original.width,
              (point[1] * resized[1]) / original.height,
            ],
          });
          if (token !== generation || destroyed) return;
          mask = modelWallMask(
            original,
            result.masks,
            result.scores,
            resized,
            point,
          );
        }
        for (const s of surfaces) mask = subtractMask(mask, s.mask);
        if (!mask.some((v) => v >= 128))
          throw Error("That wall is already prepared. Tap another surface.");
        remember();
        surfaces = [...surfaces, { id: ++sequence, mask, hex: null, name: "" }];
        selected = null;
        render(true);
        report(
          "Wall prepared in white. Tap another wall, or continue to colours.",
        );
      } catch (error) {
        if (token === generation && error.name !== "AbortError")
          report(error.message);
      } finally {
        if (token === generation) {
          busy = false;
          refresh();
        }
      }
    }
    function applyColour(value, notifyHost = true) {
      const wall = selectedSurface();
      if (
        !wall ||
        phase !== "colour" ||
        busy ||
        !/^#[0-9a-f]{6}$/i.test(value.hex)
      )
        return;
      const hex =
        value.hex.toLowerCase() === "#ffffff" ? null : value.hex.toLowerCase();
      if (wall.hex !== hex) {
        remember();
        surfaces = surfaces.map((s) =>
          s.id === wall.id ? { ...s, hex, name: value.name } : s,
        );
        view = "after";
        render();
      }
      if (notifyHost) onSelectShade(value);
      find(".ap-palette").open = false;
      report(value.name + " applied to the selected wall.");
      viewport.scrollIntoView({ block: "start", behavior: "instant" });
    }
    const action = (event) => {
      const b = event.target.closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.colour !== undefined) {
        applyColour(palette[+b.dataset.colour]);
        return;
      }
      if (b.dataset.phase) {
        phase = b.dataset.phase;
        selected = null;
        view = "after";
        render();
        return;
      }
      switch (b.dataset.action) {
        case "prepare":
          void prepare();
          break;
        case "before":
        case "after":
          view = b.dataset.action;
          render();
          break;
        case "close-colours":
          find(".ap-palette").open = false;
          break;
        case "print":
          void printComparison(
            original,
            after,
            surfaces.filter((s) => s.hex),
          ).catch(() =>
            report("The print view could not open. Please try again."),
          );
          break;
      }
    };
    listen(toolbar, "click", action);
    listen(controls, "click", action);
    listen(find('[aria-label="Find a paint shade"]'), "input", renderPalette);
    listen(overlay, "pointerdown", (e) => {
      if (e.isPrimary && e.button === 0)
        gesture = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    listen(overlay, "pointerup", (e) => {
      const start = gesture;
      gesture = null;
      if (
        start &&
        start.id === e.pointerId &&
        Math.hypot(start.x - e.clientX, start.y - e.clientY) < 8
      )
        void tap(photoPoint(e));
    });
    listen(overlay, "pointercancel", () => {
      gesture = null;
    });
    listen(overlay, "keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        api.undo();
      } else if (e.key === "Enter") {
        e.preventDefault();
        void tap([overlay.width / 2, overlay.height / 2]);
      }
    });
    listen(document, "pointerdown", (e) => {
      if (!toolbar.contains(e.target)) find(".ap-palette").open = false;
    });
    const api = {
      setImage(image, { roomId = null } = {}) {
        size(image.width, image.height);
        if (image.data.length !== image.width * image.height * 4)
          throw Error("This photo could not be read.");
        generation++;
        stopWorker();
        busy = false;
        enabled = true;
        original = {
          width: image.width,
          height: image.height,
          data: new Uint8ClampedArray(image.data),
        };
        regions = presetWallRegions(image.width, image.height, roomId);
        surfaces = regions.map((r, i) => ({
          id: i + 1,
          mask: r.mask,
          hex: null,
          name: "",
        }));
        sequence = surfaces.length + 1;
        selected = null;
        history = [];
        phase = regions.length ? "colour" : "white";
        view = "after";
        encoded = false;
        overlay.width = image.width;
        overlay.height = image.height;
        stage.style.width =
          "min(100%, " + (image.width / image.height) * 64 + "dvh)";
        stage.style.marginInline = "auto";
        base = null;
        render(true);
        report(
          regions.length
            ? "White base ready. Tap a wall and choose a colour."
            : "Prepare a white base first, then choose colours for your walls.",
        );
      },
      undo() {
        if (busy || !history.length) return;
        const saved = history.pop();
        surfaces = saved.surfaces;
        selected = saved.selected;
        phase = saved.phase;
        view = "after";
        render(true);
        report("Last change undone.");
      },
      reset() {
        if (!original || busy) return;
        remember();
        surfaces = surfaces.map((s) => ({ ...s, hex: null, name: "" }));
        selected = null;
        phase = "white";
        view = "after";
        render(true);
      },
      setEnabled(value) {
        if (!value) {
          generation++;
          stopWorker();
          busy = false;
        }
        enabled = value;
        refresh();
      },
      setComparison(value) {
        view = value ? "before" : "after";
        render();
      },
      shadeChanged() {
        if (original && enabled) applyColour(shade(), false);
      },
      setSwatches(values) {
        palette = normalize(values);
        renderPalette();
      },
      destroy() {
        destroyed = true;
        generation++;
        stopWorker();
        listeners.forEach((remove) => remove());
        overlay.remove();
        toolbar.replaceChildren();
        controls.replaceChildren();
        if (ownsToolbar) toolbar.remove();
        stage.style.width = "";
        stage.style.marginInline = "";
        original = base = after = null;
        surfaces = [];
        history = [];
      },
    };
    palette = normalize(swatches);
    renderPalette();
    refresh();
    return api;
  }
  globalThis.ArevaPaintStudio = Object.freeze({
    version: 6,
    polygonMask,
    subtractMask,
    connectedMask,
    paintImage,
    validPolygon,
    brushMask,
    composeImage,
    boxCorners,
    moveAreaCorner,
    presetWallRegions,
    whiteWallBase,
    renderWhitePreview,
    cleanWallMask,
    refineWallBoundary,
    modelWallMask,
    printComparison,
    createEditor,
  });
})();
