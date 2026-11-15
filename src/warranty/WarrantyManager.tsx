import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { warrantyApi } from "./api";
import {
  WARRANTY_STATUSES,
  type WarrantyRegistration,
  type WarrantyStatus,
} from "./types";
import { CATEGORIES } from "../data/paintsData";
import "./warranty.css";

type Page = {
  registrations: WarrantyRegistration[];
  total: number;
  page: number;
  pages: number;
};
const date = (value: string) =>
  new Date(
    value.length === 10 ? value + "T12:00:00Z" : value,
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
export function WarrantyManager() {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0),
    [status, setStatus] = useState(""),
    [dateBy, setDateBy] = useState("registration"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [decision, setDecision] = useState<WarrantyStatus>("pending_review"),
    [reviewNotes, setReviewNotes] = useState(""),
    [approvalConfirmed, setApprovalConfirmed] = useState(false),
    [reviewSaving, setReviewSaving] = useState(false),
    [reviewError, setReviewError] = useState(""),
    [reviewNotice, setReviewNotice] = useState("");
  const [data, setData] = useState<Page | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<WarrantyRegistration | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    setBusy(true);
    const timer = setTimeout(() => {
      const query = new URLSearchParams({
        search,
        category,
        page: String(page),
        status,
        dateBy,
        from,
        to,
      });
      void warrantyApi<Page>("/api/admin/warranties?" + query)
        .then((result) => {
          if (active) {
            setData(result);
            setError("");
          }
        })
        .catch((error) => {
          if (active) {
            setError(error.message);
            setData(null);
          }
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, category, page, refresh, status, dateBy, from, to]);
  useEffect(() => {
    const focus = () => setRefresh((value) => value + 1);
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, []);
  useEffect(() => {
    if (selected) {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else dialog.current?.close();
  }, [selected]);
  function openReview(row: WarrantyRegistration) {
    setSelected(row);
    setDecision(row.status);
    setReviewNotes(row.reviewNotes || "");
    setApprovalConfirmed(row.approvalConfirmed || false);
    setReviewError("");
    setReviewNotice("");
  }
  async function reloadReview() {
    if (!selected) return;
    setReviewSaving(true);
    setReviewError("");
    try {
      const data = await warrantyApi<{ registration: WarrantyRegistration }>(
        "/api/admin/warranties/" + selected.id,
      );
      openReview(data.registration);
      setRefresh((v) => v + 1);
    } catch (error) {
      setReviewError((error as Error).message);
    } finally {
      setReviewSaving(false);
    }
  }
  async function saveReview(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setReviewSaving(true);
    setReviewError("");
    setReviewNotice("");
    try {
      const data = await warrantyApi<{ registration: WarrantyRegistration }>(
        "/api/admin/warranties/" + selected.id,
        {
          status: decision,
          notes: reviewNotes,
          expectedVersion: selected.version,
          approvalConfirmed,
        },
        "PATCH",
      );
      setSelected(data.registration);
      setRefresh((v) => v + 1);
      setReviewNotice(
        "Review saved: " +
          WARRANTY_STATUSES[data.registration.status] +
          ". Mobile verification is unchanged.",
      );
    } catch (error) {
      setReviewError((error as Error).message);
    } finally {
      setReviewSaving(false);
    }
  }
  function resetFilters() {
    setSearch("");
    setCategory("");
    setStatus("");
    setDateBy("registration");
    setFrom("");
    setTo("");
    setPage(1);
  }
  const hasFilters = Boolean(
    search || category || status || from || to || dateBy !== "registration",
  );
  function field(label: string, value: unknown) {
    return (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value ? String(value) : "—"}</dd>
      </div>
    );
  }
  return (
    <section className="wr-admin" aria-label="Warranty registrations">
      <div className="wr-admin-toolbar">
        <label className="wr-admin-search">
          <Search size={18} />
          <span className="wr-sr-only">Search warranty registrations</span>
          <input
            type="search"
            maxLength={200}
            placeholder="Search reference, name, mobile, invoice, product, dealer…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="wr-field">
          Product type
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All product types</option>
            {CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="wr-field">
          Review status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {Object.entries(WARRANTY_STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="adm-secondary"
          onClick={() => setRefresh((v) => v + 1)}
          disabled={busy}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
      <div className="wr-admin-date-filters" aria-label="Warranty date filters">
        <label className="wr-field">
          Date field
          <select
            value={dateBy}
            onChange={(e) => {
              setDateBy(e.target.value);
              setPage(1);
            }}
          >
            <option value="registration">Registration date</option>
            <option value="purchase">Purchase date</option>
          </select>
        </label>
        <label className="wr-field">
          From date
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="wr-field">
          To date
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <button
          className="adm-secondary"
          type="button"
          disabled={!hasFilters}
          onClick={resetFilters}
        >
          Reset filters
        </button>
        <small>Inclusive dates · India Standard Time</small>
      </div>
      <p className="wr-admin-meta" role="status">
        {busy
          ? "Loading registrations…"
          : `${data?.total || 0} registration(s) found`}
      </p>
      {error && (
        <p className="wr-error" role="alert">
          {error}
        </p>
      )}
      <div className="wr-demo">
        <ShieldCheck size={19} />
        Demo OTP does not verify mobile ownership. Admins can manually review
        and approve purchases without changing the mobile-verification flag.
      </div>
      <div className="wr-admin-table">
        <table aria-label="Saved warranty registrations">
          <thead>
            <tr>
              <th>Reference / date</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Dealer / invoice</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {data?.registrations.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong className="wr-table-reference">
                    {row.reference}
                  </strong>
                  <small>{date(row.createdAt)}</small>
                </td>
                <td>
                  {row.customerName}
                  <small>{row.mobile}</small>
                  <small>
                    {row.city}, {row.state}
                  </small>
                </td>
                <td>
                  {row.productName}
                  <small>{row.categoryName}</small>
                  <small>Purchased {date(row.purchaseDate)}</small>
                </td>
                <td>
                  {row.dealerName}
                  <small>{row.invoiceNumber}</small>
                  <small>{row.dealerCity}</small>
                </td>
                <td>
                  <span className={"wr-status wr-status-" + row.status}>
                    {WARRANTY_STATUSES[row.status]}
                  </span>
                  <small>Demo · Mobile unverified</small>
                </td>
                <td>
                  <button
                    className="adm-secondary"
                    onClick={() => openReview(row)}
                    aria-label={"View registration for " + row.customerName}
                  >
                    View / review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!busy && !error && !data?.registrations.length && (
          <div className="wr-admin-empty">
            <ShieldCheck size={32} />
            <h3>
              {hasFilters
                ? "No matching registrations"
                : "No warranty registrations yet"}
            </h3>
            <p>
              {hasFilters
                ? "Try another search or product type."
                : "Submitted warranty details and private receipts will appear here."}
            </p>
          </div>
        )}
      </div>
      {data && data.pages > 1 && (
        <div className="wr-admin-pages">
          <button
            className="adm-secondary"
            disabled={busy || page <= 1}
            onClick={() => setPage((v) => v - 1)}
          >
            <ArrowLeft size={16} />
            Previous
          </button>
          <span>
            Page {data.page} of {data.pages}
          </span>
          <button
            className="adm-secondary"
            disabled={busy || page >= data.pages}
            onClick={() => setPage((v) => v + 1)}
          >
            Next
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      <dialog
        className="wr-details"
        ref={dialog}
        aria-labelledby="wr-details-title"
        onClose={() => setSelected(null)}
        onCancel={(event) => {
          if (reviewSaving) event.preventDefault();
        }}
      >
        {selected && (
          <>
            <div className="wr-details-header">
              <div>
                <p className="wr-kicker">AREVA PAINTS · PRIVATE RECORD</p>
                <h2 id="wr-details-title">Warranty registration</h2>
                <p className="wr-reference">{selected.reference}</p>
              </div>
              <button
                disabled={reviewSaving}
                aria-label="Close registration details"
                className="wr-icon-button"
                onClick={() => setSelected(null)}
              >
                <X size={21} />
              </button>
            </div>
            <div className="wr-details-body">
              <p className="wr-demo">
                {WARRANTY_STATUSES[selected.status]} · Demo verification ·
                Mobile ownership not verified
              </p>
              <form className="wr-review-form" onSubmit={saveReview}>
                <h3>Review & approval</h3>
                <p>
                  Review the purchase details and attached receipt before making
                  a decision. Approval is a manual admin decision; it does not
                  verify the mobile number or assign a warranty start date.
                </p>
                {reviewError && (
                  <p className="wr-error" role="alert">
                    {reviewError}
                  </p>
                )}
                {reviewNotice && (
                  <p className="wr-review-notice" role="status">
                    {reviewNotice}
                  </p>
                )}
                <label className="wr-field">
                  Review decision
                  <select
                    disabled={reviewSaving}
                    value={decision}
                    onChange={(e) => {
                      setDecision(e.target.value as WarrantyStatus);
                      setApprovalConfirmed(false);
                      setReviewNotice("");
                    }}
                  >
                    {Object.entries(WARRANTY_STATUSES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wr-field">
                  Review notes
                  {["rejected", "needs_information"].includes(decision)
                    ? " *"
                    : ""}
                  <textarea
                    disabled={reviewSaving}
                    required={["rejected", "needs_information"].includes(
                      decision,
                    )}
                    maxLength={2000}
                    rows={3}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add the reason, purchase checks or information needed…"
                  />
                </label>
                {decision === "needs_information" && (
                  <p className="wr-admin-meta">
                    This saves the follow-up status and notes; no SMS or
                    WhatsApp message is sent.
                  </p>
                )}
                {decision === "approved" && (
                  <label className="wr-consent">
                    <input
                      type="checkbox"
                      disabled={reviewSaving}
                      required
                      checked={approvalConfirmed}
                      onChange={(e) => setApprovalConfirmed(e.target.checked)}
                    />
                    <span>
                      I reviewed the purchase details and receipt. I understand
                      that the mobile number has not been OTP verified.
                    </span>
                  </label>
                )}
                <div className="wr-inline-actions">
                  <button className="wr-primary" disabled={reviewSaving}>
                    {reviewSaving
                      ? "Saving review…"
                      : decision === "approved"
                        ? "Approve registration"
                        : decision === "rejected"
                          ? "Reject registration"
                          : decision === "needs_information"
                            ? "Request information"
                            : "Save review"}
                  </button>
                  <button
                    type="button"
                    disabled={reviewSaving}
                    onClick={() => void reloadReview()}
                  >
                    Reload latest record
                  </button>
                </div>
                {selected.reviewedAt && (
                  <p className="wr-admin-meta">
                    Last reviewed by <strong>{selected.reviewedBy}</strong> ·{" "}
                    {new Date(selected.reviewedAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}{" "}
                    IST
                  </p>
                )}
              </form>
              <h3>Customer & site</h3>
              <dl className="wr-detail-grid">
                {field("Customer", selected.customerName)}
                {field("Mobile", selected.mobile)}
                {field("Email", selected.email)}
                {field("Alternate mobile", selected.alternateMobile)}
                {field("Site address", selected.siteAddress)}
                {field("City", selected.city)}
                {field("State", selected.state)}
                {field("PIN code", selected.pinCode)}
              </dl>
              <h3>Product & purchase</h3>
              <dl className="wr-detail-grid">
                {field("Product", selected.productName)}
                {field("Product type", selected.categoryName)}
                {field("Purchase date", date(selected.purchaseDate))}
                {field("Quantity (packs)", selected.quantity)}
                {field("Pack size", selected.packSize)}
                {field("Batch / lot number", selected.batchNumber)}
                {field("Shade", selected.shade)}
                {field(
                  "Warranty duration",
                  selected.warrantyYears > 0
                    ? `${selected.warrantyYears} year(s)`
                    : "To be confirmed",
                )}
                {field("Warranty label", selected.warrantyLabel)}
              </dl>
              <h3>Dealer & receipt</h3>
              <dl className="wr-detail-grid">
                {field("Dealer", selected.dealerName)}
                {field("Dealer phone", selected.dealerPhone)}
                {field("Dealer address", selected.dealerAddress)}
                {field("Dealer city", selected.dealerCity)}
                {field("Invoice number", selected.invoiceNumber)}
                {field("Receipt", selected.receipt.name)}
              </dl>
              <a
                className="wr-primary"
                href={"/api/admin/warranties/" + selected.id + "/receipt"}
              >
                <Download size={17} />
                Download private receipt
              </a>
              <h3>Application & additional details</h3>
              <dl className="wr-detail-grid">
                {field(
                  "Completion date",
                  selected.applicationDate
                    ? date(selected.applicationDate)
                    : "",
                )}
                {field("Painted area (sq ft)", selected.paintedArea)}
                {field("Applicator", selected.applicatorName)}
                {field("Applicator phone", selected.applicatorPhone)}
                {field("Notes", selected.notes)}
                {field(
                  "Submitted",
                  new Date(selected.createdAt).toLocaleString("en-IN"),
                )}
                {field(
                  "Contact consent",
                  selected.consent ? "Confirmed" : "Not given",
                )}
              </dl>
              {selected.reviewHistory?.length > 0 && (
                <>
                  <h3>Review history</h3>
                  <ol className="wr-review-history">
                    {[...selected.reviewHistory].reverse().map((review) => (
                      <li key={review.id}>
                        <strong>{WARRANTY_STATUSES[review.status]}</strong>
                        <span>
                          {review.actor} ·{" "}
                          {new Date(review.at).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })}{" "}
                          IST
                        </span>
                        {review.notes && <p>{review.notes}</p>}
                      </li>
                    ))}
                  </ol>
                </>
              )}
              <p className="wr-admin-meta">
                Product and warranty details are snapshots from registration
                time. Review decisions are recorded above; a warranty start date
                is not assigned automatically.
              </p>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
