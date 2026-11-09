import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { contentOrigin } from "../site-content";
import {
  USER_ROLES,
  type AccountUser,
  type UserRole,
} from "../admin/user-types";
const roles: UserRole[] = ["customer", "architect", "builder"];
export function AccountAccess() {
  const [user, setUser] = useState<AccountUser | null>(null),
    [role, setRole] = useState<UserRole>("customer"),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const origin = contentOrigin(),
    remote = origin !== location.origin;
  async function api(path: string, body?: unknown) {
    const r = await fetch("/api/auth/" + path, {
      cache: "no-store",
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Please sign in again.");
    return d;
  }
  useEffect(() => {
    if (!remote)
      void api("session")
        .then((d) => {
          setUser(d.user);
          setRole(d.user.role);
        })
        .catch(() => {});
  }, [remote]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  function close() {
    if (busy) return;
    setOpen(false);
    setPassword("");
    setError("");
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("login", { username, password, role });
      const d = await api("session");
      setUser(d.user);
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("logout", {});
      setUser(null);
      setUsername("");
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="areva-account-open"
        onClick={() => {
          if (remote) {
            location.assign(origin + "/attached-page?account=Customer");
            return;
          }
          setRole(user?.role || "customer");
          setOpen(true);
        }}
      >
        {user ? "My account" : "Sign in"}
      </button>
      <dialog
        className="areva-account-dialog"
        aria-labelledby="react-account-signin-title"
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <button
          className="areva-account-close"
          onClick={close}
          disabled={busy}
          aria-label="Close sign in"
        >
          <X />
        </button>
        <h2 id="react-account-signin-title">Sign in</h2>
        <div className="areva-account-roles">
          {roles.map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={role === item}
              disabled={busy}
              onClick={() => {
                setRole(item);
                setError("");
                setPassword("");
              }}
            >
              {USER_ROLES[item]}
            </button>
          ))}
          <a href="/admin">Admin</a>
        </div>
        {error && <p role="alert">{error}</p>}
        {user && user.role === role ? (
          <div>
            <h3>Welcome, {user.name}</h3>
            <p>
              {USER_ROLES[user.role]} · {user.username}
            </p>
            <button onClick={logout} disabled={busy}>
              Logout
            </button>
          </div>
        ) : (
          <form onSubmit={login}>
            <label>
              Email or username
              <input
                required
                maxLength={160}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                required
                maxLength={128}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        )}
        <p>
          Use the account created by your administrator. Only admins can create
          users.
        </p>
      </dialog>
    </>
  );
}
