import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import net from "node:net";

test("only admins manage persistent hashed accounts; roles, revocation and public privacy are enforced", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-users-test-"));
  const port = await new Promise((resolve) => {
    const socket = net.createServer();
    socket.listen(0, "127.0.0.1", () => {
      const value = socket.address().port;
      socket.close(() => resolve(value));
    });
  });
  const base = `http://127.0.0.1:${port}`;
  const password = crypto.randomBytes(24).toString("hex");
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=";
  let server,
    logs = "",
    cookie = "";
  async function start(bootstrap = true) {
    server = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: "production",
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: bootstrap ? password : "",
        ADMIN_TEST_LOGIN: "false",
        CONTENT_DATA_DIR: dir,
        TRUST_PROXY_HOPS: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (b) => (logs += b));
    server.stderr.on("data", (b) => (logs += b));
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) return;
      } catch {}
      if (server.exitCode !== null) throw Error(logs);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw Error("Temporary server did not start: " + logs);
  }
  async function stop() {
    if (server && server.exitCode === null) {
      const done = new Promise((resolve) => server.once("exit", resolve));
      server.kill("SIGTERM");
      await done;
    }
  }
  async function request(url, method = "GET", body, authenticated = true) {
    return fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authenticated && cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function login() {
    const response = await request("/api/admin/login", "POST", {
      username: "admin",
      password,
    });
    assert.equal(response.status, 200);
    cookie = response.headers.get("set-cookie").split(";")[0];
  }
  async function save(content) {
    const response = await request("/api/admin/content", "PUT", content);
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  }

  async function accountRequest(url, method = "GET", body, accountCookie = "") {
    return fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(accountCookie ? { Cookie: accountCookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  const memberPassword = crypto.randomBytes(24).toString("hex");
  const adminPassword = crypto.randomBytes(24).toString("hex");
  async function signIn(username, password, admin = false, role) {
    const response = await accountRequest(
      admin ? "/api/admin/login" : "/api/auth/login",
      "POST",
      { username, password, ...(role ? { role } : {}) },
    );
    const result = await response.json();
    return {
      response,
      result,
      cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
    };
  }
  async function create(username, role, email = "", password = memberPassword) {
    const response = await request("/api/admin/users", "POST", {
      username,
      name: username + " name",
      email,
      role,
      password,
    });
    assert.equal(response.status, 201, await response.clone().text());
    const user = (await response.json()).user;
    assert.equal(user.role, role);
    return user;
  }
  try {
    await start();
    for (const [method, path, body] of [
      ["GET", "/api/admin/users"],
      ["POST", "/api/admin/users", {}],
      ["PATCH", "/api/admin/users/fake", { active: false }],
    ])
      assert.equal((await accountRequest(path, method, body)).status, 401);
    await login();
    const initial = await (await request("/api/content")).json();
    const admin = await create(
      "staff-admin",
      "admin",
      "admin@example.test",
      adminPassword,
    );
    const customer = await create(
      "client-one",
      "customer",
      "client@example.test",
    );
    const architect = await create("designer-one", "architect");
    const builder = await create("builder-one", "builder");
    let users = await (await request("/api/admin/users")).json();
    assert.equal(users.users.length, 5);
    assert.ok(
      users.users.some(
        (user) => user.environment && user.id === "environment-admin",
      ),
    );
    const allText = JSON.stringify(users);
    for (const field of [
      "passwordHash",
      "passwordSalt",
      "passwordVersion",
      memberPassword,
      adminPassword,
      password,
    ])
      assert.equal(allText.includes(field), false, field);
    const disk = JSON.parse(
      await readFile(path.join(dir, "content.json"), "utf8"),
    );
    assert.equal(disk.users.length, 4);
    assert.notEqual(disk.users[1].passwordSalt, disk.users[2].passwordSalt);
    assert.notEqual(disk.users[1].passwordHash, disk.users[2].passwordHash);
    for (const secret of [password, memberPassword, adminPassword])
      assert.equal(JSON.stringify(disk).includes(secret), false);
    assert.equal(
      (
        await request("/api/admin/users", "POST", {
          username: "CLIENT-ONE",
          name: "Duplicate",
          role: "customer",
          password: memberPassword,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request("/api/admin/users", "POST", {
          username: "other-user",
          email: "CLIENT@EXAMPLE.TEST",
          name: "Duplicate",
          role: "customer",
          password: memberPassword,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request("/api/admin/users", "POST", {
          username: "client@example.test",
          name: "Duplicate",
          role: "customer",
          password: memberPassword,
        })
      ).status,
      409,
    );
    for (const patch of [
      { password: "short" },
      { role: "owner" },
      { name: "" },
      { username: "admin" },
    ]) {
      const response = await request("/api/admin/users", "POST", {
        username: "invalid-user",
        name: "Invalid",
        role: "customer",
        password: memberPassword,
        ...patch,
      });
      assert.ok([400, 409].includes(response.status));
    }
    const member = await signIn(
      "CLIENT@EXAMPLE.TEST",
      memberPassword,
      false,
      "customer",
    );
    assert.equal(member.response.status, 200);
    assert.equal(member.result.user.role, "customer");
    assert.match(member.response.headers.get("set-cookie"), /HttpOnly/);
    assert.match(member.response.headers.get("set-cookie"), /SameSite=Strict/);
    for (const path of [
      "/api/admin/content",
      "/api/admin/history",
      "/api/admin/users",
      "/api/enquiries",
    ])
      assert.equal(
        (await accountRequest(path, "GET", undefined, member.cookie)).status,
        401,
      );
    assert.equal(
      (
        await accountRequest(
          "/api/admin/users",
          "POST",
          {
            username: "evil-admin",
            name: "Evil",
            role: "admin",
            password: memberPassword,
          },
          member.cookie,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await accountRequest(
          "/api/admin/users",
          "GET",
          undefined,
          member.cookie.replace("areva_user=", "areva_admin="),
        )
      ).status,
      401,
    );
    assert.equal(
      (await signIn("client-one", memberPassword, true)).response.status,
      401,
    );
    assert.equal(
      (await signIn("client-one", memberPassword, false, "architect")).response
        .status,
      401,
    );
    assert.equal(
      (await signIn("staff-admin", adminPassword, false, "customer")).response
        .status,
      401,
    );
    for (const user of [architect, builder])
      assert.equal(
        (await signIn(user.username, memberPassword, false, user.role)).response
          .status,
        200,
      );
    const staff = await signIn("ADMIN@EXAMPLE.TEST", adminPassword, true);
    assert.equal(staff.response.status, 200);
    assert.equal(
      (await accountRequest("/api/admin/users", "GET", undefined, staff.cookie))
        .status,
      200,
    );
    assert.equal(
      (
        await accountRequest(
          "/api/admin/users/" + admin.id,
          "PATCH",
          { active: false },
          staff.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/api/admin/users/environment-admin", "PATCH", {
          password: memberPassword,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request("/api/admin/users/" + customer.id, "PATCH", {
          role: "admin",
        })
      ).status,
      400,
    );
    let c = await (await request("/api/content")).json();
    c.products[0].tagline += " edited by staff";
    c.users = [];
    const saved = await accountRequest(
      "/api/admin/content",
      "PUT",
      c,
      staff.cookie,
    );
    assert.equal(saved.status, 200);
    assert.equal(
      (await (await request("/api/admin/users")).json()).users.length,
      5,
      "Old/content clients must not erase accounts",
    );
    let history = await (
      await request("/api/admin/history?section=website")
    ).json();
    assert.equal(history.events[0].actor, "staff-admin");
    const resetPassword = crypto.randomBytes(24).toString("hex");
    assert.equal(
      (
        await request("/api/admin/users/" + customer.id, "PATCH", {
          password: resetPassword,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await accountRequest(
          "/api/auth/session",
          "GET",
          undefined,
          member.cookie,
        )
      ).status,
      401,
    );
    assert.equal(
      (await signIn("client-one", memberPassword, false, "customer")).response
        .status,
      401,
    );
    const reset = await signIn("client-one", resetPassword, false, "customer");
    assert.equal(reset.response.status, 200);
    assert.equal(
      (
        await request("/api/admin/users/" + customer.id, "PATCH", {
          active: false,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await accountRequest(
          "/api/auth/session",
          "GET",
          undefined,
          reset.cookie,
        )
      ).status,
      401,
    );
    assert.equal(
      (await signIn("client-one", resetPassword, false, "customer")).response
        .status,
      401,
    );
    assert.equal(
      (
        await request("/api/admin/users/" + customer.id, "PATCH", {
          active: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await accountRequest(
          "/api/auth/session",
          "GET",
          undefined,
          reset.cookie,
        )
      ).status,
      401,
    );
    const active = await signIn("client-one", resetPassword, false, "customer");
    assert.equal(active.response.status, 200);
    await accountRequest("/api/auth/logout", "POST", {}, active.cookie);
    assert.equal(
      (
        await accountRequest(
          "/api/auth/session",
          "GET",
          undefined,
          active.cookie,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await request("/api/admin/users/" + admin.id, "PATCH", {
          active: false,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await accountRequest(
          "/api/admin/content",
          "GET",
          undefined,
          staff.cookie,
        )
      ).status,
      401,
    );
    assert.equal(
      (await request("/api/admin/users/" + admin.id, "PATCH", { active: true }))
        .status,
      200,
    );
    const raceBody = {
      username: "race-user",
      name: "Race",
      role: "customer",
      password: memberPassword,
    };
    const raced = await Promise.all([
      request("/api/admin/users", "POST", raceBody),
      request("/api/admin/users", "POST", raceBody),
    ]);
    assert.deepEqual(raced.map((r) => r.status).sort(), [201, 409]);
    const foreign = await fetch(base + "/api/admin/users", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "https://foreign.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(raceBody),
    });
    assert.equal(foreign.status, 403);
    const foreignLogin = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "https://foreign.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "client-one", password: resetPassword }),
    });
    assert.equal(foreignLogin.status, 403);
    for (const path of [
      "/api/content",
      "/api/admin/content",
      "/api/products",
      "/attached-page",
      "/api/project/source-files",
    ]) {
      const text = await (await request(path)).text();
      for (const secret of [
        ...(path === "/api/project/source-files"
          ? []
          : ["passwordHash", "passwordSalt"]),
        "client@example.test",
        "staff-admin",
        memberPassword,
        adminPassword,
        ...disk.users.map((user) => user.passwordHash),
      ])
        assert.equal(text.includes(secret), false, path + ":" + secret);
    }
    history = await (
      await request("/api/admin/history?section=users&pageSize=50")
    ).json();
    assert.ok(
      history.events.some(
        (event) =>
          event.entityId === customer.id && event.fields.includes("password"),
      ),
    );
    assert.equal(JSON.stringify(history).includes(resetPassword), false);
    await request("/api/admin/logout", "POST", {});
    assert.equal((await request("/api/admin/content")).status, 401);
    const publicHtml = await (await accountRequest("/attached-page")).text();
    assert.equal(publicHtml.includes("Demo sign-in"), false);
    assert.equal(publicHtml.includes("signed=true"), false);
    assert.equal(
      /\broles\(/.test(publicHtml),
      false,
      "Obsolete login initialization must not interrupt the visualizer",
    );
    assert.ok(publicHtml.includes("account-access.js"));
    // A second admin survives restart and remains usable when the original env login is disabled.
    await stop();
    await start(false);
    const restored = await signIn("staff-admin", adminPassword, true);
    assert.equal(restored.response.status, 200);
    assert.equal(
      (
        await accountRequest(
          "/api/admin/users",
          "GET",
          undefined,
          restored.cookie,
        )
      ).status,
      200,
    );
    assert.equal(
      (await signIn("client-one", resetPassword, false, "customer")).response
        .status,
      200,
    );
    assert.equal(
      (
        await accountRequest(
          "/api/admin/session",
          "GET",
          undefined,
          staff.cookie,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await accountRequest(
          "/api/admin/users/" + admin.id,
          "PATCH",
          { active: false },
          restored.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (await (await accountRequest("/api/content")).json()).products.length,
      initial.products.length,
    );
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});
