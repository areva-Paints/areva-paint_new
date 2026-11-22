/*
 * Generate private final-decision PDFs from saved registration/review snapshots with Unicode fonts, wrapping and pagination.
 * No PDF contents are published to public CMS APIs.
 */
import PDFDocument from "pdfkit";
import * as fontkit from "fontkit";
import { fileURLToPath } from "node:url";
import {
  WARRANTY_STATUSES,
  type WarrantyRegistration,
} from "../warranty/types";

const fontNames = [
  "NotoSans-Regular",
  "NotoSansDevanagari-Regular",
  "NotoSansKannada-Regular",
  "NotoSansTamil-Regular",
  "NotoSansTelugu-Regular",
  "NotoSansSymbols2-Regular",
];
const paths = Object.fromEntries(
  [...fontNames, "NotoSans-Bold"].map((name) => [
    name,
    fileURLToPath(
      new URL("../../assets/fonts/" + name + ".ttf", import.meta.url),
    ),
  ]),
);
let coverage:
  | Array<{ name: string; hasGlyphForCodePoint: (code: number) => boolean }>
  | undefined;
/* Cache glyph coverage from committed Unicode fonts for report text fallback. */
function fonts() {
  return (coverage ??= fontNames.map((name) => {
    const font = fontkit.openSync(paths[name]) as any;
    return { name, hasGlyphForCodePoint: font.hasGlyphForCodePoint.bind(font) };
  }));
}
/* Split text into font-compatible runs so customer names and symbols remain readable. */
function runs(value: string) {
  const result: Array<{ font: string; text: string }> = [];
  for (const character of value.replace(/\r\n?/g, "\n")) {
    const code = character.codePointAt(0)!;
    const previous = result.at(-1);
    let font: string | undefined,
      text = character;
    if (/[\n\t ]/.test(character) || code === 0x200c || code === 0x200d)
      font = previous?.font || fontNames[0];
    else
      font = fonts().find((candidate) =>
        candidate.hasGlyphForCodePoint(code),
      )?.name;
    if (!font) {
      font = fontNames[0];
      text = "[U+" + code.toString(16).toUpperCase() + "]";
    }
    if (previous?.font === font) previous.text += text;
    else result.push({ font, text });
  }
  return result.length ? result : [{ font: fontNames[0], text: "—" }];
}
/* Format report timestamps in the intended customer-facing timezone. */
const date = (value: string) =>
  value
    ? new Date(
        value.length === 10 ? value + "T12:00:00Z" : value,
      ).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        ...(value.length === 10
          ? {}
          : { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      }) + (value.length === 10 ? "" : " IST")
    : "Not recorded";

