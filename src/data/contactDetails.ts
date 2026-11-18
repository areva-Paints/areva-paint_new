/*
 * Share contact-number syntax checks across enquiry, dealer and warranty APIs.
 * Syntax validation is separate from OTP verification of ownership.
 */
/**
 * Validate a contact number without claiming that its owner has been verified.
 * Formatting characters are allowed, but a useful international/landline number
 * must contain 7–15 digits. Warranty login uses its stricter Indian-mobile rule.
 */
export function validContactPhone(value: unknown): value is string {
  if (typeof value !== "string" || !/^\+?[0-9 ()-]{7,25}$/.test(value))
    return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}
