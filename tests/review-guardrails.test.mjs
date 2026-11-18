/* Exercise contact validation and SQL integrity against real PostgreSQL checks.
 * Each database and JSON store is disposable; no hosted service is contacted.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { validContactPhone } from "../src/data/contactDetails.ts";

const schemaSql = await readFile("database/schema.sql", "utf8");
const migration = await readFile(
  "database/migrations/012-contact-and-review-integrity.sql",
  "utf8",
);
const reviewSql = await readFile("database/review-checks.sql", "utf8");

/* Create the same role boundary as the prepared Supabase installation. */
async function database(schema) {
  const db = new PGlite();
  await db.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;",
  );
  if (schema === "areva")
    await db.exec("CREATE SCHEMA areva; SET search_path=areva,pg_catalog;");
  await db.exec(schemaSql);
  return db;
}

/* Supply a complete, valid purchase snapshot; override one rule at a time. */
async function warranty(db, schema, overrides = {}) {
  const receipt = crypto.randomUUID();
  const row = {
    id: crypto.randomUUID(),
    reference: "ARV-WR-" + crypto.randomUUID(),
    submission_id: crypto.randomUUID(),
    mobile: "+919000000000",
    login_mobile: "+919000000000",
    verification_mode: "demo",
    customer_name: "Review fixture",
    product_name: "Snapshot product",
    category_id: "interior",
    category_name: "Interior Paints",
    purchase_date: "2026-01-01",
    quantity: 2,
    pack_size: "4 L",
    dealer_name: "Test dealer",
    dealer_address: "Dealer address",
    dealer_city: "Pune",
    invoice_number: "INV-REVIEW",
    site_address: "Property address",
    city: "Pune",
    state: "Maharashtra",
    pin_code: "411001",
    contact_consent: true,
    receipt_id: receipt,
    receipt_name: "invoice.pdf",
    receipt_mime: "application/pdf",
    receipt_bytes: 100,
    receipt_file_key: receipt + ".pdf",
    ...overrides,
  };
  const columns = Object.keys(row);
  await db.query(
    `INSERT INTO ${schema}.warranty_registrations (${columns.join(",")}) VALUES (${columns.map((_, i) => "$" + (i + 1)).join(",")})`,
    Object.values(row),
  );
  return row.id;
}

test("contact numbers need digits while retaining international and landline formatting", () => {
  for (const number of [
    "+91 90000 00000",
    "080-23456789",
    "+1 (212) 555-0123",
    "1234567",
    "123456789012345",
  ])
    assert.equal(validContactPhone(number), true, number);
  for (const number of [
    undefined,
    null,
    9000000000,
    "",
    "-------",
    "(     )",
    "+----------",
    "123456",
    "1234567890123456",
    "90000abcde",
    "++919000000000",
    "9000000000\n",
  ])
    assert.equal(validContactPhone(number), false, String(number));
});

