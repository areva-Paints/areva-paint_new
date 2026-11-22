/*
 * Normalize searchable warranty snapshots and dates so multiword searches work across customer, login phone, purchase, dealer and review fields.
 */
import {
  WARRANTY_STATUSES,
  type WarrantyRegistration,
} from "../warranty/types";

/* Normalize case, punctuation and whitespace for consistent warranty matching. */
const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const readableDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});
/* Expose searchable date variants without modifying the saved purchase date. */
function dateText(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? readableDate.format(parsed) : "";
}

// Search customer-visible values, never JSON property names or private upload keys.
// Each word may match a different field, as in "Pune approved".
/* Match every search term across the normalized registration and review snapshot. */
export function warrantySearch(search: string) {
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  return (row: WarrantyRegistration): boolean => {
    if (!terms.length) return true;
    const values = [
      row.reference,
      row.customerName,
      row.mobile,
      row.loginMobile || row.mobile,
      row.email,
      row.alternateMobile,
      row.productName,
      row.categoryName,
      row.warrantyLabel,
      row.warrantyYears ? String(row.warrantyYears) + " years" : "",
      row.purchaseDate,
      row.quantity,
      row.packSize,
      row.batchNumber,
      row.shade,
      row.dealerName,
      row.dealerPhone,
      row.dealerAddress,
      row.dealerCity,
      row.invoiceNumber,
      row.siteAddress,
      row.city,
      row.state,
      row.pinCode,
      row.applicationDate,
      row.paintedArea,
      row.applicatorName,
      row.applicatorPhone,
      row.notes,
      row.receipt.name,
      ...(row.sitePhotos ?? []).map((photo) => photo.name),
      WARRANTY_STATUSES[row.status],
      row.reviewNotes,
      row.reviewedBy,
      row.createdAt,
      row.reviewedAt || "",
      dateText(row.createdAt),
      dateText(row.purchaseDate),
      dateText(row.applicationDate),
      dateText(row.reviewedAt),
      ...row.reviewHistory.flatMap((review) => [
        WARRANTY_STATUSES[review.status],
        review.actor,
        review.notes,
        review.at,
        dateText(review.at),
      ]),
    ];
    // Also accept full phone numbers copied with spaces, brackets or hyphens.
    const phones = [
      row.mobile,
      row.loginMobile || row.mobile,
      row.alternateMobile,
      row.dealerPhone,
      row.applicatorPhone,
    ].map((phone) => phone.replace(/\D/g, ""));
    const text = normalize([...values, ...phones].join(" "));
    return terms.every((term) => text.includes(term));
  };
}
