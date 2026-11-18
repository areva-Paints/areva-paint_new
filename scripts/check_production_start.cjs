/* Verify the actual pruned deployment shape using a disposable private store.
 * Run after npm run build and npm prune --omit=dev; no hosted service is used.
 */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

/* Fail early if development tooling accidentally remains in the runtime image. */
for (const name of ["vite", "@vitejs/plugin-react", "@tailwindcss/vite"]) {
  let installed = false;
  try {
    require.resolve(name);
    installed = true;
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
  }
  assert.equal(
    installed,
    false,
    `Prune development dependencies before this check: ${name}`,
  );
}

/* Reserve an available local test port without assuming a developer's port 3000. */
async function availablePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

/* Exercise real startup, static serving and admin authorization without Vite. */
async function check() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-production-start-"));
  let server;
  let output = "";
  try {
    const port = await availablePort();
    const base = `http://127.0.0.1:${port}`;
    const password = crypto.randomBytes(24).toString("hex");
    server = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        CONTENT_DATA_DIR: dir,
        ADMIN_USERNAME: "review-admin",
        ADMIN_PASSWORD: password,
        ADMIN_TEST_LOGIN: "false",
        TRUST_PROXY_HOPS: "0",
        WARRANTY_OTP_MODE: "demo",
        PUBLIC_SITE_ORIGINS: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (chunk) => (output += chunk));
    server.stderr.on("data", (chunk) => (output += chunk));
    server.on("error", (error) => (output += error.message));
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (server.exitCode !== null)
        throw Error(output || "Production process exited.");
      try {
        ready = (await fetch(base + "/api/health")).ok;
      } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, "Production startup timed out. " + output);
    const page = await fetch(base + "/");
    assert.equal(page.status, 200);
    assert.match(await page.text(), /id="root"/);
    for (const route of ["/admin", "/warranty", "/attached-page"]) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get("content-type"), /text\/html/, route);
    }
    assert.equal((await fetch(base + "/api/admin/content")).status, 401);
    const login = await fetch(base + "/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "review-admin", password }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const content = await fetch(base + "/api/admin/content", {
      headers: { Cookie: cookie },
    });
    assert.equal(content.status, 200);
    assert.ok((await content.json()).products.length > 0);
    console.log(
      "Pruned production startup passed: public/admin/warranty HTML, API health and protected admin content.",
    );
  } finally {
    /* Stop the child before deleting its private store, including failed starts. */
    if (server && server.exitCode === null && server.pid) {
      const stopped = new Promise((resolve) => server.once("exit", resolve));
      server.kill();
      await stopped;
    }
    await rm(dir, { recursive: true, force: true });
  }
}

check().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