test("an invalid enquiry is rejected before a private record is written", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-contact-review-"));
  const previous = process.env.CONTENT_DATA_DIR;
  process.env.CONTENT_DATA_DIR = dir;
  try {
    const { createEnquiry, readEnquiries } =
      await import("../src/server/enquiries.ts");
    assert.throws(
      () => createEnquiry({ fullName: "Test customer", phone: "-------" }),
      /valid contact phone/,
    );
    assert.deepEqual(readEnquiries(), []);
    const saved = createEnquiry({
      fullName: "Test customer",
      phone: "+91 90000 00000",
      city: "Pune",
    });
    assert.equal(readEnquiries()[0].id, saved.enquiry.id);
    assert.equal(readEnquiries()[0].phone, "+91 90000 00000");
  } finally {
    if (previous === undefined) delete process.env.CONTENT_DATA_DIR;
    else process.env.CONTENT_DATA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

for (const schema of ["public", "areva"]) {
  test(`fresh ${schema} SQL rejects invalid contact and review states`, async () => {
    const db = await database(schema);
    const checkFailure = (promise) =>
      assert.rejects(promise, (error) => error.code === "23514");
    try {
      await checkFailure(
        db.exec(
          `INSERT INTO ${schema}.dealers(id,name,phone,address,city,state,pin_code) VALUES ('bad','Test dealer','-------','Street','Pune','Maharashtra','411001')`,
        ),
      );
      await db.exec(
        `INSERT INTO ${schema}.dealers(id,name,phone,address,city,state,pin_code) VALUES ('good','Test dealer','080-23456789','Street','Pune','Maharashtra','411001')`,
      );
      await checkFailure(
        db.exec(
          `INSERT INTO ${schema}.enquiries(id,full_name,phone) VALUES ('bad','Test customer','-------')`,
        ),
      );
      await db.exec(
        `INSERT INTO ${schema}.enquiries(id,full_name,phone) VALUES ('good','Test customer','+91 90000 00000')`,
      );
      await warranty(db, schema);
      for (const field of [
        "alternate_mobile",
        "dealer_phone",
        "applicator_phone",
      ])
        await checkFailure(warranty(db, schema, { [field]: "-------" }));
      await warranty(db, schema, { dealer_phone: "+1 (212) 555-0123" });
      for (const status of ["rejected", "needs_information"]) {
        await checkFailure(warranty(db, schema, { status }));
        await checkFailure(
          warranty(db, schema, {
            status,
            reviewed_at: "2026-11-18T00:00:00Z",
            reviewed_by: "review-admin",
            review_notes: "\n\t ",
          }),
        );
        await checkFailure(
          warranty(db, schema, {
            status,
            reviewed_at: "2026-11-18T00:00:00Z",
            reviewed_by: "\n\t",
            review_notes: "Receipt is incomplete",
          }),
        );
        await warranty(db, schema, {
          status,
          reviewed_at: "2026-11-18T00:00:00Z",
          reviewed_by: "review-admin",
          review_notes: "Receipt is incomplete",
        });
      }
      await checkFailure(
        warranty(db, schema, {
          approval_confirmed: true,
          reviewed_at: "2026-11-18T00:00:00Z",
          reviewed_by: "review-admin",
        }),
      );
      const approved = await warranty(db, schema, {
        status: "approved",
        approval_confirmed: true,
        reviewed_at: "2026-11-18T00:00:00Z",
        reviewed_by: "review-admin",
      });
      await checkFailure(
        db.query(
          `UPDATE ${schema}.warranty_registrations SET review_notes='Changed final review' WHERE id=$1`,
          [approved],
        ),
      );
      await checkFailure(
        warranty(db, schema, { status: "approved", mobile_verified: true }),
      );
      await warranty(db, schema, {
        status: "approved",
        mobile_verified: true,
        verification_mode: "whatsapp",
      });
      /* The operational review is read-only and reports metadata/counts only. */
      const before = (
        await db.exec(`SELECT * FROM ${schema}.warranty_registrations`)
      )[0].rows;
      const report = (await db.exec(reviewSql)).flatMap(
        (result) => result.rows,
      );
      assert.equal(
        report.find((row) => row.application_schema)?.application_tables,
        23,
      );
      assert.equal(
        report.find((row) => row.application_schema)?.tables_with_rls,
        23,
      );
      assert.equal(report.filter((row) => row.check_name).length, 7);
      assert.ok(
        report
          .filter((row) => row.check_name)
          .every((row) => Number(row.affected_records) === 0),
      );
      assert.ok(!report.some((row) => row.rolname || row.constraint_name));
      assert.deepEqual(
        (await db.exec(`SELECT * FROM ${schema}.warranty_registrations`))[0]
          .rows,
        before,
      );
    } finally {
      await db.close();
    }
  });

  test(`migration 012 in ${schema} stops safely on legacy conflicts and preserves valid records`, async () => {
    const db = await database(schema);
    try {
      /* Recreate migration 011's integrity rules without replaying old data imports. */
      await db.exec(`ALTER TABLE ${schema}.dealers DROP CONSTRAINT dealers_phone_digits_check;
        ALTER TABLE ${schema}.enquiries DROP CONSTRAINT enquiries_phone_format_check;
        ALTER TABLE ${schema}.warranty_registrations DROP CONSTRAINT warranty_registrations_contact_phones_check, DROP CONSTRAINT warranty_registrations_decision_details_check;
        CREATE SCHEMA auth; CREATE TABLE auth.sentinel(value text); INSERT INTO auth.sentinel VALUES ('preserved');
        INSERT INTO ${schema}.dealers(id,name,phone,address,city,state,pin_code) VALUES ('legacy','Test dealer','-------','Street','Pune','Maharashtra','411001');
        INSERT INTO ${schema}.enquiries(id,full_name,phone) VALUES ('legacy','Test customer','-------');`);
      const legacy = await warranty(db, schema, {
        status: "needs_information",
        dealer_phone: "-------",
      });
      await assert.rejects(
        db.exec(migration),
        /dealers 1, enquiries 1, warranty phones 1, warranty decisions 1/,
      );
      await db.exec("ROLLBACK");
      assert.equal(
        (await db.query(`SELECT phone FROM ${schema}.dealers`)).rows[0].phone,
        "-------",
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int AS count FROM pg_constraint WHERE conname='dealers_phone_digits_check'`,
          )
        ).rows[0].count,
        0,
      );
      /* The operator resolves the bad legacy data explicitly before retrying. */
      await db.exec(
        `UPDATE ${schema}.dealers SET phone='080-23456789'; UPDATE ${schema}.enquiries SET phone='+919000000000';`,
      );
      await db.query(
        `UPDATE ${schema}.warranty_registrations SET dealer_phone='080-23456789',review_notes='Complete invoice required',reviewed_by='review-admin',reviewed_at='2026-11-18T00:00:00Z' WHERE id=$1`,
        [legacy],
      );
      const before = (
        await db.query(`SELECT * FROM ${schema}.warranty_registrations`)
      ).rows;
      await db.exec(migration);
      assert.deepEqual(
        (await db.query(`SELECT * FROM ${schema}.warranty_registrations`)).rows,
        before,
      );
      assert.equal(
        (await db.query("SELECT value FROM auth.sentinel")).rows[0].value,
        "preserved",
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='r' AND c.relrowsecurity`,
            [schema],
          )
        ).rows[0].count,
        23,
      );
      for (const role of ["anon", "authenticated", "service_role"]) {
        await db.exec(`SET ROLE ${role}`);
        await assert.rejects(
          db.exec(`SELECT * FROM ${schema}.warranty_registrations`),
          /permission denied/,
        );
        await db.exec("RESET ROLE");
      }
      await assert.rejects(
        db.exec(`UPDATE ${schema}.enquiries SET phone='-------'`),
        /enquiries_phone_format_check/,
      );
      await assert.rejects(db.exec(migration), /already exists/);
      await db.exec("ROLLBACK");
      assert.deepEqual(
        (await db.query(`SELECT * FROM ${schema}.warranty_registrations`)).rows,
        before,
      );
    } finally {
      await db.close();
    }
  });
}

test("migration 012 refuses ambiguous installations", async () => {
  const db = await database("public");
  try {
    await db.exec("CREATE SCHEMA areva; CREATE TABLE areva.site_state(id int)");
    await assert.rejects(db.exec(migration), /Two Areva installations/);
    await db.exec("ROLLBACK");
    assert.equal(
      (await db.query("SELECT count(*)::int AS count FROM public.site_state"))
        .rows[0].count,
      1,
    );
  } finally {
    await db.close();
  }
});
