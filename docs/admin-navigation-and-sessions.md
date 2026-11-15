# Admin navigation and inactivity sessions

The desktop left panel scrolls vertically, so all nine sections and the logout controls remain reachable on shorter screens. Its scrolling stays inside the panel. Keyboard focus also scrolls a navigation button into view. At mobile widths the existing top navigation wraps into two columns, keeping all sections available in the page flow.

Admin accounts, including the server-configured recovery admin, sign out after **five minutes without interaction**. Pointer, keyboard, wheel and touch interaction count as activity. Loading content, refreshing history, downloading reports and checking the session do not themselves reset inactivity. Sessions retain an **eight-hour absolute cap** and expire on server restart or existing account/password revocation. Other account roles and warranty-entry sessions retain their separate rules.

When inactivity expires, the portal returns to sign-in, removes open editors and private workspace data, clears the password field and discards unsaved changes without a confirmation prompt. It does not automatically save drafts. Browser sleep/background suspension is checked using wall-clock time when the page resumes, before counting a new interaction. Tabs sharing one admin session coordinate real activity and sign-out. A new login has a new coordination identifier so old tab messages do not affect it. If browser storage is unavailable, each tab still enforces its own idle deadline and the backend remains authoritative.

## Implementation

- `session-policy.ts` defines the fixed five-minute idle limit, eight-hour cap, 15-second heartbeat interval and maximum one-minute reported interaction delay. No environment variable shortens or disables production expiry.
- The server's in-memory session stores last interaction time and a separate `activityId`. This identifier is not the authentication cookie/token. `currentUser()` checks both deadlines without extending them; therefore every protected admin route enforces expiry, including source/private receipt/report access.
- `GET /api/admin/session` returns the authenticated user and session timing. Its server timestamp lets the client interpret deadlines without assuming its clock matches the server.
- `POST /api/admin/activity` requires an active admin, same-origin JSON and a valid `{ idleForMs }` value from 0 to 60,000. It is limited to 120 requests/minute per IP. The reported delay prevents a throttled heartbeat from counting as new activity after typing stops. Expired sessions cannot be revived, and interaction never extends the absolute cap. Heartbeats do not add audit-history entries.
- `useAdminIdleSession.ts` responds to trusted input, sends immediate/throttled trailing heartbeats while activity is pending and stops sending when idle. Focus/visibility/page restoration verifies the session without refreshing it. Cross-tab storage contains only an identifier, event type and timestamp, never credentials or customer data.
- Idle sign-out uses `POST /api/admin/logout` with the coordination `activityId`. The handler revokes only the matching cookie/session and does not send a cookie-clearing header; an old delayed response cannot clear a newer login. The revoked cookie cannot access the backend and is overwritten at the next login. Manual logout without this optional field retains its existing cookie-clearing behavior and unsaved-change prompt.
- The workspace clears authentication/data immediately and ignores old content/history responses after sign-out. A failed logout network request does not turn off local expiry; the server still rejects idle tokens on the next request.

Sessions are process-local and not database rows. This change does not require a SQL migration, alter persistent content, send messages or change provider settings.

## Validation

`tests/admin-idle.test.mjs` runs an isolated server with a test-only Node clock preloader outside the source tree. It checks the exact five-minute boundary, ordinary/background requests, invalid and stale activity, both admin types, unchanged customer session behavior, the absolute cap, scoped logout races and manual logout. Browser checks advance only the isolated browser/server clocks to verify sidebar wheel/keyboard access, mobile layouts, active-user and multi-tab behavior, open-editor expiry, synthetic-event rejection and re-login. No production clock or timeout setting is modified.
