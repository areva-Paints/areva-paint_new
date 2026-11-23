/* Exercise random challenge binding, resend, expiry and replay without waiting
 * on wall-clock time or sending any external message.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createWarrantyOtp,
  matchesWarrantyOtp,
} from "../src/server/warranty-otp.ts";
import { testServer } from "./helpers/server.mjs";

test("random six-digit OTPs are challenge-bound and a resend excludes the pending code", (t) => {
  const id = crypto.randomUUID();
  const first = createWarrantyOtp(id);
  assert.match(first.code, /^[1-9]\d{5}$/);
  assert.match(first.codeHash, /^[a-f0-9]{64}$/);
  assert.equal(matchesWarrantyOtp(id, first.code, first.codeHash), true);
  for (const invalid of [
    "000000",
    "12345",
    "1234567",
    Number(first.code),
    undefined,
  ])
    assert.equal(matchesWarrantyOtp(id, invalid, first.codeHash), false);
  assert.equal(
    matchesWarrantyOtp(crypto.randomUUID(), first.code, first.codeHash),
    false,
  );
  assert.equal(matchesWarrantyOtp(id, first.code, "malformed"), false);
  const codes = Array.from(
    { length: 30 },
    () => createWarrantyOtp(crypto.randomUUID()).code,
  );
  assert.ok(
    new Set(codes).size > 1,
    "Separate challenges must not use a shared constant",
  );

  const replacement = first.code === "999999" ? 100000 : Number(first.code) + 1;
  const sequence = [Number(first.code), replacement];
  const random = t.mock.method(crypto, "randomInt", () => sequence.shift());
  const nextId = crypto.randomUUID();
  const next = createWarrantyOtp(nextId, [{ id, codeHash: first.codeHash }]);
  assert.equal(random.mock.callCount(), 2, "An RNG collision must be redrawn");
  assert.equal(next.code, String(replacement));
  assert.equal(matchesWarrantyOtp(nextId, next.code, next.codeHash), true);
});

test("demo OTP API changes the code on resend, consumes it once and enforces expiry/attempts", async () => {
  const server = await testServer();
  const offset = path.join(server.directory, "clock-offset");
  const clock = path.join(server.directory, "clock.mjs");
  await writeFile(offset, "0");
  await writeFile(
    clock,
    `import fs from 'node:fs';const realNow=Date.now;Date.now=()=>realNow()+Number(fs.readFileSync(new URL('./clock-offset',import.meta.url),'utf8'));`,
  );
  const request = (body) => server.request("/api/warranty/otp/request", body);
  const verify = (challenge, code = challenge.demoCode) =>
    server.request("/api/warranty/otp/verify", {
      challengeId: challenge.challengeId,
      code,
    });
  try {
    await server.start([clock]);
    const first = await (await request({ mobile: "9000000000" })).json();
    assert.match(first.demoCode, /^[1-9]\d{5}$/);
    assert.equal(
      first.codeHash,
      undefined,
      "Verification material stays server-side",
    );
    assert.equal(first.expiresIn, 300);
    assert.equal((await request({ mobile: "9000000000" })).status, 429);
    assert.equal((await verify(first, "000000")).status, 400);
    await writeFile(offset, "61000");
    const secondResponse = await request({ mobile: "9000000000" });
    assert.equal(secondResponse.status, 200);
    const second = await secondResponse.json();
    assert.notEqual(second.demoCode, first.demoCode);
    assert.notEqual(second.challengeId, first.challengeId);
    assert.equal(
      (await verify(first)).status,
      400,
      "Resend invalidates the old challenge",
    );
    assert.equal(
      (await verify(second, first.demoCode)).status,
      400,
      "Old code cannot answer the new challenge",
    );
    const accepted = await verify(second);
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), {
      mobile: "+919000000000",
      mode: "demo",
      mobileVerified: false,
    });
    assert.match(accepted.headers.get("set-cookie"), /HttpOnly/);
    assert.equal(
      (await verify(second)).status,
      400,
      "Successful challenges cannot be replayed",
    );

    const attempts = await (await request({ mobile: "9111111111" })).json();
    for (let index = 0; index < 5; index++)
      assert.equal((await verify(attempts, "000000")).status, 400);
    assert.equal(
      (await verify(attempts)).status,
      429,
      "A correct code cannot bypass exhausted attempts",
    );
    const expired = await (await request({ mobile: "9222222222" })).json();
    await writeFile(offset, String(61000 + 5 * 60000 + 1));
    assert.equal(
      (await verify(expired)).status,
      400,
      "Codes expire after five minutes",
    );
  } finally {
    await server.dispose();
  }
});

test("disabled delivery never falls back to an on-screen OTP", async () => {
  const server = await testServer();
  try {
    await server.start([], { WARRANTY_OTP_MODE: "disabled" });
    const response = await server.request("/api/warranty/otp/request", {
      mobile: "9000000000",
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).demoCode, undefined);
  } finally {
    await server.dispose();
  }
});
