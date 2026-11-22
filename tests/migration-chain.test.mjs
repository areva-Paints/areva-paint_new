/* Rehearse every numbered migration against the original 15-table proposal and
 * compare its relational contract with fresh setup, using local PostgreSQL only.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
  readdir,
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  rm,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

async function contract(db, schema) {
  const tables = (
    await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename",
      [schema],
    )
  ).rows;
  const columns = (
    await db.query(
      "SELECT table_name,column_name,data_type,is_nullable,character_maximum_length,column_default FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name,column_name",
      [schema],
    )
  ).rows;
  const indexes = (
    await db.query(
      "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=$1 ORDER BY indexname",
      [schema],
    )
  ).rows;
  const functions = (
    await db.query(
      "SELECT p.proname,p.provolatile,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 ORDER BY p.proname",
      [schema],
    )
  ).rows;
  return { tables, columns, indexes, functions };
}

async function open(schema, sql) {
  const db = new PGlite();
  await db.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;",
  );
  if (schema === "areva")
    await db.exec("CREATE SCHEMA areva; SET search_path=areva,pg_catalog;");
  try {
    await db.exec(sql);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

for (const schema of ["public", "areva"])
  test(`all SQL migrations match fresh ${schema} setup and preserve legacy records`, async () => {
    const fresh = await open(
      schema,
      await readFile("database/schema.sql", "utf8"),
    );
    let expected;
    try {
      expected = await contract(fresh, schema);
    } finally {
      await fresh.close();
    }
    const db = await open(
      schema,
      await readFile("tests/fixtures/schema-v0.sql", "utf8"),
    );
    try {
      await db.exec(await readFile("database/seed-categories.sql", "utf8"));
      await db.exec(`INSERT INTO products(id,category_id,name,description,image_url,sheen,voc_level,washability) VALUES ('legacy-product','interior','Legacy product','Legacy description','/assets/legacy.png','Soft Sheen','Standard','Wipeable');
      INSERT INTO enquiries(id,full_name,phone,product_id,product_name) VALUES ('legacy-enquiry','Legacy customer','9000000000','legacy-product','Legacy product');
      INSERT INTO gallery_projects(id,title) VALUES ('legacy-project','Legacy project');`);
      const migrations = (await readdir("database/migrations"))
        .filter((file) => /^\d{3}-.+\.sql$/.test(file))
        .sort();
      for (let index = 0; index < migrations.length; index++) {
        const name = migrations[index];
        assert.equal(
          Number(name.slice(0, 3)),
          index + 1,
          "Migration numbering must not have gaps",
        );
        await db.exec(await readFile("database/migrations/" + name, "utf8"));
        if (name.startsWith("006-"))
          await db.exec(
            `INSERT INTO warranty_registrations(id,reference,submission_id,mobile,verification_mode,customer_name,product_name,category_id,category_name,purchase_date,quantity,pack_size,dealer_name,dealer_address,dealer_city,invoice_number,site_address,city,state,pin_code,contact_consent,receipt_id,receipt_name,receipt_mime,receipt_bytes,receipt_file_key) VALUES ('11111111-1111-4111-8111-111111111111','LEGACY-REF','22222222-2222-4222-8222-222222222222','+919000000000','demo','Legacy customer','Legacy product','interior','Interior Paints','2026-01-01',1,'4 L','Legacy dealer','Dealer address','Pune','LEGACY-INV','Site address','Pune','Maharashtra','411001',true,'33333333-3333-4333-8333-333333333333','invoice.pdf','application/pdf',100,'33333333-3333-4333-8333-333333333333.pdf')`,
          );
      }
      assert.deepEqual(await contract(db, schema), expected);
      assert.equal(
        (await db.query("SELECT name FROM products WHERE id='legacy-product'"))
          .rows[0].name,
        "Legacy product",
      );
      assert.equal(
        (
          await db.query(
            "SELECT full_name FROM enquiries WHERE id='legacy-enquiry'",
          )
        ).rows[0].full_name,
        "Legacy customer",
      );
      assert.equal(
        (
          await db.query(
            "SELECT category FROM gallery_projects WHERE id='legacy-project'",
          )
        ).rows[0].category,
        "other",
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT login_mobile,site_photos,status,mobile_verified FROM warranty_registrations",
          )
        ).rows[0],
        {
          login_mobile: "+919000000000",
          site_photos: [],
          status: "pending_review",
          mobile_verified: false,
        },
      );
      for (const role of ["anon", "authenticated", "service_role"]) {
        const grants = await db.query(
          "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='r' AND (NOT c.relrowsecurity OR has_table_privilege($2,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))",
          [schema, role],
        );
        assert.deepEqual(
          grants.rows,
          [],
          `${role} must not bypass private application access`,
        );
      }
      const report = (
        await db.exec(await readFile("database/review-checks.sql", "utf8"))
      ).flatMap((result) => result.rows);
      assert.equal(
        Number(
          report.find((row) => row.application_tables)?.application_tables,
        ),
        expected.tables.length,
      );
      assert.ok(!report.some((row) => row.rolname || row.constraint_name));
    } finally {
      await db.close();
    }
  });

test("generated SQL drift check is read-only and detects a changed canonical schema", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "areva-sql-generation-"));
  try {
    for (const folder of ["scripts", "database"])
      await mkdir(path.join(root, folder));
    for (const file of [
      "scripts/prepare_supabase_sql.cjs",
      "database/schema.sql",
      "database/seed-categories.sql",
      "database/supabase-setup.sql",
    ])
      await copyFile(file, path.join(root, file));
    const run = () =>
      spawnSync(
        process.execPath,
        ["scripts/prepare_supabase_sql.cjs", "--check"],
        { cwd: root, encoding: "utf8" },
      );
    assert.equal(run().status, 0);
    const generated = await readFile(
      path.join(root, "database/supabase-setup.sql"),
      "utf8",
    );
    const file = path.join(root, "database/schema.sql");
    await writeFile(
      file,
      (await readFile(file, "utf8")).replace(
        "COMMIT;",
        "-- Example canonical change\nCOMMIT;",
      ),
    );
    const changed = run();
    assert.equal(changed.status, 1);
    assert.match(changed.stderr, /Generated Supabase SQL differs/);
    assert.equal(
      await readFile(path.join(root, "database/supabase-setup.sql"), "utf8"),
      generated,
      "Checking must not regenerate the committed output",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
