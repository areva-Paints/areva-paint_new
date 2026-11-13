import type { ColorShade } from "../types";

export const SHADE_FAMILIES = [
  { name: "Oranges", color: "#f57714" },
  { name: "Yellows", color: "#f2d419" },
  { name: "Greens", color: "#37873c" },
  { name: "Blues", color: "#247ac6" },
  { name: "Violets", color: "#8220a5" },
  { name: "Earth Tones", color: "#ad8b6b" },
  { name: "Classic Neutrals", color: "#c6baa0" },
  { name: "Dark Accents", color: "#3d322f" },
  { name: "Whispering Whites", color: "#eeebe4" },
  { name: "Reds & Pinks", color: "#d94a75" },
] as const;
export type ShadeFamily = (typeof SHADE_FAMILIES)[number]["name"];
export const COLOUR_FAMILIES: ShadeFamily[] = SHADE_FAMILIES.map((f) => f.name);
export const SHADE_TONES = [
  "Cool",
  "Dark",
  "Light",
  "Pastel",
  "Vibrant",
  "Warm",
] as const;
export type ShadeTone = (typeof SHADE_TONES)[number];
export const LEGACY_SHADE_FAMILIES = [
  "Warm Neutrals",
  "Earthy & Clay",
  "Coastal & Blues",
  "Lush Greens",
  "Vibrant Accents",
  "Urban Greys",
];

/* One-time compatibility grouping of the old palette. New entries use explicit admin metadata. */
export function legacyGrouping(hex: string): {
  family: ShadeFamily;
  tones: ShadeTone[];
} {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min,
    light = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
  const hue =
    delta === 0
      ? 0
      : ((max === r
          ? (g - b) / delta
          : max === g
            ? (b - r) / delta + 2
            : (r - g) / delta + 4) *
          60 +
          360) %
        360;
  const family: ShadeFamily =
    light < 0.25
      ? "Dark Accents"
      : light > 0.89 && saturation < 0.55
        ? "Whispering Whites"
        : saturation < 0.18
          ? "Classic Neutrals"
          : hue >= 15 && hue < 65 && saturation < 0.55
            ? "Earth Tones"
            : hue < 15 || hue >= 325
              ? "Reds & Pinks"
              : hue < 45
                ? "Oranges"
                : hue < 75
                  ? "Yellows"
                  : hue < 170
                    ? "Greens"
                    : hue < 245
                      ? "Blues"
                      : "Violets";
  const tones: ShadeTone[] = [hue >= 75 && hue < 290 ? "Cool" : "Warm"];
  if (light < 0.3) tones.push("Dark");
  if (light >= 0.65) tones.push("Light");
  if (light >= 0.72 && saturation >= 0.15) tones.push("Pastel");
  if (saturation >= 0.5 && light >= 0.3 && light < 0.75) tones.push("Vibrant");
  return { family, tones };
}
export function normalizeShade<
  T extends { family: string; hex: string; tones?: readonly ShadeTone[] },
>(shade: T): T & { family: ShadeFamily; tones: ShadeTone[] } {
  const old = LEGACY_SHADE_FAMILIES.includes(shade.family),
    defaults = legacyGrouping(shade.hex);
  return {
    ...shade,
    family: (old ? defaults.family : shade.family) as ShadeFamily,
    tones: shade.tones ? [...shade.tones] : old ? defaults.tones : [],
  };
}
export function filterShades(
  shades: ColorShade[],
  family: string,
  tone: string,
  query: string,
): ColorShade[] {
  const search = query.trim().toLocaleLowerCase();
  return shades.filter(
    (s) =>
      (family === "All Shades" || s.family === family) &&
      (tone === "All" || s.tones?.includes(tone as ShadeTone)) &&
      `${s.name} ${s.code}`.toLocaleLowerCase().includes(search),
  );
}
