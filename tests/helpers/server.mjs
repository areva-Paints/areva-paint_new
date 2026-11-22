/* Disposable HTTP fixture for repository regression checks; never uses hosted data. */
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export async function testServer() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "areva-review-"));
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const password = crypto.randomBytes(24).toString("hex");
  let child,
    logs = "",
    cookie = "";
  async function start(imports = [], extraEnvironment = {}) {
    child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        ...imports.flatMap((file) => ["--import", file]),
        "server.ts",
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          PORT: String(port),
          CONTENT_DATA_DIR: directory,
          ADMIN_USERNAME: "admin",
          ADMIN_PASSWORD: password,
          ADMIN_TEST_LOGIN: "false",
          TRUST_PROXY_HOPS: "0",
          WARRANTY_OTP_MODE: "demo",
          ...extraEnvironment,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout.on("data", (chunk) => (logs += chunk));
    child.stderr.on("data", (chunk) => (logs += chunk));
    for (let attempt = 0; attempt < 150; attempt++) {
      try {
        if ((await fetch(base + "/api/health")).ok) return;
      } catch {}
      if (child.exitCode !== null) throw Error(logs);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw Error("Local test server did not start: " + logs);
  }
  const request = (route, body, method = "POST", authenticated = true) =>
    fetch(base + route, {
      method: body === undefined ? "GET" : method,
      headers: {
        "Content-Type": "application/json",
        ...(authenticated && cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function login() {
    const response = await request(
      "/api/admin/login",
      { username: "admin", password },
      "POST",
      false,
    );
    if (!response.ok)
      throw Error("Fixture sign-in failed: " + (await response.text()));
    cookie = response.headers.get("set-cookie").split(";")[0];
    return cookie;
  }
  async function dispose() {
    if (child?.exitCode === null) {
      const stopped = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await stopped;
    }
    await rm(directory, { recursive: true, force: true });
  }
  return { directory, base, start, request, login, dispose };
}
