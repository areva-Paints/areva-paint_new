/*
 * Guide visitors through mobile entry, demo OTP and a complete purchase form.
 * Submission stays on confirmation; leaving via Back to website clears entry so a later visit starts at the mobile screen.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { contentOrigin, contentUrl } from "../site-content";
import { BrandLogo } from "../components/BrandLogo";
import { warrantyApi } from "./api";
import { type WarrantyInput, type ReceiptInfo } from "./types";
import type { Product } from "../types";
import type { Dealer } from "../admin/content-types";
import { CATEGORIES } from "../data/paintsData";
import "./warranty.css";
import "../../public/assets/page-gradient.css";

type Options = {
  otpMode: "demo" | "disabled";
  today: string;
  products: Product[];
  dealers: Dealer[];
};
/* Initialize a fresh purchase form with no inherited customer or receipt data. */
const empty = (): WarrantyInput => ({
  customerName: "",
  email: "",
  alternateMobile: "",
  productId: "",
  purchaseDate: "",
  quantity: "1",
  packSize: "",
  batchNumber: "",
  shade: "",
  dealerId: "",
  dealerName: "",
  dealerPhone: "",
  dealerAddress: "",
  dealerCity: "",
  invoiceNumber: "",
  siteAddress: "",
  city: "",
  state: "",
  pinCode: "",
  applicationDate: "",
  paintedArea: "",
  applicatorName: "",
  applicatorPhone: "",
  notes: "",
  receiptId: "",
  consent: false,
  submissionId: crypto.randomUUID(),
});
/* Guide visitors through mobile entry, demo OTP and a complete purchase form. */
export function WarrantyPage() {
  const [options, setOptions] = useState<Options | null>(null),
    [step, setStep] = useState<"phone" | "otp" | "form" | "success">("phone");
  const [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [challenge, setChallenge] = useState(""),
    [demoCode, setDemoCode] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retryAt, setRetryAt] = useState(0),
    [now, setNow] = useState(Date.now());
  const [form, setForm] = useState<WarrantyInput>(empty),
    [category, setCategory] = useState(""),
    [receipt, setReceipt] = useState<ReceiptInfo | null>(null),
    [reference, setReference] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null),
    headingRef = useRef<HTMLHeadingElement>(null);
  const remote = contentOrigin() !== location.origin;
  /* Clear form/session UI so a later entry begins at the mobile screen. */
  function resetEntry() {
    setStep("phone");
    setPhone("");
    setCode("");
    setChallenge("");
    setDemoCode("");
    setRetryAt(0);
    setForm(empty());
    setCategory("");
    setReceipt(null);
    setReference("");
    setError("");
    setBusy(false);
  }
  /* Begin every visit with fresh mobile entry and clean up the back/forward-cache listener on unmount. */
  useEffect(() => {
    if (remote) {
      location.replace(contentUrl("/warranty") + location.search);
      return;
    }
    let active = true;
    let load = 0;
    /* End any previous warranty session before opening a fresh entry flow. */
    function startEntry() {
      const currentLoad = ++load;
      resetEntry();
      setOptions(null);
      // A new visit must start at mobile entry, even if an earlier OTP cookie remains.
      void Promise.all([
        warrantyApi<Options>("/api/warranty/options"),
        warrantyApi("/api/warranty/logout", {}),
      ])
        .then(([data]) => {
          if (active && currentLoad === load) setOptions(data);
        })
        .catch((error) => {
          if (active && currentLoad === load) setError(error.message);
        });
    }
    /* Reset entry after browser back/forward restoration instead of reopening an old purchase form. */
    function restored(event: PageTransitionEvent) {
      if (event.persisted) startEntry();
    }
    startEntry();
    window.addEventListener("pageshow", restored);
    return () => {
      active = false;
      window.removeEventListener("pageshow", restored);
    };
  }, [remote]);
  /* Update the resend countdown while the page is mounted, then release its timer. */
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  /* Move accessible focus to the current step heading after a warranty-flow transition. */
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);
  /* Invalidate warranty entry and navigate back to the public website. */
  async function backToWebsite(event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    setBusy(true);
    try {
      await warrantyApi("/api/warranty/logout", {});
    } catch {
      // Navigation remains available; the next visit also clears any old session.
    } finally {
      resetEntry();
      location.assign("/");
    }
  }
  const product = options?.products.find((p) => p.id === form.productId);
  const wait = Math.max(0, Math.ceil((retryAt - now) / 1000));
  /* Update one draft field while preserving the other form values. */
  function patch(key: keyof WarrantyInput, value: unknown) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  /* Start a demo mobile challenge and display the configured demonstration code. */
  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await warrantyApi("/api/warranty/otp/request", {
        mobile: phone,
      });
      setChallenge(data.challengeId);
      setDemoCode(data.demoCode);
      setRetryAt(Date.now() + data.resendAfter * 1000);
      setCode("");
      setStep("otp");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  /* Exchange the challenge/code for a scoped demo session without claiming phone ownership. */
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await warrantyApi("/api/warranty/otp/verify", {
        challengeId: challenge,
        code,
      });
      setPhone(data.mobile);
      setStep("form");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  /* End the current entry session and return to the initial mobile step. */
  async function changeMobile() {
    setBusy(true);
    setError("");
    try {
      await warrantyApi("/api/warranty/logout", {});
      setForm(empty());
      setReceipt(null);
      setPhone("");
      setCode("");
      setChallenge("");
      setStep("phone");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  /* Attach an allowed receipt to the current private session before submission. */
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (
      !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
        file.type,
      ) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Choose a PDF, JPEG, PNG or WebP receipt up to 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(Error("The receipt could not be read."));
        reader.readAsDataURL(file);
      });
      const saved = await warrantyApi<ReceiptInfo>("/api/warranty/receipt", {
        data,
        name: file.name,
      });
      setReceipt(saved);
      patch("receiptId", saved.id);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }
  /* Save the complete purchase once and remain on the confirmation screen. */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!receipt) {
      setError("Attach your dealer purchase/payment receipt.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await warrantyApi("/api/warranty/registrations", form);
      setReference(saved.reference);
      setStep("success");
      setReceipt(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  /* Populate dealer fields from the selected catalogue snapshot while allowing manual details. */
  function chooseDealer(id: string) {
    const dealer = options?.dealers.find((d) => d.id === id);
    setForm((previous) => ({
      ...previous,
      dealerId: id,
      dealerName: dealer?.name || "",
      dealerPhone: dealer?.phone || "",
      dealerAddress: dealer?.address || "",
      dealerCity: dealer?.city || "",
    }));
  }
  /* Render a controlled form field using the shared label and change handler. */
  function input(
    key: keyof WarrantyInput,
    label: string,
    required = false,
    type = "text",
    max = 150,
  ) {
    return (
      <label className="wr-field">
        {label}
        {required ? " *" : ""}
        <input
          name={key}
          type={type}
          required={required}
          maxLength={max}
          value={String(form[key])}
          onChange={(e) => patch(key, e.target.value)}
          {...(type === "date" ? { max: options?.today } : {})}
          {...(["quantity", "paintedArea"].includes(key)
            ? { inputMode: "decimal", pattern: "[0-9]+(\\.[0-9]{1,2})?" }
            : {})}
        />
      </label>
    );
  }
  return (
    <div className="wr-page">
      <header className="wr-header">
        <a href="/" aria-label="Areva Paints home" onClick={backToWebsite}>
          <BrandLogo />
        </a>
        <a href="/" className="wr-back" onClick={backToWebsite}>
          <ArrowLeft size={17} />
          Back to website
        </a>
      </header>
      <section
        className="page-gradient-banner wr-page-banner"
        aria-labelledby="wr-title"
      >
        <div className="wr-intro">
          <div className="page-gradient-heading">
            <p className="wr-kicker">AREVA PAINTS · AFTERCARE</p>
            <h1 id="wr-title" ref={headingRef} tabIndex={-1}>
              Product <span>Warranty Registration</span>
            </h1>
            <p>Keep your purchase details together, for care that lasts.</p>
          </div>
          <div className="wr-seal" aria-hidden="true">
            <ShieldCheck size={40} />
            <strong>AREVA</strong>
            <span>WARRANTY CARE</span>
          </div>
        </div>
      </section>
      <main className={"wr-main " + (step === "form" ? "wr-main-form" : "")}>
        {error && (
          <p className="wr-error" role="alert">
            {error}
          </p>
        )}
        {remote ? (
          <p>Opening the Areva registration portal…</p>
        ) : !options && !error ? (
          <p role="status">Loading registration…</p>
        ) : (
          <>
            {step === "phone" && (
              <div className="wr-entry">
                <form onSubmit={requestOtp} className="wr-mobile-form">
                  <label className="wr-sr-only" htmlFor="wr-phone">
                    Mobile number
                  </label>
                  <span className="wr-dial">+91</span>
                  <input
                    id="wr-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="Enter mobile number"
                    required
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                  />
                  <button
                    disabled={busy || !options || options.otpMode !== "demo"}
                  >
                    {busy ? "Please wait…" : "Submit"}
                    <ArrowRight size={17} />
                  </button>
                </form>
                <p className="wr-demo">
                  {options?.otpMode === "disabled"
                    ? "Mobile OTP delivery is not configured yet. Please try again later."
                    : "Demo registration: a test code will appear on this page. No SMS or WhatsApp message will be sent."}
                </p>
              </div>
            )}
            {step === "otp" && (
              <div className="wr-verification wr-card">
                <h2>Enter the demo code</h2>
                <p>
                  Continue with mobile number <strong>{phone}</strong>.
                </p>
                <p className="wr-demo">
                  Demo OTP: <strong>{demoCode}</strong>. This does not verify
                  ownership of the mobile number. Code expires in 5 minutes.
                </p>
                <form onSubmit={verify}>
                  <label className="wr-field">
                    Six-digit code
                    <input
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                    />
                  </label>
                  <button className="wr-primary" disabled={busy}>
                    Continue to registration
                    <ArrowRight size={17} />
                  </button>
                </form>
                <div className="wr-inline-actions">
                  <button
                    type="button"
                    disabled={busy || wait > 0}
                    onClick={() => void requestOtp()}
                  >
                    {wait ? `Resend in ${wait}s` : "Request another demo code"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void changeMobile()}
                  >
                    Change mobile number
                  </button>
                </div>
              </div>
            )}
            {step === "form" && (
              <>
                <div className="wr-session">
                  <span>
                    Registering for <strong>{phone}</strong> · Demo session
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void changeMobile()}
                  >
                    Change mobile number
                  </button>
                </div>
                <p className="wr-demo">
                  Demo access only: your mobile number is not verified.
                  Registration will be saved as pending review. Warranty
                  eligibility and start date must be confirmed by Areva.
                </p>
                <form onSubmit={submit} className="wr-registration">
                  <fieldset disabled={busy} className="wr-card">
                    <legend>1. Customer details</legend>
                    <div className="wr-grid">
                      {input("customerName", "Full name", true)}
                      {input("email", "Email address", false, "email", 160)}
                      {input(
                        "alternateMobile",
                        "Alternate mobile number",
                        false,
                        "tel",
                        25,
                      )}
                    </div>
                  </fieldset>
                  <fieldset disabled={busy} className="wr-card">
                    <legend>2. Product & purchase</legend>
                    <div className="wr-grid">
                      <label className="wr-field">
                        Product type *
                        <select
                          required
                          value={category}
                          onChange={(e) => {
                            setCategory(e.target.value);
                            patch("productId", "");
                            patch("packSize", "");
                          }}
                        >
                          <option value="">Select product type</option>
                          {CATEGORIES.map((c) => (
                            <option value={c.id} key={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="wr-field">
                        Product name *
                        <select
                          required
                          disabled={!category}
                          value={form.productId}
                          onChange={(e) => patch("productId", e.target.value)}
                        >
                          <option value="">Select product</option>
                          {options?.products
                            .filter((p) => p.categoryId === category)
                            .map((p) => (
                              <option value={p.id} key={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      {input("quantity", "Number of packs", true, "text", 20)}
                      <label className="wr-field">
                        Pack size / unit *
                        <input
                          required
                          maxLength={100}
                          list="wr-packs"
                          value={form.packSize}
                          onChange={(e) => patch("packSize", e.target.value)}
                        />
                        <datalist id="wr-packs">
                          {(product?.specs.packing?.length
                            ? product.specs.packing
                            : product?.availableSizes.map(
                                (size) =>
                                  `${size} ${product.coverageUnit || "L"}`,
                              )
                          )?.map((size) => (
                            <option value={size} key={size} />
                          ))}
                        </datalist>
                      </label>
                      {input(
                        "batchNumber",
                        "Batch / lot number",
                        false,
                        "text",
                        100,
                      )}
                      {input("shade", "Shade name / code")}
                    </div>
                    {product && (
                      <p className="wr-product-warranty">
                        <ShieldCheck size={20} />
                        {product.specs.warrantyYears > 0
                          ? `${product.specs.warrantyYears} year(s) · ${product.specs.warrantyLabel || "Performance warranty"}`
                          : "Warranty duration to be confirmed by Areva"}
                        <small>
                          Product information only; subject to eligibility and
                          review.
                        </small>
                      </p>
                    )}
                  </fieldset>
                  <fieldset disabled={busy} className="wr-card">
                    <legend>3. Dealer & receipt</legend>
                    <div className="wr-grid">
                      <label className="wr-field">
                        Choose a dealer
                        <select
                          value={form.dealerId}
                          onChange={(e) => chooseDealer(e.target.value)}
                        >
                          <option value="">Other dealer / enter details</option>
                          {options?.dealers.map((d) => (
                            <option value={d.id} key={d.id}>
                              {d.name} · {d.city}
                            </option>
                          ))}
                        </select>
                      </label>
                      {input(
                        "dealerName",
                        "Dealer / shop name",
                        true,
                        "text",
                        200,
                      )}
                      {input("dealerPhone", "Dealer phone", false, "tel", 25)}
                      {input(
                        "dealerAddress",
                        "Dealer address",
                        true,
                        "text",
                        500,
                      )}
                      {input("dealerCity", "Dealer city", true)}
                    </div>
                    <div className="wr-grid wr-invoice-details">
                      {input(
                        "invoiceNumber",
                        "Purchase invoice number",
                        true,
                        "text",
                        100,
                      )}
                      {input(
                        "purchaseDate",
                        "Date of purchase",
                        true,
                        "date",
                        10,
                      )}
                    </div>
                    <div className="wr-receipt">
                      <label className="wr-upload">
                        <Upload size={23} />
                        <strong>
                          {busy
                            ? "Please wait…"
                            : "Attach dealer purchase / payment receipt *"}
                        </strong>
                        <span>
                          PDF, JPEG, PNG or WebP · Maximum 5 MB · Kept private
                        </span>
                        <input
                          ref={uploadRef}
                          type="file"
                          aria-label="Upload purchase receipt"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          disabled={busy}
                          onChange={(e) => void upload(e.target.files?.[0])}
                        />
                      </label>
                      {receipt && (
                        <div className="wr-receipt-ready">
                          <CheckCircle2 size={18} />
                          <span>
                            {receipt.name} · {Math.ceil(receipt.bytes / 1024)}{" "}
                            KB
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            aria-label="Remove receipt"
                            onClick={() => {
                              setReceipt(null);
                              patch("receiptId", "");
                            }}
                          >
                            <X size={17} />
                          </button>
                        </div>
                      )}
                    </div>
                  </fieldset>
                  <fieldset disabled={busy} className="wr-card">
                    <legend>4. Site & application</legend>
                    <div className="wr-grid">
                      {input(
                        "siteAddress",
                        "Property / application address",
                        true,
                        "text",
                        500,
                      )}
                      {input("city", "Site city", true)}
                      {input("state", "Site state", true)}
                      <label className="wr-field">
                        Site PIN code *
                        <input
                          required
                          inputMode="numeric"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          value={form.pinCode}
                          onChange={(e) =>
                            patch("pinCode", e.target.value.replace(/\D/g, ""))
                          }
                        />
                      </label>
                      {input(
                        "applicationDate",
                        "Application completion date",
                        false,
                        "date",
                        10,
                      )}
                      {input(
                        "paintedArea",
                        "Painted area (sq ft)",
                        false,
                        "text",
                        20,
                      )}
                      {input("applicatorName", "Painter / applicator name")}
                      {input(
                        "applicatorPhone",
                        "Painter / applicator phone",
                        false,
                        "tel",
                        25,
                      )}
                    </div>
                    <label className="wr-field wr-notes">
                      Additional details
                      <textarea
                        maxLength={2000}
                        rows={3}
                        value={form.notes}
                        onChange={(e) => patch("notes", e.target.value)}
                      />
                    </label>
                  </fieldset>
                  <div className="wr-card wr-submit">
                    <label className="wr-consent">
                      <input
                        type="checkbox"
                        required
                        checked={form.consent}
                        disabled={busy}
                        onChange={(e) => patch("consent", e.target.checked)}
                      />
                      <span>
                        I confirm the information is accurate and consent to
                        Areva Paints contacting me about this registration.
                      </span>
                    </label>
                    <button className="wr-primary" disabled={busy || !receipt}>
                      {busy ? "Saving…" : "Submit registration"}
                      <ArrowRight size={18} />
                    </button>
                    <p>
                      Your registration is saved for review. Submission does not
                      automatically approve or activate a warranty.
                    </p>
                  </div>
                </form>
              </>
            )}
            {step === "success" && (
              <div className="wr-card wr-success" role="status">
                <CheckCircle2 size={48} />
                <h2>Registration received</h2>
                <p>
                  Keep your reference number for follow-up with Areva Paints.
                </p>
                <strong className="wr-reference">{reference}</strong>
                <p>Pending review · Demo mobile verification</p>
                <p>
                  Your details and receipt have been saved privately. Areva will
                  need to verify the purchase and warranty eligibility.
                </p>
                <div className="wr-inline-actions">
                  <a className="wr-primary" href="/" onClick={backToWebsite}>
                    Back to website
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <footer className="wr-footer">AREVA PAINTS · Paint your dreams.</footer>
    </div>
  );
}
