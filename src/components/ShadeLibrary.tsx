import React, { useState } from "react";
import type { ColorShade } from "../types";
import type { ShadeCard } from "../admin/content-types";
import {
  SHADE_FAMILIES,
  SHADE_TONES,
  filterShades,
} from "../data/shadeFamilies";

interface FilterProps {
  shades: ColorShade[];
  family: string;
  tone: string;
  query: string;
  onFamily: (family: string) => void;
  onTone: (tone: string) => void;
  onQuery: (query: string) => void;
  legacy?: boolean;
}

export function ColourCollectionHeading({ total }: { total: number }) {
  return (
    <div className="colour-collection-heading">
      <div>
        <p className="colour-collection-kicker">THE AREVA COLOUR COLLECTION</p>
        <h2 className="colour-collection-title">Explore the Colour Spectrum</h2>
        <p className="colour-collection-description">
          Browse by colour family, filter by tone and select a shade to preview.
        </p>
      </div>
      <strong className="colour-collection-count">
        {total} original shades
      </strong>
    </div>
  );
}
export function ShadeFilters({
  shades,
  family,
  tone,
  query,
  onFamily,
  onTone,
  onQuery,
  legacy,
}: FilterProps) {
  return (
    <>
      <div className="shade-families" role="group" aria-label="Colour families">
        {[{ name: "All Shades", color: "#79218c" }, ...SHADE_FAMILIES].map(
          (f) => (
            <button
              key={f.name}
              type="button"
              data-shade-family={f.name}
              aria-pressed={family === f.name}
              onClick={() => onFamily(f.name)}
            >
              <i style={{ backgroundColor: f.color }} aria-hidden="true" />
              {f.name}
            </button>
          ),
        )}
      </div>
      <div className="shade-search-row">
        <input
          id={legacy ? "q" : undefined}
          className="shade-search"
          type="search"
          aria-label="Search shade name or code"
          placeholder="Search shade name or code…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <button
          type="button"
          data-shade-reset
          onClick={() => {
            onFamily("All Shades");
            onTone("All");
            onQuery("");
          }}
        >
          Reset filters
        </button>
      </div>
      <div className="shade-tones-panel">
        <h3 data-shade-family-heading>{family}</h3>
        <div className="shade-tones" role="group" aria-label="Shade tones">
          {["All", ...SHADE_TONES].map((t) => (
            <button
              type="button"
              key={t}
              data-shade-tone={t}
              aria-pressed={tone === t}
              onClick={() => onTone(t)}
            >
              {t} ({filterShades(shades, family, t, query).length})
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
export function ShadeLibrary({
  shades,
  cards = [],
  onSelect,
  selectedHex = "",
  legacy = false,
}: {
  shades: ColorShade[];
  cards?: ShadeCard[];
  onSelect?: (hex: string, name: string) => void;
  selectedHex?: string;
  legacy?: boolean;
}) {
  const [family, setFamily] = useState("All Shades"),
    [tone, setTone] = useState("All"),
    [query, setQuery] = useState("");
  const filtered = filterShades(shades, family, tone, query);
  const pdfs = cards.filter(
    (c) =>
      (family === "All Shades" ||
        !c.family ||
        c.family === "All Shades" ||
        c.family === family) &&
      (tone === "All" || !c.tones?.length || c.tones.some((t) => t === tone)),
  );
  return (
    <div
      className="shade-library"
      data-shade-library
      aria-label="Colour shade library"
    >
      <ShadeFilters
        shades={shades}
        family={family}
        tone={tone}
        query={query}
        onFamily={(value) => {
          setFamily(value);
          setTone("All");
        }}
        onTone={setTone}
        onQuery={setQuery}
        legacy={legacy}
      />
      <p className="shade-result-count" role="status" data-shade-count>
        {filtered.length} shades found
      </p>
      <div className="shade-swatch-grid" id={legacy ? "sw" : undefined}>
        {filtered.map((s, i) => (
          <div className="shade-tile" key={s.code}>
            <button
              type="button"
              className="shade-swatch"
              data-c={legacy ? i : undefined}
              aria-pressed={selectedHex.toLowerCase() === s.hex.toLowerCase()}
              aria-label={`Apply ${s.name} (${s.code})`}
              onClick={() => onSelect?.(s.hex, s.name)}
            >
              <span className="shade-chip" style={{ backgroundColor: s.hex }} />
              <strong>{s.name}</strong>
              <small>{s.code}</small>
            </button>
            {legacy && (
              <button
                className="shade-save"
                type="button"
                data-h={i}
                aria-label={`Save ${s.name}`}
              >
                ♡
              </button>
            )}
          </div>
        ))}
      </div>
      {!filtered.length && (
        <p className="shade-empty">
          No shades match these filters. Try another family or reset the
          filters.
        </p>
      )}
      <div className="shade-pdfs" data-shade-pdfs hidden={!pdfs.length}>
        <h3>Download shade cards</h3>
        {pdfs.map((c) => (
          <a
            key={c.id}
            data-shade-pdf-family={c.family || "All Shades"}
            data-shade-pdf-tones={JSON.stringify(c.tones || [])}
            href={c.url}
            download
          >
            {c.title} <span>PDF · {c.family || "All Shades"}</span>
          </a>
        ))}
      </div>
      <p className="shade-disclaimer">
        Screen colours are a guide. Confirm your choice with a physical shade
        card.
      </p>
    </div>
  );
}
