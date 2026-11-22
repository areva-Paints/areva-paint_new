/* Regression coverage for saved decision reports and final-review integrity.
 * Fixtures use disposable local stores/databases; hosted customer records are not changed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createWarrantyPdf } from "../src/server/warranty-pdf.ts";

const record = () => ({
  id: "11111111-1111-4111-8111-111111111111",
  reference: "ARV-WR-20261115-TEST-REPORT",
  customerName: "José ₹ Review Customer",
  mobile: "+919000000000",
  loginMobile: "+919000000004",
  email: "private@example.test",
  alternateMobile: "9000000001",
  productId: "product-1",
  productName: "Snapshot Paint",
  categoryId: "interior",
  categoryName: "Interior Paints",
  warrantyYears: 12,
  warrantyLabel: "Performance warranty",
  purchaseDate: "2026-11-14",
  quantity: "2",
  packSize: "4 L",
  batchNumber: "BATCH-FINAL",
  shade: "Pearl White",
  dealerId: "dealer-1",
  dealerName: "Invoice Shop",
  dealerPhone: "9000000002",
  dealerAddress: "Dealer Road",
  dealerCity: "Pune",
  invoiceNumber: "INV-FINAL",
  siteAddress: "12 Private House",
  city: "Pune",
  state: "Maharashtra",
  pinCode: "411001",
  applicationDate: "2026-11-15",
  paintedArea: "450",
  applicatorName: "Test Painter",
  applicatorPhone: "9000000003",
  notes: "Original customer notes <img src=x>",
  consent: true,
  receipt: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "dealer-receipt.pdf",
    mime: "application/pdf",
    bytes: 1250,
  },
  sitePhotos: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Private building exterior.png",
      mime: "image/png",
      bytes: 2048,
    },
  ],
  verificationMode: "demo",
  mobileVerified: false,
  status: "approved",
  version: 2,
  reviewNotes:
    "Purchase and invoice reviewed. " +
    "Long review note. ".repeat(100) +
    "END-OF-REVIEW",
  reviewedBy: "review-admin",
  reviewedAt: "2026-11-15T04:00:00Z",
  approvalConfirmed: true,
  createdAt: "2026-11-15T03:30:00Z",
  reviewHistory: [
    {
      id: "event-1",
      status: "approved",
      actor: "review-admin",
      at: "2026-11-15T04:00:00Z",
      notes: "Saved history note",
      approvalConfirmed: true,
    },
  ],
});
async function extract(bytes) {
  const task = getDocument({ data: new Uint8Array(bytes) });
  try {
    const pdf = await task.promise;
    const texts = [];
    for (let i = 1; i <= pdf.numPages; i++)
      texts.push(
        (await (await pdf.getPage(i)).getTextContent()).items
          .filter((item) => "str" in item)
          .map((item) => item.str)
          .join(" "),
      );
    assert.equal(await pdf.getJSActions(), null);
    return { text: texts.join(" ").replace(/\s+/g, " "), pages: pdf.numPages };
  } finally {
    await task.destroy();
  }
}

test("decision PDF contains all saved fields and long review notes across branded pages", async () => {
  const row = record(),
    bytes = await createWarrantyPdf(row);
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  const { text, pages } = await extract(bytes);
  assert.ok(pages >= 3);
  assert.ok(pages < 15, "Pagination must not add unbounded empty pages");
  for (const value of [
    row.reference,
    "Private building exterior.png",
    "Building photos",
    row.customerName,
    row.mobile,
    row.loginMobile,
    "LOGIN PHONE NUMBER",
    "PURCHASE INVOICE NUMBER",
    row.email,
    row.alternateMobile,
    row.productName,
    row.categoryName,
    row.productId,
    row.categoryId,
    "12 year(s)",
    row.warrantyLabel,
    row.packSize,
    row.batchNumber,
    row.shade,
    row.dealerId,
    row.dealerName,
    row.dealerPhone,
    row.dealerAddress,
    row.dealerCity,
    row.invoiceNumber,
    row.siteAddress,
    row.city,
    row.state,
    row.pinCode,
    row.paintedArea,
    row.applicatorName,
    row.applicatorPhone,
    row.notes,
    row.receipt.id,
    row.receipt.name,
    row.receipt.mime,
    "1250",
    row.id,
    "Approved",
    "END-OF-REVIEW",
    "Saved history note",
    "review-admin",
    "Mobile ownership verified".toUpperCase(),
    "No — demo OTP does not verify mobile ownership",
  ])
    assert.ok(
      text.replace(/\s+/g, "").includes(value.replace(/\s+/g, "")),
      "Missing PDF content: " + value,
    );
  assert.ok(text.includes("15 Nov 2026"));
  assert.ok(text.includes("14 Nov 2026"));
  assert.ok(text.includes("IST"));
  assert.ok(text.includes("Private decision report"));
  const rejected = {
    ...row,
    status: "rejected",
    approvalConfirmed: false,
    reviewNotes: "Invoice rejected because purchase details do not match.",
    reviewHistory: [
      {
        ...row.reviewHistory[0],
        status: "rejected",
        approvalConfirmed: false,
        notes: "Rejected history",
      },
    ],
  };
  const result = await extract(await createWarrantyPdf(rejected));
  assert.ok(result.text.includes("Rejected"));
  assert.ok(result.text.includes(rejected.reviewNotes));
  assert.ok(result.text.includes("Rejected history"));
});

test("final-decision and login-phone SQL upgrades preserve private records and lock final reviews", async () => {
  for (const schema of ["public", "areva"]) {
    const db = new PGlite();
    try {
      await db.exec(
        "CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;",
      );
      if (schema === "areva")
        await db.exec("CREATE SCHEMA areva;SET search_path=areva,pg_catalog;");
      await db.exec(await readFile("database/schema.sql", "utf8"));
      // Rehearse the upgrade from an existing migration-007 installation.
      await db.exec(
        "ALTER TABLE warranty_registrations DROP COLUMN login_mobile",
      );
      await db.exec(
        "DROP TRIGGER warranty_registrations_final_review ON warranty_registrations;DROP FUNCTION prevent_final_warranty_review_changes();",
      );
      await db.exec(
        await readFile(
          "database/migrations/008-final-warranty-decisions.sql",
          "utf8",
        ),
      );
      await db.exec(
        `INSERT INTO ${schema}.warranty_registrations(id,reference,submission_id,mobile,verification_mode,customer_name,product_name,category_id,category_name,purchase_date,quantity,pack_size,dealer_name,dealer_address,dealer_city,invoice_number,site_address,city,state,pin_code,contact_consent,receipt_id,receipt_name,receipt_mime,receipt_bytes,receipt_file_key) VALUES ('11111111-1111-4111-8111-111111111111','TEST-REF','22222222-2222-4222-8222-222222222222','+919000000000','demo','Test customer','Snapshot product','interior','Interior Paints','2026-01-01',2,'4 L','Test dealer','Dealer address','Pune','INV1','Property address','Pune','Maharashtra','411001',true,'33333333-3333-4333-8333-333333333333','invoice.pdf','application/pdf',100,'33333333-3333-4333-8333-333333333333.pdf')`,
      );
      await db.exec(
        `UPDATE ${schema}.warranty_registrations SET status='approved',approval_confirmed=true,reviewed_by='admin',reviewed_at=now(),review_notes='Final purchase decision',version=2`,
      );
      await db.exec(
        await readFile(
          "database/migrations/011-warranty-login-mobile.sql",
          "utf8",
        ),
      );
      const upgraded = (
        await db.query(
          `SELECT mobile,login_mobile,status,review_notes,reviewed_by,version FROM ${schema}.warranty_registrations`,
        )
      ).rows[0];
      assert.equal(upgraded.login_mobile, upgraded.mobile);
      assert.equal(upgraded.status, "approved");
      assert.equal(upgraded.review_notes, "Final purchase decision");
      assert.equal(upgraded.reviewed_by, "admin");
      assert.equal(upgraded.version, 2);
      await assert.rejects(
        db.exec(
          `UPDATE ${schema}.warranty_registrations SET login_mobile='invalid'`,
        ),
        /check constraint/,
      );
      await assert.rejects(
        db.exec(
          `UPDATE ${schema}.warranty_registrations SET login_mobile=NULL`,
        ),
        /not-null constraint/,
      );
      for (const update of [
        "status='rejected'",
        "status='pending_review'",
        "review_notes='Changed'",
        "reviewed_by='other-admin'",
        "version=3",
        "review_history='[{}]'::jsonb",
      ])
        await assert.rejects(
          db.exec(`UPDATE ${schema}.warranty_registrations SET ${update}`),
          /Final warranty decisions/,
        );
      await db.exec(
        `UPDATE ${schema}.warranty_registrations SET status=status`,
      );
      assert.equal(
        (
          await db.query(
            `SELECT mobile_verified FROM ${schema}.warranty_registrations`,
          )
        ).rows[0].mobile_verified,
        false,
      );
      assert.equal(
        (
          await db.query(
            `SELECT has_function_privilege('anon','${schema}.prevent_final_warranty_review_changes()','EXECUTE') AS allowed`,
          )
        ).rows[0].allowed,
        false,
      );
    } finally {
      await db.close();
    }
  }
});
