import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const schema = () => readFile("database/schema.sql", "utf8");
const migration = () =>
  readFile("database/migrations/005-private-access-guardrails.sql", "utf8");
const roles =
  "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;";
async function verify(db, name) {
  const result = await db.query(
    `SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='r' AND c.relrowsecurity`,
    [name],
  );
  assert.equal(result.rows[0].count, 19);
  for (const role of ["anon", "authenticated", "service_role"]) {
    const access = await db.query(
      `SELECT has_table_privilege($1, $2, 'SELECT') AS read, has_table_privilege($1, $2, 'INSERT') AS write, has_function_privilege($1, $3, 'EXECUTE') AS execute`,
      [role, `${name}.users`, `${name}.sync_user_login_identifiers()`],
    );
    assert.deepEqual(access.rows[0], {
      read: false,
      write: false,
      execute: false,
    });
    await db.exec(`SET ROLE ${role}`);
    await assert.rejects(
      db.query(`SELECT * FROM ${name}.users`),
      /permission denied/,
    );
    await db.exec("RESET ROLE");
  }
  await db.exec(
    `CREATE SCHEMA hostile; CREATE TABLE hostile.user_login_identifiers(identifier text,user_id text); SET search_path=hostile,pg_catalog;`,
  );
  await db.query(
    `INSERT INTO ${name}.users(id,username,email,name,role,password_hash,password_salt) VALUES ('test-admin','test-admin','admin@example.test','Test admin','admin',$1,$2)`,
    ["f".repeat(128), "a".repeat(32)],
  );
  assert.equal(
    (
      await db.query(
        `SELECT count(*)::int AS n FROM ${name}.user_login_identifiers WHERE user_id='test-admin'`,
      )
    ).rows[0].n,
    2,
    "Identifier trigger ignores hostile search_path",
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM hostile.user_login_identifiers",
      )
    ).rows[0].n,
    0,
  );
  await db.exec(`SET search_path=${name},pg_catalog`);
}

test("fresh PostgreSQL schema restricts API roles and pins identifier writes", async () => {
  const db = new PGlite();
  try {
    await db.exec(roles);
    await db.exec(await schema());
    await db.exec(await readFile("database/seed-categories.sql", "utf8"));
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM categories")).rows[0].n,
      8,
    );
    await verify(db, "public");
    // Even an accidental SELECT grant must not bypass RLS.
    await db.exec(
      "GRANT SELECT ON public.users TO authenticated; SET ROLE authenticated;",
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM public.users")).rows[0].n,
      0,
    );
    await db.exec("RESET ROLE");
  } finally {
    await db.close();
  }
});

test("existing-table security migration revokes prior grants and preserves unrelated tables", async () => {
  const db = new PGlite();
  try {
    await db.exec(roles);
    await db.exec(await schema());
    await db.exec(
      "CREATE TABLE unrelated_public_data(value text); GRANT SELECT ON unrelated_public_data TO anon; ALTER TABLE users DISABLE ROW LEVEL SECURITY; GRANT ALL ON users TO anon, authenticated, service_role;",
    );
    await db.exec(await migration());
    await verify(db, "public");
    assert.equal(
      (
        await db.query(
          "SELECT has_table_privilege('anon','public.unrelated_public_data','SELECT') AS allowed",
        )
      ).rows[0].allowed,
      true,
    );
  } finally {
    await db.close();
  }
});

test("one-time Supabase setup creates only private Areva tables and blocks a second install", async () => {
  const db = new PGlite();
  try {
    await db.exec(roles);
    await db.exec(
      "CREATE SCHEMA auth; CREATE TABLE auth.existing_user(id text); INSERT INTO auth.existing_user VALUES ('preserved');",
    );
    const setup = await readFile("database/supabase-setup.sql", "utf8");
    await db.exec(setup);
    await verify(db, "areva");
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM areva.categories"))
        .rows[0].n,
      8,
    );
    assert.equal(
      (await db.query("SELECT id FROM auth.existing_user")).rows[0].id,
      "preserved",
    );
    await db.exec(await migration());
    await assert.rejects(db.exec(setup), /already exists/);
    await db.exec("ROLLBACK");
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM areva.users")).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
