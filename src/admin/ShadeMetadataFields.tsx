import React from "react";
import {
  COLOUR_FAMILIES,
  SHADE_TONES,
  type ShadeFamily,
  type ShadeTone,
} from "../data/shadeFamilies";
export function ShadeMetadataFields({
  family,
  tones = [],
  onChange,
  allowAll = false,
  label = "",
  disabled = false,
}: {
  family: string;
  tones?: ShadeTone[];
  onChange: (family: ShadeFamily | "All Shades", tones: ShadeTone[]) => void;
  allowAll?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="adm-shade-metadata">
      <label className="adm-field">
        <span>{label ? `${label} colour family` : "Colour family"}</span>
        <select
          aria-label={label ? `${label} colour family` : "Colour family"}
          disabled={disabled}
          value={family}
          onChange={(e) =>
            onChange(e.target.value as ShadeFamily | "All Shades", tones)
          }
        >
          {[...(allowAll ? ["All Shades"] : []), ...COLOUR_FAMILIES].map(
            (f) => (
              <option key={f}>{f}</option>
            ),
          )}
        </select>
      </label>
      <fieldset className="adm-shade-tones" disabled={disabled}>
        <legend>{label ? `${label} tone tags` : "Tone tags"}</legend>
        {SHADE_TONES.map((t) => (
          <label key={t}>
            <input
              type="checkbox"
              checked={tones.includes(t)}
              onChange={(e) =>
                onChange(
                  family as ShadeFamily | "All Shades",
                  e.target.checked
                    ? [...tones, t]
                    : tones.filter((value) => value !== t),
                )
              }
            />
            {t}
          </label>
        ))}
        <small>Optional; a shade can belong to more than one tone.</small>
      </fieldset>
    </div>
  );
}