/** A private report of the saved snapshot, never a fresh lookup of catalogue data. */
export async function createWarrantyPdf(
  row: WarrantyRegistration,
): Promise<Buffer> {
  const created = new Date(row.reviewedAt || row.createdAt);
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 128, bottom: 56, left: 44, right: 44 },
    bufferPages: true,
    info: {
      Title: "Areva Paints - Warranty Registration Decision",
      Author: "Areva Paints",
      Subject: row.reference,
      CreationDate: created,
      ModDate: created,
    },
  });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  try {
    for (const name of [...fontNames, "NotoSans-Bold"])
      doc.registerFont(name, paths[name]);
    const width = doc.page.width - 88;
    /* Restore the report body font, size and colour after a heading or page break. */
    const body = () =>
      doc.font(fontNames[0]).fontSize(9.5).fillColor("#30233b");
    /* Start another page before the next block would overflow. */
    function room(height: number) {
      if (doc.y + height > doc.page.height - 56) doc.addPage();
    }
    /* Wrap and render report text while tracking the available page height. */
    function text(value: string) {
      const parts = runs(value);
      parts.forEach((part, index) =>
        doc
          .font(part.font)
          .fontSize(9.5)
          .fillColor("#30233b")
          .text(part.text, {
            width,
            continued: index < parts.length - 1,
            lineGap: 2,
          }),
      );
    }
    /* Start a clearly separated report section with enough space for its first field. */
    function heading(label: string) {
      room(54);
      doc
        .moveDown(0.7)
        .font("NotoSans-Bold")
        .fontSize(12)
        .fillColor("#552e81")
        .text(label);
      doc.moveDown(0.55);
    }
    /* Render one labelled snapshot value, preserving line wrapping and empty-value handling. */
    function field(label: string, value: unknown) {
      room(43);
      doc
        .font(fontNames[0])
        .fontSize(8)
        .fillColor("#817189")
        .text(label.toUpperCase(), { width });
      doc.moveDown(0.15);
      text(
        value === undefined || value === null || value === ""
          ? "Not provided"
          : String(value),
      );
      body().moveDown(0.65);
    }
    body();
    field("Registration reference", row.reference);
    field("Decision", WARRANTY_STATUSES[row.status]);
    field("Reviewed by", row.reviewedBy || "Not recorded");
    field(
      "Review date",
      row.reviewedAt ? date(row.reviewedAt) : "Not recorded",
    );
    field("Review notes", row.reviewNotes);
    field(
      "Purchase and receipt review confirmation",
      row.approvalConfirmed
        ? "Confirmed by reviewing admin"
        : "Not confirmed / not applicable",
    );
    heading("Customer and application site");
    [
      ["Customer name", row.customerName],
      ["Primary mobile number", row.mobile],
      ["Login phone number", row.loginMobile || row.mobile],
      ["Email address", row.email],
      ["Alternate mobile", row.alternateMobile],
      ["Site address", row.siteAddress],
      ["Site city", row.city],
      ["Site state", row.state],
      ["Site PIN code", row.pinCode],
    ].forEach(([label, value]) => field(label, value));
    heading("Product and purchase");
    [
      ["Product name", row.productName],
      ["Product type", row.categoryName],
      ["Product ID", row.productId],
      ["Category ID", row.categoryId],
      ["Date of purchase", date(row.purchaseDate)],
      ["Quantity (packs)", row.quantity],
      ["Pack size / unit", row.packSize],
      ["Batch / lot number", row.batchNumber],
      ["Shade name / code", row.shade],
      [
        "Configured product warranty",
        row.warrantyYears > 0
          ? row.warrantyYears + " year(s)"
          : "To be confirmed",
      ],
      ["Warranty label", row.warrantyLabel],
      [
        "Warranty start / end dates",
        "Not assigned by this registration report",
      ],
    ].forEach(([label, value]) => field(label, value));
    heading("Dealer, invoice and attached receipt");
    [
      ["Dealer / shop name", row.dealerName],
      ["Dealer ID", row.dealerId],
      ["Dealer phone", row.dealerPhone],
      ["Dealer address", row.dealerAddress],
      ["Dealer city", row.dealerCity],
      ["Purchase invoice number", row.invoiceNumber],
      ["Attached receipt name", row.receipt.name],
      ["Receipt file type", row.receipt.mime],
      ["Receipt size (bytes)", String(row.receipt.bytes)],
      ["Receipt ID", row.receipt.id],
    ].forEach(([label, value]) => field(label, value));
    heading("Application and additional information");
    [
      [
        "Application completion date",
        row.applicationDate ? date(row.applicationDate) : "",
      ],
      ["Painted area (sq ft)", row.paintedArea],
      ["Painter / applicator name", row.applicatorName],
      ["Painter / applicator phone", row.applicatorPhone],
      ["Additional details", row.notes],
    ].forEach(([label, value]) => field(label, value));
    if (row.sitePhotos?.length) {
      heading("Building photos");
      field("Photo attachments", row.sitePhotos.length);
      row.sitePhotos.forEach((photo, index) =>
        field(
          "Building photo " + (index + 1),
          photo.name + " · " + photo.mime + " · " + photo.bytes + " bytes",
        ),
      );
      field(
        "Photo access",
        "Private attachments available to signed-in admins with this registration.",
      );
    }
    heading("Registration and verification");
    field("Submitted on", date(row.createdAt));
    field("Registration ID", row.id);
    field("Record version", row.version);
    field(
      "Accuracy / contact consent",
      row.consent ? "Confirmed at submission" : "Not confirmed",
    );
    field("Verification mode", row.verificationMode);
    field(
      "Mobile ownership verified",
      row.mobileVerified
        ? "Yes"
        : "No — demo OTP does not verify mobile ownership",
    );
    heading("Review history");
    if (!row.reviewHistory?.length)
      field("History", "No historical reviews recorded");
    for (const [index, review] of (row.reviewHistory || []).entries()) {
      field(
        "Review " + (index + 1),
        WARRANTY_STATUSES[review.status] +
          " · " +
          review.actor +
          " · " +
          date(review.at),
      );
      field("Review notes", review.notes);
      field(
        "Purchase review confirmed",
        review.approvalConfirmed ? "Yes" : "No / not applicable",
      );
    }
    room(55);
    text(
      "This report records the saved registration details and admin decision. The payment receipt remains a separate private attachment. This report does not assign warranty dates or verify the mobile number.",
    );
    // Draw page furniture last, so automatic page breaks cannot change body font state.
    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page++) {
      doc.switchToPage(page);
      doc.image(
        fileURLToPath(
          new URL(
            "../../public/assets/images/areva-brand-logo.png",
            import.meta.url,
          ),
        ),
        44,
        28,
        { fit: [90, 65] },
      );
      doc
        .font("NotoSans-Bold")
        .fontSize(17)
        .fillColor("#3c165b")
        .text("Warranty registration", 158, 38, { width: 390 });
      doc
        .font(fontNames[0])
        .fontSize(10)
        .fillColor("#786383")
        .text(
          "Private decision report · " + WARRANTY_STATUSES[row.status],
          158,
          66,
          { width: 390 },
        );
      doc
        .moveTo(44, 108)
        .lineTo(doc.page.width - 44, 108)
        .lineWidth(1.2)
        .strokeColor("#d6aa4a")
        .stroke();
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font(fontNames[0])
        .fontSize(8)
        .fillColor("#8d7b95")
        .text(
          "AREVA PAINTS · Private registration record",
          44,
          doc.page.height - 35,
          { width: 400, lineBreak: false },
        );
      doc.text(
        page - range.start + 1 + " / " + range.count,
        doc.page.width - 100,
        doc.page.height - 35,
        { width: 56, align: "right", lineBreak: false },
      );
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  } catch (error) {
    doc.destroy();
    throw error;
  }
  return finished;
}
