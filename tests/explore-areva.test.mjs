/* Regression coverage for resource-hub navigation.
 * Fixtures use disposable local stores/databases; hosted customer records are not changed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("Explore Areva links to real, separate resources and keeps warranty/admin access at top level", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-explore-test-"));
  process.env.CONTENT_DATA_DIR = dir;
  try {
    const { ExploreAreva } = await import("../src/components/ExploreAreva.tsx");
    const { legacyPage } = await import("../src/admin/legacy-page.ts");
    const html = legacyPage();
    const hub = html.match(/<section id="about"[\s\S]*?<\/section>/)?.[0];
    assert.ok(hub, "About Areva renders the resource hub");
    assert.match(hub, /Explore Areva/);
    assert.match(hub, /How can we help you\?/);
    assert.equal((hub.match(/class="ea-card"/g) || []).length, 6);
    for (const destination of ["#our-story", "#portals", "#certs", "#contact"])
      assert.ok(hub.includes(`href="${destination}"`), destination);
    for (const destination of ["/warranty", "/admin"])
      assert.ok(
        hub.includes(`href="${destination}" target="_top"`),
        destination + " exits the iframe",
      );
    for (const id of ["about", "our-story", "portals", "certs", "contact"])
      assert.equal(
        (html.match(new RegExp(`id="${id}"`, "g")) || []).length,
        1,
        id + " is an actual unique page target",
      );
    assert.match(html, /<section id="our-story"[\s\S]*?Our vision/);
    assert.ok(
      !hub.includes("Our vision"),
      "The original story remains a separate destination",
    );
    assert.ok(html.includes("/assets/explore-areva.css"));
    const root = "https://areva-paint-new-admin.onrender.com";
    const react = renderToStaticMarkup(
      createElement(ExploreAreva, {
        resolveLink: (route) =>
          new URL(
            route.startsWith("#") ? "/attached-page" + route : route,
            root,
          ).href,
      }),
    );
    for (const destination of [
      "/attached-page#our-story",
      "/attached-page#portals",
      "/attached-page#certs",
      "/attached-page#contact",
      "/warranty",
      "/admin",
    ])
      assert.ok(
        react.includes(`href="${root + destination}" target="_top"`),
        "React opens the backend's actual destination: " + destination,
      );
    assert.ok(!hub.includes('href="#"'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
