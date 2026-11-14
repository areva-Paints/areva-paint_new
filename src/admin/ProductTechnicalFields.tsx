import React, { useId, useState } from "react";
import type { Product } from "../types";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactElement<any>;
}) {
  const id = useId();
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, {
        id,
        "aria-describedby": hint ? id + "-hint" : undefined,
      })}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
function CommaList({
  label,
  values,
  onChange,
  numeric = false,
  max = 30,
  maxItem = 100,
}: {
  label: string;
  values: string[] | number[];
  onChange: (values: any[]) => void;
  numeric?: boolean;
  max?: number;
  maxItem?: number;
}) {
  const [raw, setRaw] = useState(values.join(", "));
  return (
    <Field
      label={label}
      hint={
        numeric
          ? "Numbers separated by commas, for example 1, 4, 10, 20. Used by the calculator."
          : "Separate values with commas. Leave blank to use the default or omit this detail."
      }
    >
      <input
        value={raw}
        required={numeric}
        maxLength={4000}
        onChange={(event) => {
          const value = event.target.value,
            entries = value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
          setRaw(value);
          const valid =
            entries.length <= max &&
            entries.every((v) => v.length <= maxItem) &&
            (!numeric ||
              (entries.length > 0 &&
                entries.every(
                  (v) =>
                    Number.isFinite(Number(v)) &&
                    Number(v) > 0 &&
                    Number(v) <= 1000,
                )));
          event.currentTarget.setCustomValidity(
            valid
              ? ""
              : numeric
                ? "Enter 1–20 positive numeric pack sizes, each up to 1,000."
                : `Enter up to ${max} items, each up to ${maxItem} characters.`,
          );
          onChange(numeric ? entries.map(Number) : entries);
        }}
      />
    </Field>
  );
}
export function ProductTechnicalFields({
  product,
  onChange,
}: {
  product: Product;
  onChange: (change: Partial<Product>) => void;
}) {
  const specs = product.specs;
  const patch = (change: Partial<Product["specs"]>) =>
    onChange({ specs: { ...specs, ...change } });
  const textField = (
    key:
      | "coverageText"
      | "dilution"
      | "dryingTime"
      | "recoatTime"
      | "thinnedWith"
      | "warrantyLabel"
      | "surfacePreparation"
      | "applicationMethod",
    label: string,
    limit = 3000,
    hint?: string,
  ) => (
    <Field label={label} hint={hint}>
      <textarea
        rows={key === "surfacePreparation" ? 3 : 2}
        maxLength={limit}
        value={specs[key] || ""}
        onChange={(event) => patch({ [key]: event.target.value })}
      />
    </Field>
  );
  return (
    <section
      className="adm-product-technical"
      aria-label="Product technical details"
    >
      <h3>Product details and warranty</h3>
      <div className="adm-form-grid">
        {textField(
          "coverageText",
          "Coverage display text",
          300,
          "Optional range or wording, for example 240–260 sqft/litre/coat. The numeric coverage above still drives the calculator.",
        )}
        {textField(
          "dilution",
          "Dilution",
          300,
          "For example 200 ml/Ltr. Enter the display wording you need.",
        )}
        {textField("dryingTime", "Drying time")}
        {textField("recoatTime", "Recoat time")}
        {textField("thinnedWith", "Thinner / cleaning medium")}
        <CommaList
          key={product.id + "-bases"}
          label="Bases (comma-separated)"
          values={specs.bases || []}
          onChange={(bases) => patch({ bases })}
        />
        <CommaList
          key={product.id + "-packing"}
          label="Packing display (comma-separated)"
          values={specs.packing || []}
          max={20}
          onChange={(packing) => patch({ packing })}
        />
        <CommaList
          key={product.id + "-packs"}
          label="Calculator pack sizes (comma-separated)"
          values={product.availableSizes}
          numeric
          max={20}
          onChange={(availableSizes) => onChange({ availableSizes })}
        />
        <Field
          label="Product warranty (years)"
          hint="Enter 0 to hide the warranty badge."
        >
          <input
            type="number"
            min={0}
            max={100}
            step="any"
            required
            value={specs.warrantyYears}
            onChange={(event) =>
              patch({ warrantyYears: Number(event.target.value) })
            }
          />
        </Field>
        {textField(
          "warrantyLabel",
          "Warranty label",
          100,
          "Optional, for example Performance warranty*. Shown only when warranty years is greater than zero.",
        )}
        <CommaList
          key={product.id + "-surfaces"}
          label="Recommended surfaces (comma-separated)"
          values={specs.recommendedSurfaces}
          maxItem={200}
          onChange={(recommendedSurfaces) => patch({ recommendedSurfaces })}
        />
        {textField("applicationMethod", "Application method")}
        {textField("surfacePreparation", "Surface preparation")}
        <Field label="VOC level">
          <select
            value={product.vocLevel}
            onChange={(event) =>
              onChange({ vocLevel: event.target.value as Product["vocLevel"] })
            }
          >
            {["Zero VOC (<5g/L)", "Low VOC (<30g/L)", "Standard"].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </Field>
        <Field label="Washability">
          <select
            value={product.washability}
            onChange={(event) =>
              onChange({
                washability: event.target.value as Product["washability"],
              })
            }
          >
            {[
              "Class 1 (Scrubbable)",
              "High Washable",
              "Wipeable",
              "Specialist",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
      </div>
      <label className="adm-checkbox">
        <input
          type="checkbox"
          checked={product.tintable}
          onChange={(event) => onChange({ tintable: event.target.checked })}
        />
        Tintable product
      </label>
    </section>
  );
}
