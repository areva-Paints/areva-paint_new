/* Regression coverage for project category compatibility and SQL upgrades.
 * Fixtures use disposable local stores/databases; hosted customer records are not changed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("gallery category upgrade preserves albums and keeps existing SQL access restrictions", async () => {
  const schema = await readFile("database/schema.sql", "utf8"),
    setup = await readFile("database/supabase-setup.sql", "utf8"),
    migration = await readFile(
      "database/migrations/010-gallery-project-categories.sql",
      "utf8",
    );
  for (const name of ["public", "areva"]) {
    const db = new PGlite();
    try {
      await db.exec(
        "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;",
      );
      await db.exec(name === "public" ? schema : setup);
      await db.exec(
        `SET search_path=${name},pg_catalog; INSERT INTO gallery_projects(id,title) VALUES ('older-project','Existing album'); ALTER TABLE gallery_projects DROP COLUMN category CASCADE;`,
      );
      const before = (
        await db.query(
          "SELECT title,created_at,updated_at FROM gallery_projects WHERE id='older-project'",
        )
      ).rows[0];
      await db.exec(migration);
      const after = (
        await db.query(
          "SELECT title,created_at,updated_at,category FROM gallery_projects WHERE id='older-project'",
        )
      ).rows[0];
      assert.equal(after.category, "other");
      const { category, ...fields } = after;
      assert.deepEqual(fields, before);
      for (const value of [
        "interior",
        "exterior",
        "textures",
        "waterproofing",
        "commercial",
        "other",
      ])
        await db.query(
          "UPDATE gallery_projects SET category=$1 WHERE id='older-project'",
          [value],
        );
      await assert.rejects(
        db.exec("UPDATE gallery_projects SET category='unknown'"),
        /check constraint/,
      );
      await assert.rejects(
        db.exec("UPDATE gallery_projects SET category=NULL"),
        /null value/,
      );
      assert.equal(
        (
          await db.query(
            "SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass",
            [name + ".gallery_projects"],
          )
        ).rows[0].relrowsecurity,
        true,
      );
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          (
            await db.query(
              "SELECT has_table_privilege($1,$2,'SELECT') AS allowed",
              [role, name + ".gallery_projects"],
            )
          ).rows[0].allowed,
          false,
        );
    } finally {
      await db.close();
    }
  }
});
