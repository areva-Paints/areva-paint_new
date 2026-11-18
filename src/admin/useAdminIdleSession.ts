/*
 * Track real admin interactions and synchronize session-scoped activity across tabs.
 * Visibility changes recheck expiry; background network traffic cannot keep an idle session alive.
 */
import { useEffect, useRef } from "react";
import {
  ADMIN_ACTIVITY_INTERVAL_MS,
  ADMIN_ACTIVITY_MAX_DELAY_MS,
  ADMIN_IDLE_TIMEOUT_MS,
  type AdminSessionTiming,
} from "./session-policy";

const storageKey = "areva-admin-session-activity";
type SignoutReason = "idle" | "expired" | "signed_out" | "changed";
type Message = { scope: string; kind: "activity" | "logout"; at: number };
/* Publish a session-scoped activity/sign-out message to other admin tabs. */
function announce(message: Message) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(message));
  } catch {
    /* Per-tab expiry still works if storage is disabled. */
  }
}
/* Notify same-origin admin tabs that the current session has ended. */
export function announceAdminSignout(scope?: string) {
  if (scope) announce({ scope, kind: "logout", at: Date.now() });
}

/* Observe user interactions and reconcile the five-minute idle deadline with the server. */
export function useAdminIdleSession(
  authenticated: boolean,
  timing: AdminSessionTiming | null,
  onSignedOut: (reason: SignoutReason) => void,
) {
  const callback = useRef(onSignedOut);
  callback.current = onSignedOut;
  useEffect(() => {
    if (!authenticated || !timing) return;
    const scope = timing.activityId;
    const startedAt = Date.now();
    let serverDeadline = startedAt + (timing.idleExpiresAt - timing.serverTime);
    let absoluteDeadline = startedAt + (timing.expiresAt - timing.serverTime);
    let lastActivity = serverDeadline - ADMIN_IDLE_TIMEOUT_MS;
    let ended = false,
      disposed = false,
      pending = false,
      inFlight = false,
      verifying = false;
    let lastSent = 0,
      lastAnnounced = 0;
    let expiryTimer: ReturnType<typeof setTimeout>,
      activityTimer: ReturnType<typeof setTimeout>;

    /* Stop session activity and notify the parent that authentication has expired. */
    function end(reason: SignoutReason, notify = true) {
      if (ended || disposed) return;
      ended = true;
      clearTimeout(expiryTimer);
      clearTimeout(activityTimer);
      if (notify) {
        announceAdminSignout(scope);
        // Scoped revocation never clears a newer login's cookie or another session.
        void fetch("/api/admin/logout", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activityId: scope }),
        }).catch(() => {});
      }
      callback.current(reason);
    }
    /* Accept only activity messages for the current server session scope. */
    function syncSharedActivity() {
      try {
        const value = JSON.parse(
          localStorage.getItem(storageKey) || "null",
        ) as Message | null;
        if (
          !value ||
          value.scope !== scope ||
          !Number.isFinite(value.at) ||
          value.at > Date.now() + 1000
        )
          return;
        if (value.kind === "logout") end("signed_out", false);
        else if (value.kind === "activity" && value.at > lastActivity)
          lastActivity = value.at;
      } catch {
        /* Ignore malformed/unavailable shared metadata. */
      }
    }
    /* Compare idle and absolute deadlines and end sessions that have expired. */
    function check() {
      if (ended || disposed) return;
      syncSharedActivity();
      if (ended) return;
      const now = Date.now();
      if (now >= absoluteDeadline) {
        end("expired");
        return;
      }
      if (now >= lastActivity + ADMIN_IDLE_TIMEOUT_MS) {
        end("idle");
        return;
      }
      clearTimeout(expiryTimer);
      expiryTimer = setTimeout(
        check,
        Math.min(absoluteDeadline, lastActivity + ADMIN_IDLE_TIMEOUT_MS) - now,
      );
    }
    /* Reconcile server timing with browser elapsed time without reviving expired sessions. */
    function acceptTiming(value: AdminSessionTiming) {
      if (ended || disposed || !value) return;
      if (value.activityId !== scope) {
        end("changed", false);
        return;
      }
      serverDeadline = Date.now() + (value.idleExpiresAt - value.serverTime);
      absoluteDeadline = Math.min(
        absoluteDeadline,
        Date.now() + (value.expiresAt - value.serverTime),
      );
    }
    /* Send the most recent real interaction to the server with bounded request frequency. */
    async function flushActivity() {
      check();
      if (ended || disposed || !pending || inFlight) return;
      pending = false;
      const idleForMs = Math.max(0, Date.now() - lastActivity);
      announce({ scope, kind: "activity", at: lastActivity });
      if (idleForMs > ADMIN_ACTIVITY_MAX_DELAY_MS) return;
      inFlight = true;
      lastSent = Date.now();
      try {
        const response = await fetch("/api/admin/activity", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idleForMs }),
        });
        if (response.status === 401) {
          end("expired");
          return;
        }
        if (response.ok) acceptTiming((await response.json()).timing);
      } catch {
        /* Local inactivity still signs out offline; server checks its own clock. */
      } finally {
        inFlight = false;
        if (pending) queueActivity();
      }
    }
    /* Batch interaction notifications instead of sending one request per input event. */
    function queueActivity() {
      if (ended || disposed || !pending || inFlight) return;
      clearTimeout(activityTimer);
      const delay =
        serverDeadline - Date.now() <= ADMIN_ACTIVITY_INTERVAL_MS + 5000
          ? 0
          : Math.max(0, ADMIN_ACTIVITY_INTERVAL_MS - (Date.now() - lastSent));
      activityTimer = setTimeout(() => void flushActivity(), delay);
    }
    /* Record a trusted foreground interaction as admin activity. */
    function interaction(event: Event) {
      if (!event.isTrusted || ended || disposed) return;
      // Check before counting the first event after sleep/idle; it cannot revive a session.
      check();
      if (ended) return;
      lastActivity = Date.now();
      pending = true;
      if (lastActivity - lastAnnounced >= 1000) {
        announce({ scope, kind: "activity", at: lastActivity });
        lastAnnounced = lastActivity;
      }
      check();
      queueActivity();
    }
    /* Recheck expiration when a suspended or hidden page becomes active. */
    async function resumed() {
      check();
      if (
        ended ||
        disposed ||
        document.visibilityState === "hidden" ||
        verifying
      )
        return;
      verifying = true;
      try {
        const response = await fetch("/api/admin/session", {
          cache: "no-store",
        });
        if (response.status === 401) end("expired");
        else if (response.ok) acceptTiming((await response.json()).timing);
      } catch {
        /* Do not treat a network outage as user activity. */
      } finally {
        verifying = false;
      }
    }
    /* Handle a same-session activity or sign-out message from another tab. */
    const shared = (event: StorageEvent) => {
      if (event.key === storageKey) check();
    };
    const events = [
      "pointerdown",
      "pointermove",
      "keydown",
      "wheel",
      "touchstart",
      "input",
      "change",
    ];
    for (const name of events)
      document.addEventListener(name, interaction, {
        capture: true,
        passive: true,
      });
    window.addEventListener("storage", shared);
    window.addEventListener("focus", resumed);
    document.addEventListener("visibilitychange", resumed);
    window.addEventListener("pageshow", resumed);
    check();
    return () => {
      disposed = true;
      clearTimeout(expiryTimer);
      clearTimeout(activityTimer);
      for (const name of events)
        document.removeEventListener(name, interaction, true);
      window.removeEventListener("storage", shared);
      window.removeEventListener("focus", resumed);
      document.removeEventListener("visibilitychange", resumed);
      window.removeEventListener("pageshow", resumed);
    };
  }, [authenticated, timing?.activityId]);
}
