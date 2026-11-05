import type { ColorShade } from "../types";
export const COLOUR_FAMILIES: ColorShade["family"][] = [
  "Warm Neutrals",
  "Earthy & Clay",
  "Coastal & Blues",
  "Lush Greens",
  "Vibrant Accents",
  "Urban Greys",
];
export function parseColourRows(text: string): {
  colours: ColorShade[];
  rejected: number;
} {
  const colours: ColorShade[] = [];
  let rejected = 0;
  for (const line of text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)) {
    const match =
      line.match(
        /^(.+?)\s*[,;|\t]\s*([A-Za-z0-9][A-Za-z0-9 _-]{0,39})\s*[,;|\t]\s*(#[a-f0-9]{6})\s*$/i,
      ) ||
      line.match(
        /^(.+?)\s+([A-Za-z0-9][A-Za-z0-9_-]{0,39})\s+(#[a-f0-9]{6})\s*$/i,
      );
    if (!match || match[1].trim().length > 150) {
      rejected++;
      continue;
    }
    colours.push({
      name: match[1].trim(),
      code: match[2].trim().toUpperCase(),
      hex: match[3].toUpperCase(),
      family: "Warm Neutrals",
      goesWellWith: [],
    });
    if (colours.length > 5000)
      throw Error("Import up to 5,000 colours at a time.");
  }
  return { colours, rejected };
}
