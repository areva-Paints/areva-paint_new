/* Generate per-challenge demo codes with a cryptographic RNG. Only an HMAC is
 * retained by the challenge store; the code is returned solely for on-screen
 * demo entry until a real delivery provider is connected.
 */
import crypto from "node:crypto";

const key = crypto.randomBytes(32);
type PreviousCode = { id: string; codeHash: string };
const hashCode = (id: string, code: string) =>
  crypto
    .createHmac("sha256", key)
    .update(id + ":" + code)
    .digest("hex");

export function matchesWarrantyOtp(
  id: string,
  code: unknown,
  expected: string,
): boolean {
  if (
    typeof code !== "string" ||
    !/^\d{6}$/.test(code) ||
    !/^[a-f0-9]{64}$/.test(expected)
  )
    return false;
  return crypto.timingSafeEqual(
    Buffer.from(hashCode(id, code), "hex"),
    Buffer.from(expected, "hex"),
  );
}

/* A resend must also change a still-pending code, even if the RNG repeats it. */
export function createWarrantyOtp(
  id: string,
  previous: PreviousCode[] = [],
): { code: string; codeHash: string } {
  let code: string;
  do {
    code = crypto.randomInt(100000, 1000000).toString();
  } while (
    previous.some((item) => matchesWarrantyOtp(item.id, code, item.codeHash))
  );
  return { code, codeHash: hashCode(id, code) };
}
