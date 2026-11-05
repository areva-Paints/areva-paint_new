import { ImagePreview, checkImage } from "./ImagePreview";
import { ColourManager } from "./ColourManager";
import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
  Droplets,
  ExternalLink,
  Upload,
  Save,
  Pencil,
} from "lucide-react";
import { CATEGORIES } from "../data/paintsData";
import type { Product } from "../types";
import type { Dealer, LandingImage, SiteContent } from "./content-types";
import "./admin.css";

type Tab = "landingImages" | "products" | "dealers" | "coverage" | "colours";
const sections = [
  {
    id: "colours" as Tab,
    label: "Colours & shade cards",
    icon: Droplets,
    description:
      "Manage searchable colour names and codes, or upload a PDF shade card.",
  },
  {
    id: "landingImages" as Tab,
    label: "Landing images",
    icon: ImagePlus,
    description:
      "Set the first impression. Add and arrange your homepage images.",
  },
  {
    id: "products" as Tab,
    label: "Products",
    icon: Package,
    description:
      "Keep your product photography, descriptions and specifications up to date.",
  },
  {
    id: "dealers" as Tab,
    label: "Authorised dealers",
    icon: MapPin,
    description: "Help customers find a trusted stockist close to home.",
  },
  {
    id: "coverage" as Tab,
    label: "Paint coverage",
    icon: Droplets,
    description: "Manage the coverage values used in your paint calculator.",
  },
];
async function request(url: string, options: RequestInit = {}) {
  const r = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Request failed. Please try again.");
  return d;
}
const uid = () => crypto.randomUUID();
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = React.useId();
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, {
            id,
            "aria-describedby": hint ? id + "-hint" : undefined,
          })
        : children}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false),
    [checking, setChecking] = useState(true),
    [password, setPassword] = useState("");
  const [username, setUsername] = useState("admin");
  const [content, setContent] = useState<SiteContent | null>(null),
    [tab, setTab] = useState<Tab>("landingImages"),
    [search, setSearch] = useState(""),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [editor, setEditor] = useState<Product | Dealer | LandingImage | null>(
      null,
    ),
    [isNew, setIsNew] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const section = sections.find((s) => s.id === tab)!;
  async function load() {
    const c = await request("/api/admin/content");
    setContent(c);
    setAuthenticated(true);
  }
  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => {
    if (editor) {
      dialogRef.current?.showModal();
      dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    } else dialogRef.current?.close();
  }, [!!editor]);
  function update(c: SiteContent) {
    setContent(c);
    setDirty(true);
    setNotice("");
    setError("");
  }
  function patch(key: string, value: unknown) {
    setEditor((e) => ({ ...e, [key]: value }) as typeof e);
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setPassword("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function persist(next: SiteContent): Promise<boolean> {
    if (busy || uploading) return false;
    setBusy(true);
    setError("");
    try {
      const c = await request("/api/admin/content", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setContent(c);
      setDirty(false);
      setNotice("Changes saved. Your website is up to date.");
      try {
        localStorage.setItem("areva-content-updated", String(c.revision));
      } catch {}
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (content) await persist(content);
  }
  function add() {
    setIsNew(true);
    setError("");
    if (tab === "landingImages")
      setEditor({
        id: uid(),
        label: "",
        image: "",
        roomType: "",
        recommendedProduct: "",
      });
    else if (tab === "dealers")
      setEditor({
        id: uid(),
        name: "",
        pin: "",
        city: "",
        state: "",
        address: "",
        phone: "",
        badges: [],
      });
    else
      setEditor({
        id: uid(),
        name: "",
        description: "",
        tagline: "",
        image: "",
        categoryId: CATEGORIES[0].id,
        categoryName: CATEGORIES[0].name,
        coverageSqFtPerLiter: 120,
        coverageUnit: "L",
        calculationBasis: "wall",
        recommendedCoats: 2,
        availableSizes: [1, 4, 10, 20],
        sheen: "Soft Sheen",
        vocLevel: "Standard",
        washability: "Wipeable",
        tintable: true,
        featured: false,
        specs: {
          dryingTime: "",
          recoatTime: "",
          thinnedWith: "",
          warrantyYears: 0,
          recommendedSurfaces: [],
          surfacePreparation: "",
          applicationMethod: "",
        },
      });
  }
  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!content || !editor || uploading || busy || tab === "colours") return;
    const publish =
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "publish";
    if ("image" in editor) {
      setUploading(true);
      setError("");
      try {
        await checkImage(editor.image.trim());
      } catch (e) {
        setError((e as Error).message);
        return;
      } finally {
        setUploading(false);
      }
    }
    const key = tab === "coverage" ? "products" : tab;
    const items = content[key] as (Product | Dealer | LandingImage)[];
    const entry =
      "image" in editor ? { ...editor, image: editor.image.trim() } : editor;
    const next = {
      ...content,
      [key]: isNew
        ? [...items, entry]
        : items.map((i) => (i.id === entry.id ? entry : i)),
    };
    if (publish) {
      if (await persist(next)) setEditor(null);
    } else {
      update(next);
      setEditor(null);
    }
  }
  function remove(id: string) {
    if (!content || tab === "colours") return;
    const key = tab === "coverage" ? "products" : tab;
    if (key === "products" && content.products.length === 1) {
      setError("Keep at least one product for the paint calculator.");
      return;
    }
    if (
      !window.confirm(
        "Remove this entry? It will be removed from the website when you save changes.",
      )
    )
      return;
    update({ ...content, [key]: content[key].filter((i) => i.id !== id) });
  }
  async function upload(file?: File) {
    if (!file) return;
    if (
      file.size > 25 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Choose a JPEG, PNG or WebP image up to 25 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const result = await request("/api/admin/upload", {
        method: "POST",
        body: JSON.stringify({ data }),
      });
      patch("image", result.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  const input = (
    key: string,
    label: string,
    type = "text",
    required = true,
    hint?: string,
  ) => (
    <Field label={label} hint={hint}>
      <input
        type={type}
        required={required}
        maxLength={type === "number" ? undefined : 500}
        min={type === "number" ? 1 : undefined}
        max={type === "number" ? 10000 : undefined}
        step={type === "number" ? "any" : undefined}
        value={(editor as any)?.[key] ?? ""}
        onChange={(e) =>
          patch(
            key,
            type === "number" ? Number(e.target.value) : e.target.value,
          )
        }
      />
    </Field>
  );
  const imageEditor = editor && "image" in editor && (
    <div className="adm-image-editor">
      {editor.image ? (
        <ImagePreview src={editor.image} alt="Image preview" />
      ) : (
        <div className="adm-image-placeholder">
          <ImagePlus size={30} />
          <span>Add a clear, high quality image</span>
        </div>
      )}
      <label className="adm-upload">
        <Upload size={16} />
        {uploading ? "Uploading…" : "Upload image"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      <small>JPEG, PNG or WebP · Up to 25 MB</small>
      {input(
        "image",
        "Or use an image URL",
        "text",
        true,
        "Use an HTTPS URL or a path starting with /.",
      )}
    </div>
  );
  if (checking)
    return (
      <div className="adm-login">
        <p>Loading administration…</p>
      </div>
    );
  if (!authenticated)
    return (
      <div className="adm-login">
        <form onSubmit={login}>
          <a href="/" className="adm-back">
            <ArrowLeft size={16} />
            Back to website
          </a>
          <div className="adm-logo">
            a<span>.</span>
          </div>
          <span className="adm-eyebrow">AREVA PAINTS / ADMINISTRATION</span>
          <h1>
            A fresh start
            <br />
            for every space.
          </h1>
          <p>Sign in to manage your website, products and dealer network.</p>
          <Field label="Username">
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label="Admin password">
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && (
            <p className="adm-error" role="alert">
              {error}
            </p>
          )}
          <button className="adm-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in securely"}
            <ShieldCheck size={17} />
          </button>
          <small className="adm-login-note">
            Use the credentials configured by your website administrator.
          </small>
        </form>
        <div className="adm-login-art">
          <div />
          <span>
            GOOD COLOUR.
            <br />
            GREAT POSSIBILITIES.
          </span>
        </div>
      </div>
    );
  const items = content
    ? tab === "colours"
      ? []
      : tab === "coverage"
        ? content.products
        : content[tab]
    : [];
  const filtered = items.filter((i) =>
    JSON.stringify(i).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="adm-root">
      <aside className="adm-sidebar">
        <a className="adm-brand" href="/">
          areva<span>PAINTS</span>
        </a>
        <div className="adm-workspace">
          <span className="adm-status-dot" />
          Website workspace<small>Content administration</small>
        </div>
        <span className="adm-nav-title">MANAGE WEBSITE</span>
        <nav>
          {sections.map((s) => (
            <button
              key={s.id}
              disabled={uploading || busy}
              className={tab === s.id ? "active" : ""}
              onClick={() => {
                setTab(s.id);
                setSearch("");
                setError("");
              }}
            >
              <s.icon size={19} />
              {s.label}
              <span>
                {content
                  ? s.id === "coverage"
                    ? content.products.length
                    : content[s.id].length
                  : 0}
              </span>
            </button>
          ))}
        </nav>
        <div className="adm-sidebar-bottom">
          <a href="/" target="_blank" rel="noreferrer">
            <ExternalLink size={17} />
            View website
          </a>
          <button
            onClick={async () => {
              if (dirty && !confirm("Discard unsaved changes and sign out?"))
                return;
              try {
                await request("/api/admin/logout", { method: "POST" });
                setAuthenticated(false);
                setDirty(false);
                setContent(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
          <small>
            <ShieldCheck size={14} />
            Private admin workspace
          </small>
        </div>
      </aside>
      <div className="adm-main">
        <header className="adm-topbar">
          <span>
            <LayoutDashboard size={16} />
            Website administration<span className="adm-slash">/</span>
            <b>{section.label}</b>
          </span>
          <a href="/" target="_blank" rel="noreferrer">
            View live website <ExternalLink size={14} />
          </a>
        </header>
        <main className="adm-content" inert={busy}>
          <div className="adm-page-heading">
            <div>
              <span className="adm-eyebrow">YOUR WEBSITE, YOUR WAY</span>
              <h1>{section.label}</h1>
              <p>{section.description}</p>
            </div>
            {tab !== "colours" && (
              <button className="adm-primary" onClick={add}>
                <Plus size={17} />
                Add{" "}
                {tab === "landingImages"
                  ? "image"
                  : tab === "dealers"
                    ? "dealer"
                    : "product"}
              </button>
            )}
          </div>
          <div className="adm-overview">
            {[
              {
                label: "Homepage images",
                value: content?.landingImages.length || "Default",
                icon: ImagePlus,
              },
              {
                label: "Products in catalog",
                value: content?.products.length || 0,
                icon: Package,
              },
              {
                label: "Authorised dealers",
                value: content?.dealers.length || 0,
                icon: MapPin,
              },
            ].map((x, i) => (
              <div key={x.label}>
                <span className={"adm-stat-icon adm-tone-" + i}>
                  <x.icon size={21} />
                </span>
                <div>
                  <strong>{x.value}</strong>
                  <small>{x.label}</small>
                </div>
              </div>
            ))}
          </div>
          {notice && (
            <div className="adm-success" role="status">
              <Check size={18} />
              <span>{notice}</span>
              <a href="/" target="_blank" rel="noreferrer">
                Open updated homepage <ExternalLink size={14} />
              </a>
            </div>
          )}
          {error && !editor && (
            <div className="adm-error" role="alert">
              {error}
            </div>
          )}
          {tab === "colours" && content ? (
            <ColourManager
              content={content}
              onChange={update}
              onBusy={setUploading}
            />
          ) : (
            <section className="adm-panel">
              <div className="adm-panel-toolbar">
                <div>
                  <h2>
                    {tab === "coverage"
                      ? "Coverage specifications"
                      : tab === "landingImages"
                        ? "Homepage gallery"
                        : tab === "products"
                          ? "Product catalog"
                          : "Dealer directory"}
                  </h2>
                  <small>
                    {items.length} {items.length === 1 ? "entry" : "entries"} ·{" "}
                    {tab === "coverage"
                      ? "Coverage per litre or kilogram, per coat"
                      : "Manage what customers see on your website"}
                  </small>
                </div>
                <label className="adm-search">
                  <Search size={17} />
                  <input
                    aria-label="Search entries"
                    placeholder="Search entries…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              {tab === "landingImages" ? (
                <div className="adm-gallery">
                  {filtered.map((item, i) => {
                    const l = item as LandingImage;
                    return (
                      <article key={l.id}>
                        <div className="adm-gallery-image">
                          <ImagePreview
                            src={l.image}
                            alt={l.label || "Landing image"}
                          />
                          <span>{String(i + 1).padStart(2, "0")}</span>
                        </div>
                        <div className="adm-gallery-copy">
                          <h3>{l.label || "Landing image"}</h3>
                          <p>{l.roomType || "Homepage image"}</p>
                          <div className="adm-row-actions">
                            <button
                              onClick={() => {
                                setEditor(l);
                                setIsNew(false);
                              }}
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                            <button
                              disabled={content?.landingImages[0]?.id === l.id}
                              onClick={() => {
                                if (!content) return;
                                const list = [...content.landingImages],
                                  index = list.findIndex((x) => x.id === l.id);
                                [list[index - 1], list[index]] = [
                                  list[index],
                                  list[index - 1],
                                ];
                                update({ ...content, landingImages: list });
                              }}
                            >
                              Move earlier
                            </button>
                            <button
                              aria-label={"Remove " + l.label}
                              onClick={() => remove(l.id)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  <button className="adm-add-tile" onClick={add}>
                    <span>
                      <Plus size={25} />
                    </span>
                    <b>Add landing image</b>
                    <small>Give your homepage a new look</small>
                  </button>
                </div>
              ) : (
                <div className="adm-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {(tab === "dealers"
                          ? ["Dealer", "Location", "Contact", ""]
                          : tab === "coverage"
                            ? [
                                "Product",
                                "Category",
                                "Coverage / coat",
                                "Coats",
                                "",
                              ]
                            : ["Product", "Category", "Coverage / coat", ""]
                        ).map((h, i) => (
                          <th key={i}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item) => {
                        const p = item as Product,
                          d = item as Dealer;
                        return (
                          <tr key={item.id}>
                            <td>
                              <div className="adm-item-name">
                                {tab !== "dealers" && (
                                  <img src={p.image} alt="" />
                                )}
                                <div>
                                  <strong>
                                    {"name" in item ? item.name : ""}
                                  </strong>
                                  <small>
                                    {tab === "dealers"
                                      ? d.address
                                      : tab === "coverage"
                                        ? p.sheen
                                        : p.tagline}
                                  </small>
                                </div>
                              </div>
                            </td>
                            {tab === "dealers" ? (
                              <>
                                <td>
                                  {d.city}, {d.state}
                                  <small>PIN {d.pin}</small>
                                </td>
                                <td>{d.phone}</td>
                              </>
                            ) : (
                              <>
                                <td>
                                  <span className="adm-category">
                                    {p.categoryName}
                                  </span>
                                </td>
                                <td>
                                  <b>{p.coverageSqFtPerLiter || "Not set"}</b>{" "}
                                  <span className="adm-muted">
                                    {p.coverageSqFtPerLiter > 0
                                      ? `sq ft/${p.coverageUnit || "L"}`
                                      : ""}
                                  </span>
                                </td>
                                {tab === "coverage" && (
                                  <td>{p.recommendedCoats}</td>
                                )}
                              </>
                            )}
                            <td>
                              <div className="adm-row-actions">
                                <button
                                  onClick={() => {
                                    setEditor(item);
                                    setIsNew(false);
                                    setError("");
                                  }}
                                  aria-label={
                                    "Edit " +
                                    ("name" in item ? item.name : "entry")
                                  }
                                >
                                  <Pencil size={15} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => remove(item.id)}
                                  aria-label={
                                    "Remove " +
                                    ("name" in item ? item.name : "entry")
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!filtered.length && (
                    <div className="adm-empty">
                      <Search size={26} />
                      <h3>
                        {search ? "No matching entries" : "Nothing here yet"}
                      </h3>
                      <p>
                        {search
                          ? "Try another name or keyword."
                          : "Add your first entry to get started."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
          <div className="adm-tip">
            <ShieldCheck size={18} />
            <p>
              {tab === "landingImages"
                ? "Images appear in this order in the homepage carousel. With no custom images, the original homepage slides remain."
                : tab === "coverage"
                  ? "One source of truth: these values update the product list and paint calculator together. Estimates include the selected coats and a 10% safety buffer."
                  : "Changes stay in this workspace until you select Save changes."}
            </p>
          </div>
        </main>
        <footer className="adm-savebar">
          <div>
            <span className={dirty ? "adm-unsaved-dot" : "adm-status-dot"} />
            <span>
              {dirty ? "You have unsaved changes" : "All changes saved"}
            </span>
          </div>
          <button
            className="adm-primary"
            disabled={!dirty || busy || uploading}
            onClick={save}
          >
            <Save size={16} />
            {busy ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </div>
      <dialog
        className="adm-dialog"
        ref={dialogRef}
        onCancel={(e) => {
          if (uploading) e.preventDefault();
          else setEditor(null);
        }}
      >
        <form onSubmit={apply}>
          <div className="adm-dialog-heading">
            <div>
              <span className="adm-eyebrow">
                {isNew ? "NEW ENTRY" : "EDIT ENTRY"}
              </span>
              <h2>
                {tab === "landingImages"
                  ? "Landing image"
                  : tab === "dealers"
                    ? "Authorised dealer"
                    : tab === "coverage"
                      ? "Paint coverage"
                      : "Product details"}
              </h2>
            </div>
            <button
              type="button"
              className="adm-close"
              aria-label="Close editor"
              disabled={uploading}
              onClick={() => setEditor(null)}
            >
              <X />
            </button>
          </div>
          <div className="adm-dialog-body" inert={uploading || busy}>
            {editor && (
              <>
                {tab === "landingImages" ? (
                  <>
                    {imageEditor}
                    {input(
                      "label",
                      "Image caption / alt text (optional)",
                      "text",
                      false,
                    )}
                    {input("roomType", "Subtitle (optional)", "text", false)}
                    {input(
                      "recommendedProduct",
                      "Recommended product (optional)",
                      "text",
                      false,
                    )}
                  </>
                ) : tab === "dealers" ? (
                  <>
                    {input("name", "Dealer / business name")}
                    <div className="adm-form-grid">
                      {input("city", "City")}
                      {input("state", "State")}
                      {input(
                        "pin",
                        "PIN code",
                        "text",
                        true,
                        "Six-digit Indian PIN code",
                      )}
                      {input("phone", "Phone number", "tel")}
                    </div>
                    <Field label="Full address">
                      <textarea
                        required
                        maxLength={500}
                        value={(editor as Dealer).address}
                        onChange={(e) => patch("address", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Services / badges"
                      hint="Separate services with commas."
                    >
                      <input
                        value={(editor as Dealer).badges.join(", ")}
                        onChange={(e) =>
                          patch(
                            "badges",
                            e.target.value.split(",").map((x) => x.trim()),
                          )
                        }
                      />
                    </Field>
                  </>
                ) : (
                  <>
                    {tab !== "coverage" && imageEditor}
                    {input("name", "Product name")}
                    <div className="adm-form-grid">
                      <Field label="Category">
                        <select
                          value={(editor as Product).categoryId}
                          onChange={(e) => {
                            const c = CATEGORIES.find(
                              (c) => c.id === e.target.value,
                            )!;
                            setEditor({
                              ...editor,
                              categoryId: c.id,
                              categoryName: c.name,
                            } as Product);
                          }}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Finish / sheen">
                        <select
                          value={(editor as Product).sheen}
                          onChange={(e) => patch("sheen", e.target.value)}
                        >
                          {[
                            "Ultra Matte",
                            "Soft Sheen",
                            "Satin Silk",
                            "High Gloss",
                            "Textured",
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                      {input(
                        "coverageSqFtPerLiter",
                        "Coverage (sq ft per unit)",
                        "number",
                        true,
                        "Per coat. Example: 120 sq ft/L.",
                      )}
                      <Field label="Material unit">
                        <select
                          value={(editor as Product).coverageUnit || "L"}
                          onChange={(e) =>
                            patch("coverageUnit", e.target.value)
                          }
                        >
                          <option value="L">Litre (L)</option>
                          <option value="kg">Kilogram (kg)</option>
                        </select>
                      </Field>
                      <Field label="Area calculation">
                        <select
                          value={(editor as Product).calculationBasis || "wall"}
                          onChange={(e) =>
                            patch("calculationBasis", e.target.value)
                          }
                        >
                          <option value="wall">
                            Walls (length, width and height)
                          </option>
                          <option value="floor">Floor (length × width)</option>
                        </select>
                      </Field>
                      <Field label="Recommended coats">
                        <input
                          type="number"
                          required
                          min="1"
                          max="10"
                          step="1"
                          value={(editor as Product).recommendedCoats}
                          onChange={(e) =>
                            patch("recommendedCoats", Number(e.target.value))
                          }
                        />
                      </Field>
                    </div>
                    {tab !== "coverage" && (
                      <>
                        {input(
                          "tagline",
                          "Short product tagline",
                          "text",
                          false,
                        )}
                        <Field label="Product description">
                          <textarea
                            required
                            rows={4}
                            maxLength={3000}
                            value={(editor as Product).description}
                            onChange={(e) =>
                              patch("description", e.target.value)
                            }
                          />
                        </Field>
                        <label className="adm-checkbox">
                          <input
                            type="checkbox"
                            checked={!!(editor as Product).featured}
                            onChange={(e) =>
                              patch("featured", e.target.checked)
                            }
                          />
                          Feature this product in the catalog
                        </label>
                      </>
                    )}
                    <div className="adm-coverage-preview">
                      <Droplets size={21} />
                      <div>
                        <strong>
                          {(editor as Product).name || "Your product"} —{" "}
                          {(editor as Product).coverageSqFtPerLiter || 0} sq ft/
                          {(editor as Product).coverageUnit || "L"}
                        </strong>
                        <p>
                          A 1,000 sq ft area with{" "}
                          {(editor as Product).calculationBasis === "floor"
                            ? 1
                            : (editor as Product).recommendedCoats}{" "}
                          coats needs approximately{" "}
                          {(editor as Product).coverageSqFtPerLiter > 0
                            ? Math.ceil(
                                ((1000 *
                                  ((editor as Product).calculationBasis ===
                                  "floor"
                                    ? 1
                                    : (editor as Product).recommendedCoats)) /
                                  (editor as Product).coverageSqFtPerLiter) *
                                  1.1 *
                                  2,
                              ) / 2
                            : 0}{" "}
                          {(editor as Product).coverageUnit || "L"}, including
                          10% extra.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
            {error && (
              <p className="adm-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="adm-dialog-footer">
            <button
              type="button"
              className="adm-secondary"
              disabled={uploading}
              onClick={() => setEditor(null)}
            >
              Cancel
            </button>
            {tab === "landingImages" ? (
              <>
                <button
                  className="adm-secondary"
                  type="submit"
                  name="action"
                  value="workspace"
                  disabled={uploading || busy}
                >
                  Apply to workspace
                </button>
                <button
                  className="adm-primary"
                  type="submit"
                  name="action"
                  value="publish"
                  disabled={uploading || busy}
                >
                  <Save size={17} />
                  {uploading
                    ? "Checking image…"
                    : busy
                      ? "Saving…"
                      : "Save to website"}
                </button>
              </>
            ) : (
              <button className="adm-primary" disabled={uploading || busy}>
                <Check size={17} />
                {uploading ? "Checking image…" : "Apply to workspace"}
              </button>
            )}
          </div>
        </form>
      </dialog>
    </div>
  );
}
