/*
 * Validate and normalize document cards before persistence, including local PDF ownership, dates, product links, publication requirements and server-owned timestamps.
 */
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { DOCUMENT_TYPES, type CertificationDocument } from "./content-types";
import type { Product } from "../types";
import { dataDir } from "./content-store";

/* Require a plain object before reading document-card fields. */
const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
/* Validate a bounded text field before accepting it into a stored record. */
const text = (value: unknown, max: number, required = false): value is string =>
  typeof value === "string" &&
  value.length <= max &&
  (!required || !!value.trim());
/* Validate the bounded identifier used for local document records. */
const identifier = (value: unknown): value is string =>
  text(value, 100, true) && /^[\w-]+$/.test(value);
/* Reject duplicate identifiers before building a normalized document collection. */
const unique = (rows: unknown[]): boolean => {
  const ids = rows.map((row) => record(row) && row.id);
  return ids.every(identifier) && new Set(ids).size === rows.length;
};
/* Accept a real optional calendar date within the supported document range. */
function date(value: unknown): value is string {
  if (value === "") return true;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "1900-01-01" ||
    value > "2200-12-31"
  )
    return false;
  const parsed = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/* Normalize all document cards, validate their local attachments and preserve server-owned timestamps. */
export function prepareCertifications(
  input: unknown,
  previous: CertificationDocument[],
  products: Product[],
  previousProducts: Product[],
  now: string,
): CertificationDocument[] {
  if (!Array.isArray(input) || input.length > 100 || !unique(input))
    throw Error("Keep up to 100 document cards with unique identifiers.");
  const productIds = new Set(products.map((product) => product.id));
  const removedProducts = new Set(
    previousProducts
      .filter((product) => !productIds.has(product.id))
      .map((product) => product.id),
  );
  const attachmentIds = new Set<string>();
  return input.map((item) => {
    if (
      !record(item) ||
      !text(item.title, 150, true) ||
      !text(item.description, 2000, true) ||
      !Object.hasOwn(DOCUMENT_TYPES, item.type) ||
      !text(item.label, 80) ||
      !text(item.issuer, 200) ||
      !text(item.reference, 100) ||
      !date(item.issuedOn) ||
      !date(item.validUntil) ||
      (item.issuedOn && item.validUntil && item.issuedOn > item.validUntil) ||
      typeof item.published !== "boolean"
    )
      throw Error(
        "Each document needs a heading, description, valid type and dates. Valid until cannot be before the issue date.",
      );
    if (
      !Array.isArray(item.productIds) ||
      item.productIds.length > 200 ||
      new Set(item.productIds).size !== item.productIds.length ||
      !item.productIds.every(
        (id) =>
          typeof id === "string" &&
          (productIds.has(id) || removedProducts.has(id)),
      )
    )
      throw Error("Select valid linked products without duplicates.");
    if (
      !Array.isArray(item.attachments) ||
      item.attachments.length > 5 ||
      (item.published && !item.attachments.length) ||
      !unique(item.attachments)
    )
      throw Error(
        "Published cards need 1–5 PDF attachments. Hidden cards can be saved without attachments.",
      );
    const attachments = item.attachments.map((attachment) => {
      if (
        !record(attachment) ||
        !text(attachment.label, 150, true) ||
        !text(attachment.url, 2048) ||
        !/^\/uploads\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\.pdf$/.test(
          attachment.url,
        )
      )
        throw Error(
          "Each attachment needs a label and a PDF uploaded through this admin portal.",
        );
      if (attachmentIds.has(attachment.id))
        throw Error(
          "Attachment identifiers must be unique across document cards.",
        );
      attachmentIds.add(attachment.id);
      const file = path.join(dataDir, "uploads", path.basename(attachment.url));
      if (!fs.existsSync(file) || !fs.lstatSync(file).isFile())
        throw Error(
          "A document attachment is missing. Upload the PDF again before saving.",
        );
      return {
        id: attachment.id,
        label: attachment.label.trim(),
        url: attachment.url,
      };
    });
    const fields = {
      id: item.id,
      title: item.title.trim(),
      description: item.description.trim(),
      type: item.type,
      label: item.label.trim(),
      issuer: item.issuer.trim(),
      reference: item.reference.trim(),
      issuedOn: item.issuedOn,
      validUntil: item.validUntil,
      published: item.published,
      productIds: item.productIds.filter((id) => productIds.has(id)),
      attachments,
    };
    const old = previous.find((row) => row.id === item.id);
    const oldFields = old && (({ createdAt, updatedAt, ...rest }) => rest)(old);
    return {
      ...fields,
      createdAt: old?.createdAt || now,
      updatedAt:
        old && isDeepStrictEqual(fields, oldFields) ? old.updatedAt : now,
    };
  });
}
