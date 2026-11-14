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
import type { WarrantyRegistration } from "./types";
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
  });
export function WarrantyManager() {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0);
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
      });
      void warrantyApi<Page>("/api/admin/warranties?" + query)
        .then((result) => {
          if (active) {
            setData(result);
            setError("");
          }
        })
        .catch((error) => {
          if (active) setError(error.message);
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, category, page, refresh]);
  useEffect(() => {
    const focus = () => setRefresh((value) => value + 1);
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, []);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);
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
        <button
          className="adm-secondary"
          onClick={() => setRefresh((v) => v + 1)}
          disabled={busy}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
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
        Demo OTP submissions are not verified phone identities. All
        registrations await purchase and warranty review.
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
                  <span className="wr-status">Pending review</span>
                  <small>Demo · Mobile unverified</small>
                </td>
                <td>
                  <button
                    className="adm-secondary"
                    onClick={() => setSelected(row)}
                    aria-label={"View registration for " + row.customerName}
                  >
                    View details
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
              {search || category
                ? "No matching registrations"
                : "No warranty registrations yet"}
            </h3>
            <p>
              {search || category
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
                aria-label="Close registration details"
                className="wr-icon-button"
                onClick={() => setSelected(null)}
              >
                <X size={21} />
              </button>
            </div>
            <div className="wr-details-body">
              <p className="wr-demo">
                Pending review · Demo verification · Mobile ownership not
                verified
              </p>
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
              <p className="wr-admin-meta">
                Product and warranty details are snapshots from registration
                time. No warranty approval or start date is assigned
                automatically.
              </p>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
