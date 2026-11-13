import type { ColorShade } from "../types";
import {
  COLOUR_FAMILIES,
  SHADE_TONES,
  type ShadeFamily,
  type ShadeTone,
} from "../data/shadeFamilies";
export { COLOUR_FAMILIES } from "../data/shadeFamilies";
export function parseColourRows(
  text: string,
  defaults: { family: ShadeFamily; tones: ShadeTone[] } = {
    family: "Classic Neutrals",
    tones: [],
  },
): { colours: ColorShade[]; rejected: number } {
  const colours: ColorShade[] = [];
  let rejected = 0;
  for (const line of text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)) {
    const match =
      line.match(
        /^(.+?)\s*[,;|\t]\s*([A-Za-z0-9][A-Za-z0-9 _-]{0,39})\s*[,;|\t]\s*(#[a-f0-9]{6})(?:\s*[,;|\t]\s*(.+))?\s*$/i,
      ) ||
      line.match(
        /^(.+?)\s+([A-Za-z0-9][A-Za-z0-9_-]{0,39})\s+(#[a-f0-9]{6})\s*$/i,
      );
    if (!match || match[1].trim().length > 150) {
      rejected++;
      continue;
    }
    let family = defaults.family,
      tones = [...defaults.tones];
    if (match[4]) {
      const [familyText, ...toneText] = match[4].split(/\s*[|;\t,]\s*/);
      const found = COLOUR_FAMILIES.find(
        (f) => f.toLowerCase() === familyText.trim().toLowerCase(),
      );
      const tags = toneText
        .join("+")
        .split(/[+/]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const parsed = tags.map((t) =>
        SHADE_TONES.find((value) => value.toLowerCase() === t.toLowerCase()),
      );
      if (
        !found ||
        parsed.some((t) => !t) ||
        new Set(parsed).size !== parsed.length
      ) {
        rejected++;
        continue;
      }
      family = found;
      if (toneText.length) tones = parsed as ShadeTone[];
    }
    colours.push({
      name: match[1].trim(),
      code: match[2].trim().toUpperCase(),
      hex: match[3].toUpperCase(),
      family,
      tones,
      goesWellWith: [],
    });
    if (colours.length > 5000)
      throw Error("Import up to 5,000 colours at a time.");
  }
  return { colours, rejected };
}
