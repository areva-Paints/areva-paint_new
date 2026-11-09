import React, { useEffect, useRef, useState } from "react";
import { Plus, ShieldCheck, X } from "lucide-react";
import { USER_ROLES, type AccountUser, type UserRole } from "./user-types";
import { AdminUpdated } from "./ActivityHistory";
async function api(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Users could not be loaded.");
  return data;
}
export function UsersManager({
  currentUser,
  onChange,
}: {
  currentUser: AccountUser | null;
  onChange: () => void;
}) {
  const [users, setUsers] = useState<AccountUser[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  const [mode, setMode] = useState<"create" | "password" | null>(null),
    [selected, setSelected] = useState<AccountUser | null>(null);
  const [name, setName] = useState(""),
    [username, setUsername] = useState(""),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<UserRole>("customer"),
    [password, setPassword] = useState(""),
    [formError, setFormError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  async function load() {
    setLoading(true);
    try {
      setUsers((await api("/api/admin/users")).users);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (mode) {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    } else dialog.current?.close();
  }, [mode]);
  function open(user?: AccountUser) {
    setSelected(user || null);
    setMode(user ? "password" : "create");
    setName("");
    setUsername("");
    setEmail("");
    setRole("customer");
    setPassword("");
    setFormError("");
  }
  function close() {
    if (busy) return;
    setMode(null);
    setPassword("");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError("");
    try {
      if (mode === "create")
        await api("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({ name, username, email, role, password }),
        });
      else
        await api("/api/admin/users/" + encodeURIComponent(selected!.id), {
          method: "PATCH",
          body: JSON.stringify({ password }),
        });
      setMode(null);
      setPassword("");
      if (mode === "password" && selected?.id === currentUser?.id) {
        window.location.assign("/admin");
        return;
      }
      setNotice(
        mode === "create"
          ? "User created. Share the login details privately."
          : "Password changed. Existing sessions for this user have been signed out.",
      );
      await load();
      onChange();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(user: AccountUser) {
    if (
      !confirm(
        `${user.active ? "Disable" : "Enable"} ${user.username}? Disabling signs out their current sessions.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/users/" + encodeURIComponent(user.id), {
        method: "PATCH",
        body: JSON.stringify({ active: !user.active }),
      });
      setNotice(
        user.active ? "User disabled and signed out." : "User enabled.",
      );
      await load();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = users.filter((user) =>
    [user.name, user.username, user.email, USER_ROLES[user.role]]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="adm-panel adm-users" aria-labelledby="adm-users-title">
      <div className="adm-panel-toolbar">
        <div>
          <h2 id="adm-users-title">User accounts</h2>
          <small>Only admins can create and manage accounts</small>
        </div>
        <button
          className="adm-primary"
          disabled={busy || loading}
          onClick={() => open()}
        >
          <Plus size={17} />
          Create user
        </button>
      </div>
      <p className="adm-history-note" style={{ paddingTop: 20 }}>
        Admins can manage website content and users. Customer, Architect and
        Builder accounts sign in on the public website and cannot access
        administration.
      </p>
      {error && (
        <div className="adm-error" role="alert">
          {error} <button onClick={() => void load()}>Reload users</button>
        </div>
      )}
      {notice && (
        <div className="adm-success" role="status">
          {notice}
        </div>
      )}
      <label className="adm-users-search">
        Search users
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name, username, email or role"
        />
      </label>
      {loading ? (
        <p className="adm-history-note" role="status">
          Loading users…
        </p>
      ) : (
        <div className="adm-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name / login</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <small>
                      {user.username}
                      {user.email ? " · " + user.email : ""}
                    </small>
                    {user.environment ? (
                      <small>Server-configured account</small>
                    ) : (
                      <AdminUpdated
                        section="users"
                        id={user.id}
                        fallback={user.updatedAt || undefined}
                      />
                    )}
                  </td>
                  <td>
                    <span className="adm-category">
                      {USER_ROLES[user.role]}
                    </span>
                  </td>
                  <td>
                    {user.active ? "Active" : "Disabled"}
                    {user.id === currentUser?.id && <small>Your account</small>}
                  </td>
                  <td>
                    {user.environment ? (
                      <span className="adm-muted">
                        <ShieldCheck size={14} /> Managed in server settings
                      </span>
                    ) : (
                      <div className="adm-row-actions">
                        <button
                          disabled={busy}
                          onClick={() => open(user)}
                          aria-label={"Reset password for " + user.username}
                        >
                          Reset password
                        </button>
                        <button
                          disabled={busy || user.id === currentUser?.id}
                          onClick={() => void toggle(user)}
                          aria-label={
                            (user.active ? "Disable " : "Enable ") +
                            user.username
                          }
                        >
                          {user.active ? "Disable" : "Enable"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="adm-history-note">No users match this search.</p>
          )}
        </div>
      )}
      <dialog
        className="adm-dialog adm-user-dialog"
        ref={dialog}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <form onSubmit={submit}>
          <div className="adm-dialog-heading">
            <div>
              <span className="adm-eyebrow">ADMIN ONLY</span>
              <h2>{mode === "create" ? "Create user" : "Reset password"}</h2>
            </div>
            <button
              type="button"
              className="adm-close"
              aria-label="Close user editor"
              disabled={busy}
              onClick={close}
            >
              <X />
            </button>
          </div>
          <div className="adm-dialog-body">
            <fieldset disabled={busy} className="adm-user-fields">
              {mode === "create" ? (
                <>
                  <label>
                    Full name
                    <input
                      required
                      maxLength={100}
                      autoComplete="off"
                      aria-label="Full name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <label>
                    User name
                    <input
                      required
                      minLength={3}
                      maxLength={80}
                      autoComplete="off"
                      pattern="[A-Za-z0-9][A-Za-z0-9._@+\-]{2,79}"
                      aria-label="User name"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                    />
                    <small>
                      3–80 letters, numbers, dots, underscores, @, + or hyphens.
                    </small>
                  </label>
                  <label>
                    Email (optional)
                    <input
                      type="email"
                      maxLength={160}
                      autoComplete="off"
                      aria-label="Email (optional)"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  <label>
                    Account role
                    <select
                      aria-label="Account role"
                      value={role}
                      onChange={(event) =>
                        setRole(event.target.value as UserRole)
                      }
                    >
                      {Object.entries(USER_ROLES).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <p>
                  Set a new password for <strong>{selected?.username}</strong>.
                </p>
              )}
              <label>
                {mode === "create" ? "Initial password" : "New password"}
                <input
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  aria-label={
                    mode === "create" ? "Initial password" : "New password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <small>
                  12–128 characters. Passwords cannot be viewed after saving.
                </small>
              </label>
            </fieldset>
            {formError && (
              <div className="adm-error" role="alert">
                {formError}
              </div>
            )}
          </div>
          <div className="adm-dialog-footer">
            <button
              type="button"
              className="adm-secondary"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </button>
            <button className="adm-primary" disabled={busy}>
              {busy
                ? "Saving…"
                : mode === "create"
                  ? "Create account"
                  : "Set new password"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
