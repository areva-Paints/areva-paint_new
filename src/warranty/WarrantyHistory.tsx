/* Customer entry hub: revisit reference-authorized purchases or start a new form.
 * Demo OTP cannot unlock all records for an arbitrary number; only full references
 * remembered here or supplied by the customer are sent to the private lookup API.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  FileSearch,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { WarrantyApiError, warrantyApi } from "./api";
import {
  readWarrantyReferences,
  rememberWarrantyReference,
} from "./customer-history";
import {
  normalizeWarrantyReference,
  WARRANTY_STATUSES,
  type WarrantyHistoryItem,
  type WarrantyHistoryResponse,
} from "./types";

const displayDate = (value: string) =>
  new Date(
    value.length === 10 ? value + "T12:00:00Z" : value,
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

export function WarrantyHistory({
  phone,
  hasDraft,
  externalBusy = false,
  onNew,
  onChangeMobile,
  onSessionExpired,
}: {
  phone: string;
  hasDraft: boolean;
  externalBusy?: boolean;
  onNew: () => void;
  onChangeMobile: () => void;
  onSessionExpired: () => void;
}) {
  const [items, setItems] = useState<WarrantyHistoryItem[]>([]);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(true),
    [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const generation = useRef(0);
  const working = busy || externalBusy;
  const sorted = (rows: WarrantyHistoryItem[]) =>
    [...rows].sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) ||
        a.reference.localeCompare(b.reference),
    );

  /* Ignore late requests after leaving this screen; never turn a failed lookup into an empty result. */
  async function load(lookup?: string) {
    const request = ++generation.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await warrantyApi<WarrantyHistoryResponse>(
        "/api/warranty/registrations/history",
        {
          references: lookup ? [lookup] : readWarrantyReferences(),
        },
      );
      if (request !== generation.current) return;
      if (lookup) {
        const found = result.registrations[0];
        if (!found)
          throw Error(
            "No registration was found for this mobile number and reference. Check the complete reference and your login mobile number.",
          );
        const stored = rememberWarrantyReference(found.reference);
        setItems((previous) =>
          sorted([
            ...previous.filter((item) => item.reference !== found.reference),
            found,
          ]),
        );
        setReference("");
        setMessage(
          stored
            ? "Registration found and remembered in this browser."
            : "Registration found. Browser storage is unavailable; keep your reference for your next visit.",
        );
      } else setItems(result.registrations);
      setLoaded(true);
    } catch (failure) {
      if (request !== generation.current) return;
      if (failure instanceof WarrantyApiError && failure.status === 401)
        onSessionExpired();
      else setError((failure as Error).message);
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, []);

  function find(event: React.FormEvent) {
    event.preventDefault();
    const value = normalizeWarrantyReference(reference);
    if (!value) {
      setError(
        "Enter your complete registration reference, starting with ARV-WR-.",
      );
      return;
    }
    void load(value);
  }

  return (
    <section className="wr-history" aria-labelledby="wr-history-title">
      <div className="wr-session">
        <span>
          Mobile number <strong>{phone}</strong> · Demo session
        </span>
        <button type="button" disabled={working} onClick={onChangeMobile}>
          Change mobile number
        </button>
      </div>
      <div className="wr-history-heading">
        <div>
          <p className="wr-kicker">YOUR PURCHASES, IN ONE PLACE</p>
          <h2 id="wr-history-title">My registrations</h2>
          <p>Check previous submissions or register another Areva purchase.</p>
        </div>
        <button
          type="button"
          className="wr-primary"
          disabled={working}
          onClick={onNew}
        >
          <Plus size={19} />
          {hasDraft ? "Continue registration" : "New registration"}
        </button>
      </div>
      <p className="wr-demo">
        <ShieldCheck size={19} aria-hidden="true" />
        Demo OTP does not verify your mobile number. This list uses registration
        references saved in this browser. To find a registration from another
        browser, enter its complete reference below.
      </p>
      <div className="wr-card wr-history-lookup">
        <h3>Find an existing registration</h3>
        <p>
          Use the reference received after submission and the mobile number used
          to log in for that registration.
        </p>
        <form onSubmit={find}>
          <label className="wr-field" htmlFor="wr-history-reference">
            Registration reference
            <input
              id="wr-history-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              maxLength={100}
              placeholder="ARV-WR-…"
              autoComplete="off"
              spellCheck={false}
              required
              disabled={working}
            />
          </label>
          <button className="wr-primary" disabled={working}>
            <FileSearch size={18} />
            Find registration
          </button>
        </form>
      </div>
      {error && (
        <p className="wr-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="wr-history-message" role="status">
          {message}
        </p>
      )}
      <div className="wr-history-results-heading">
        <p role="status">
          {busy
            ? "Checking registrations…"
            : loaded
              ? `${items.length} ${items.length === 1 ? "registration" : "registrations"} found`
              : "Registrations could not be loaded."}
        </p>
        <button
          type="button"
          className="wr-history-refresh"
          disabled={working}
          onClick={() => void load()}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
      <div className="wr-history-grid" aria-busy={busy}>
        {items.map((item) => (
          <article className="wr-card wr-history-item" key={item.reference}>
            <span className={"wr-status wr-status-" + item.status}>
              {WARRANTY_STATUSES[item.status]}
            </span>
            <p className="wr-history-category">{item.categoryName}</p>
            <h3>{item.productName}</h3>
            <dl>
              <div>
                <dt>Registration reference</dt>
                <dd className="wr-reference">{item.reference}</dd>
              </div>
              <div>
                <dt>Date of purchase</dt>
                <dd>{displayDate(item.purchaseDate)}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{displayDate(item.createdAt)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      {loaded && !busy && !items.length && (
        <div className="wr-card wr-history-empty">
          <FileSearch size={35} aria-hidden="true" />
          <h3>No registrations saved in this browser for this number</h3>
          <p>
            Start a new registration, or use your existing reference above. An
            empty list does not mean there are no earlier registrations on
            another device.
          </p>
          <button
            type="button"
            className="wr-primary"
            disabled={working}
            onClick={onNew}
          >
            {hasDraft ? "Continue registration" : "New registration"}
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </section>
  );
}
