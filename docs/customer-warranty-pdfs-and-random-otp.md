# Customer warranty PDFs and random demo OTP — 23 November 2026

## Customer flow

1. Open Warranty Registration and enter the primary/login mobile number.
2. Enter the new six-digit demo code displayed on that page.
3. In **My registrations**, use the saved browser references or **Find an existing registration** with the complete registration reference.
4. Approved cards show **View PDF** and **Download PDF**. View opens a modal preview with its own download link. Close returns to the same registration list. Browsers without a PDF preview can still download the file.

The report includes all saved registration details, final approval, review notes, reviewer/time and review history. Customer and admin downloads use the same generator and saved record. Existing approvals work without reapproval. Purchase receipts and building photos are listed as attachment metadata; their original files remain separate, admin-only attachments.

Pending review, needs-information and rejected cards do not provide customer PDFs. Admins retain their existing decision-report downloads for both final statuses. Submission, approval and PDF access do not turn a demo phone number into a verified identity or assign a warranty start date.

## Private PDF API

`POST /api/warranty/registrations/report.pdf`

```json
{ "reference": "ARV-WR-YYYYMMDD-<complete UUID>" }
```

- Requires the live HttpOnly warranty-session cookie before parsing the request body (4 KiB limit).
- Requires the full reference, matching server-side login mobile and saved `approved` status. Posted phone numbers and verification flags do not authorize access.
- Applies same-origin/JSON guards and 30 requests per minute per IP. Customer and admin routes share a maximum of two active PDF jobs.
- Rechecks the session, saved ownership, status and version after generating the PDF. Unapproved records return 409; nonmatching references return 404 without exposing another customer's record.
- Returns a no-store PDF attachment with sandbox and MIME-sniffing protection. The browser uses a temporary Blob URL, aborts abandoned requests and revokes preview/download URLs. There is no public report URL or reference in a query string.
- Records successful PDF access in the existing private history-access audit. No raw session token or phone number is written to that audit.

The warranty page uses no-store and frame-denial headers. Only its frame policy additionally permits Blob previews; the public site's frame policy is unchanged.

## Random demo codes

`crypto.randomInt(100000, 1000000)` generates the six-digit value. Each challenge retains only a challenge-bound HMAC with a random process secret. Comparison is constant-time. Codes expire after five minutes; five incorrect entries block a challenge. Successful entry consumes it. Resend is available after 60 seconds, invalidates the previous pending challenge and guarantees a different pending code. Existing request/attempt rate limits and bounded maps still apply.

This remains **demo mode**: the code is displayed on-screen, no SMS/WhatsApp is sent, and `mobileVerified` remains false. A phone number alone therefore cannot enumerate registrations. Keep the full-reference requirement until real provider-backed verification is implemented. `WARRANTY_OTP_MODE=disabled` refuses entry; no provider failure falls back to demo delivery.

## Storage and hosting

The runtime continues to use private JSON on the persistent disk. Reports are generated on demand from the immutable final review snapshot; PDF bytes are not archived as separate files. Customer and admin reports use the same saved timestamp and contents. Codes, their keyed hashes and sessions exist only in memory and clear on restart.

No new table or migration is required. The prepared SQL schema remains at 24 tables: `warranty_registrations` already holds registration/review details and `warranty_history_access` holds the audit. No hosted database migration is performed. Existing persistent records and backups remain compatible.

Deploy the application as described in [README](../README.md), retaining `assets/fonts`, the server source and the persistent data directory. No new environment variables or dependencies are needed. Real Meta WhatsApp OTP delivery and sending an approved PDF as a WhatsApp message remain separate integrations.

## Verification

`tests/warranty-otp.test.mjs` checks random generation, challenge-bound hashes, RNG collision/redraw, resend, expiry, attempt limits, replay and disabled mode. `tests/warranty-customer-report.test.mjs` checks identical admin/customer PDF bytes and saved review text, correct ownership, nonapproved denial, origin/auth/session guards, private attachments, audit and preview headers. The existing warranty, review, PDF, history and prepared-SQL regressions also apply.
