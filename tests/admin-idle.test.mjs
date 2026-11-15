import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";

test("admin idle sessions expire after five minutes, ignore background reads and cannot be revived", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-admin-idle-"));
  const clock = path.join(dir, "clock.json"),
    preload = path.join(dir, "clock.mjs");
  await writeFile(clock, "0");
  // A test-only Node preloader controls server time; no production timeout override exists.
  await writeFile(
    preload,
    `import fs from 'node:fs'; const started=Date.now(); Date.now=()=>started+Number(fs.readFileSync(${JSON.stringify(clock)},'utf8'));`,
  );
  const port = await new Promise((resolve) => {
    const listener = net.createServer();
    listener.listen(0, "127.0.0.1", () => {
      const port = listener.address().port;
      listener.close(() => resolve(port));
    });
  });
  const base = `http://127.0.0.1:${port}`,
    password = crypto.randomBytes(24).toString("hex");
  let logs = "";
  const server = spawn(
    process.execPath,
    ["--import", preload, "--import", "tsx", "server.ts"],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        CONTENT_DATA_DIR: path.join(dir, "content"),
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: password,
        TRUST_PROXY_HOPS: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (value) => (logs += value));
  server.stderr.on("data", (value) => (logs += value));
  const request = (route, cookie = "", body, headers = {}) =>
    fetch(base + route, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const minute = 60000;
  const setTime = (offset) => writeFile(clock, String(offset));
  async function login(username = "admin", admin = true) {
    const response = await request(
      admin ? "/api/admin/login" : "/api/auth/login",
      "",
      { username, password },
    );
    assert.equal(response.status, 200, await response.clone().text());
    return response.headers.get("set-cookie").split(";")[0];
  }
  const session = async (cookie) => {
    const response = await request("/api/admin/session", cookie);
    assert.equal(response.status, 200);
    return (await response.json()).timing;
  };
  try {
    for (let i = 0; i < 150; i++) {
      try {
        if ((await request("/api/health")).ok) break;
      } catch {}
      if (server.exitCode !== null || i === 149) throw Error(logs);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(
      (await request("/api/admin/activity", "", { idleForMs: 0 })).status,
      401,
    );
    const cookie = await login(),
      initial = await session(cookie);
    assert.equal(initial.idleExpiresAt - initial.serverTime, 5 * minute);
    assert.equal(initial.expiresAt - initial.serverTime, 8 * 60 * minute);
    assert.notEqual(
      initial.activityId,
      cookie.split("=")[1],
      "Tab coordination never exposes the authentication token",
    );
    for (const [username, role] of [
      ["created-admin", "admin"],
      ["customer", "customer"],
    ]) {
      assert.equal(
        (
          await request("/api/admin/users", cookie, {
            username,
            name: username,
            email: "",
            role,
            password,
          })
        ).status,
        201,
      );
    }
    const created = await login("created-admin"),
      customer = await login("customer", false);
    await setTime(4 * minute);
    assert.equal((await request("/api/admin/content", cookie)).status, 200);
    assert.equal((await request("/api/admin/history", cookie)).status, 200);
    assert.equal(
      (await session(cookie)).idleExpiresAt,
      initial.idleExpiresAt,
      "Background requests never reset inactivity",
    );
    await setTime(5 * minute);
    for (const token of [cookie, created]) {
      assert.equal((await request("/api/admin/session", token)).status, 401);
      assert.equal((await request("/api/admin/content", token)).status, 401);
      assert.equal(
        (await request("/api/admin/activity", token, { idleForMs: 0 })).status,
        401,
        "An expired session cannot be revived",
      );
    }
    assert.equal(
      (await request("/api/auth/session", customer)).status,
      200,
      "The admin-only timeout does not change customer sessions",
    );
    let active = await login();
    await setTime(9 * minute);
    for (const body of [
      {},
      [],
      { idleForMs: -1 },
      { idleForMs: 60001 },
      { idleForMs: "0" },
      { idleForMs: null },
      { idleForMs: 0, forged: true },
    ])
      assert.equal(
        (await request("/api/admin/activity", active, body)).status,
        400,
      );
    assert.equal(
      (
        await request(
          "/api/admin/activity",
          active,
          { idleForMs: 0 },
          { Origin: "https://untrusted.example" },
        )
      ).status,
      403,
    );
    const activity = await request("/api/admin/activity", active, {
      idleForMs: 20000,
    });
    assert.equal(activity.status, 200);
    const updated = (await activity.json()).timing;
    assert.equal(
      updated.idleExpiresAt - updated.serverTime,
      5 * minute - 20000,
      "A throttled heartbeat counts the actual interaction time",
    );
    await setTime(11 * minute);
    assert.equal((await session(active)).idleExpiresAt, updated.idleExpiresAt);
    await setTime(13 * minute + 40000);
    assert.equal((await request("/api/admin/session", active)).status, 401);

    const start = 13 * minute + 40000;
    active = await login();
    const absolute = await session(active);
    for (
      let elapsed = 4 * minute;
      elapsed < 8 * 60 * minute;
      elapsed += 4 * minute
    ) {
      await setTime(start + elapsed);
      assert.equal(
        (await request("/api/admin/activity", active, { idleForMs: 0 })).status,
        200,
      );
    }
    await setTime(start + 8 * 60 * minute);
    assert.equal(
      (await request("/api/admin/activity", active, { idleForMs: 0 })).status,
      401,
      "Activity cannot extend the eight-hour absolute cap",
    );
    assert.equal(
      (await request("/api/auth/session", customer)).status,
      401,
      "The original customer absolute cap remains enforced",
    );

    active = await login();
    const fresh = await session(active);
    let response = await request("/api/admin/logout", active, {
      activityId: absolute.activityId,
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(
      (await request("/api/admin/session", active)).status,
      200,
      "A late logout from an older tab cannot revoke a fresh login",
    );
    response = await request("/api/admin/logout", active, {
      activityId: fresh.activityId,
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(
      (await request("/api/admin/session", active)).status,
      401,
      "Scoped idle logout revokes the exact server session",
    );
    active = await login();
    response = await request("/api/admin/logout", active, {});
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie"), /areva_admin=;/);
    assert.equal(
      (await request("/api/admin/session", active)).status,
      401,
      "Manual logout still clears and revokes the session",
    );
    const store = JSON.parse(
      await readFile(path.join(dir, "content", "content.json"), "utf8"),
    );
    assert.ok(
      !store.adminHistory.events.some((event) =>
        event.label.includes("heartbeat"),
      ),
      "Activity heartbeats do not flood audit history",
    );
  } finally {
    if (server.exitCode === null) {
      const done = new Promise((resolve) => server.once("exit", resolve));
      server.kill();
      await done;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
