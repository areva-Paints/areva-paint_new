import { AdminUpdated } from "./ActivityHistory";
import React, { useId, useRef, useState } from "react";
import {
  Plus,
  Upload,
  Search,
  Pencil,
  Trash2,
  FileText,
  Download,
  Check,
  X,
} from "lucide-react";
import type { ColorShade } from "../types";
import type { SiteContent } from "./content-types";
import { COLOUR_FAMILIES, parseColourRows } from "./colour-import";
const blank = (): ColorShade => ({
  name: "",
  code: "",
  hex: "#6C4CF5",
  family: "Warm Neutrals",
  goesWellWith: [],
});
export function ColourManager({
  content,
  onChange,
  onBusy,
}: {
  content: SiteContent;
  onChange: (c: SiteContent) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [query, setQuery] = useState(""),
    [editing, setEditing] = useState<ColorShade | null>(null),
    [original, setOriginal] = useState<string | null>(null),
    [text, setText] = useState(""),
    [candidates, setCandidates] = useState<ColorShade[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    prefix = useId(),
    latest = useRef(content);
  latest.current = content;
  function open(colour?: ColorShade) {
    setEditing(colour ? { ...colour } : blank());
    setOriginal(colour?.code ?? null);
    setError("");
    dialog.current?.showModal();
  }
  function close() {
    dialog.current?.close();
    setEditing(null);
    setError("");
  }
  function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const next = {
      ...editing,
      name: editing.name.trim(),
      code: editing.code.trim().toUpperCase(),
      hex: editing.hex.toUpperCase(),
    };
    if (!next.name || !next.code || !/^#[0-9A-F]{6}$/.test(next.hex)) {
      setError("Enter a colour name, code and six-digit HEX value.");
      return;
    }
    if (
      content.colours.some(
        (c) => c.code !== original && c.code.toUpperCase() === next.code,
      )
    ) {
      setError("That colour code already exists. Choose a different code.");
      return;
    }
    onChange({
      ...content,
      colours: original
        ? content.colours.map((c) => (c.code === original ? next : c))
        : [...content.colours, next],
    });
    close();
  }
  function preview(value = text) {
    try {
      const result = parseColourRows(value);
      setCandidates(result.colours);
      setNotice(
        `${result.colours.length} colour rows found${result.rejected ? `; ${result.rejected} lines could not be read` : ""}. Review before adding.`,
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function importColours() {
    const codes = new Set(content.colours.map((c) => c.code.toUpperCase())),
      unique: ColorShade[] = [];
    for (const c of candidates) {
      if (!codes.has(c.code.toUpperCase())) {
        unique.push({
          ...c,
          name: c.name.trim(),
          code: c.code.trim().toUpperCase(),
        });
        codes.add(c.code.toUpperCase());
      }
    }
    if (content.colours.length + unique.length > 5000) {
      setError("The palette can contain up to 5,000 colours.");
      return;
    }
    onChange({ ...content, colours: [...content.colours, ...unique] });
    setNotice(
      `${unique.length} colours added to the workspace. ${candidates.length - unique.length} duplicate codes skipped. Save changes to publish.`,
    );
    setCandidates([]);
    setText("");
  }
  async function uploadPdf(file?: File) {
    if (!file) return;
    if (
      file.size > 5 * 1024 * 1024 ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Choose a PDF up to 5 MB.");
      return;
    }
    if (content.shadeCards.length >= 50) {
      setError("Keep up to 50 PDF shade cards.");
      return;
    }
    setBusy(true);
    onBusy(true);
    setError("");
    setCandidates([]);
    setText("");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(new Blob([file], { type: "application/pdf" }));
      });
      const r = await fetch("/api/admin/pdf-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          originalName: file.name,
          section: "shadeCards",
        }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || "PDF upload failed.");
      onChange({
        ...latest.current,
        shadeCards: [
          ...latest.current.shadeCards,
          {
            id: crypto.randomUUID(),
            title:
              file.name.replace(/\.pdf$/i, "").slice(0, 150) || "Shade card",
            url: result.url,
          },
        ],
      });
      setNotice(
        "PDF uploaded to the workspace. Reading selectable text for the import preview…",
      );
      try {
        const { readPdfText } = await import("./pdf-import");
        const value = await readPdfText(file);
        setText(value.slice(0, 250000));
        preview(value.slice(0, 250000));
        if (value.length > 250000)
          setNotice(
            "PDF uploaded. Preview includes only the first 250,000 text characters; split larger shade cards to import the rest. Review the detected rows before adding.",
          );
        if (!parseColourRows(value.slice(0, 250000)).colours.length)
          setNotice(
            "PDF uploaded as a reference. No rows containing a name, code and HEX value were found. Enter those colours individually.",
          );
      } catch (e) {
        setNotice(
          "PDF uploaded as a reference. Text extraction was unavailable; enter colours individually or paste rows below.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  const filtered = content.colours.filter((c) =>
    `${c.name} ${c.code}`.toLowerCase().includes(query.toLowerCase().trim()),
  );
  return (
    <div className="adm-colour-manager">
      <div className="adm-panel">
        <div className="adm-panel-toolbar">
          <div>
            <h2>Colour library</h2>
            <small>
              {content.colours.length} colours · Searchable on your website
              after saving
            </small>
          </div>
          <button
            className="adm-primary"
            disabled={busy}
            onClick={() => open()}
          >
            <Plus size={17} />
            Add colour
          </button>
        </div>
        <div className="adm-colour-tools">
          <label className="adm-search">
            <Search size={17} />
            <input
              aria-label="Search colour by name or code"
              placeholder="Search colour by name or code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="adm-colour-grid">
          {filtered.map((c) => (
            <article className="adm-colour-card" key={c.code}>
              <div
                className="adm-colour-swatch"
                style={{ backgroundColor: c.hex }}
              />
              <div>
                <strong>{c.name}</strong>
                <AdminUpdated section="colours" id={c.code} />
                <small>
                  {c.code} · {c.hex}
                </small>
                <small>{c.family}</small>
                <div className="adm-row-actions">
                  <button
                    disabled={busy}
                    aria-label={"Edit " + c.code}
                    onClick={() => open(c)}
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                  <button
                    disabled={busy || content.colours.length === 1}
                    aria-label={"Remove " + c.code}
                    onClick={() => {
                      if (confirm(`Remove ${c.name} (${c.code})?`))
                        onChange({
                          ...content,
                          colours: content.colours.filter(
                            (x) => x.code !== c.code,
                          ),
                        });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <p className="adm-empty">No colours match this name or code.</p>
        )}
      </div>
      <section className="adm-panel">
        <div className="adm-panel-toolbar">
          <div>
            <h2>Upload a PDF shade card</h2>
            <small>
              Keep a soft copy and preview colour rows before importing.
            </small>
          </div>
          <label className="adm-upload">
            <Upload size={16} />
            {busy ? "Reading PDF…" : "Upload PDF"}
            <input
              aria-label="Upload PDF shade card"
              type="file"
              accept="application/pdf,.pdf"
              disabled={busy}
              onChange={(e) => {
                void uploadPdf(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="adm-colour-tools">
          <p className="adm-muted">
            PDF up to 5 MB. Text import supports up to 50 pages and requires a
            name, colour code and explicit HEX value per row. Scanned pages and
            printed swatches require manual entry; colours are never guessed
            from images.
          </p>
          {content.shadeCards.map((card) => (
            <div className="adm-pdf-row" key={card.id}>
              <FileText size={20} />
              <input
                aria-label={"PDF title " + card.title}
                maxLength={150}
                value={card.title}
                disabled={busy}
                onChange={(e) =>
                  onChange({
                    ...content,
                    shadeCards: content.shadeCards.map((x) =>
                      x.id === card.id ? { ...x, title: e.target.value } : x,
                    ),
                  })
                }
              />
              <AdminUpdated section="shadeCards" id={card.id} />
              <a href={card.url} download aria-label={"Download " + card.title}>
                <Download size={17} />
              </a>
              <button
                disabled={busy}
                aria-label={"Remove PDF " + card.title}
                onClick={() => {
                  if (confirm("Remove this PDF shade card from the website?"))
                    onChange({
                      ...content,
                      shadeCards: content.shadeCards.filter(
                        (x) => x.id !== card.id,
                      ),
                    });
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <label className="adm-field">
            <span>Colour rows from PDF or pasted text</span>
            <textarea
              aria-label="Colour import rows"
              rows={5}
              maxLength={250000}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setCandidates([]);
              }}
              placeholder={
                "Coastal Mist | AR901 | #B3CCD5\nWarm Ivory | AR902 | #F5E9D0"
              }
            />
            <small>
              One colour per line: Name | Code | #HEX. Commas, tabs or spaces
              are also supported.
            </small>
          </label>
          <button
            className="adm-secondary"
            disabled={busy || !text.trim()}
            onClick={() => preview()}
          >
            Preview colour rows
          </button>
          {candidates.length > 0 && (
            <>
              <div className="adm-import-preview">
                {candidates.map((c, i) => (
                  <div className="adm-pdf-row" key={i}>
                    <span
                      style={{
                        background: c.hex,
                        width: 24,
                        height: 24,
                        borderRadius: 5,
                        flexShrink: 0,
                      }}
                    />
                    <input
                      aria-label={`Import colour name ${i + 1}`}
                      value={c.name}
                      onChange={(e) =>
                        setCandidates(
                          candidates.map((x, n) =>
                            n === i ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <input
                      aria-label={`Import colour code ${i + 1}`}
                      value={c.code}
                      onChange={(e) =>
                        setCandidates(
                          candidates.map((x, n) =>
                            n === i
                              ? { ...x, code: e.target.value.toUpperCase() }
                              : x,
                          ),
                        )
                      }
                    />
                    <code>{c.hex}</code>
                    <button
                      aria-label={`Skip import row ${i + 1}`}
                      onClick={() =>
                        setCandidates(candidates.filter((_, n) => n !== i))
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="adm-primary"
                disabled={
                  busy ||
                  candidates.some(
                    (c) =>
                      !c.name.trim() ||
                      c.name.length > 150 ||
                      !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(c.code),
                  )
                }
                onClick={importColours}
              >
                <Check size={17} />
                Add reviewed colours
              </button>
            </>
          )}
        </div>
      </section>
      {notice && (
        <p className="adm-success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
      )}
      <dialog
        className="adm-dialog"
        ref={dialog}
        onCancel={() => {
          setEditing(null);
          setError("");
        }}
      >
        <form onSubmit={apply}>
          <div className="adm-dialog-heading">
            <h2>{original ? "Edit colour" : "Add colour"}</h2>
            <button
              type="button"
              className="adm-close"
              aria-label="Close colour editor"
              onClick={close}
            >
              <X />
            </button>
          </div>
          {editing && (
            <div className="adm-dialog-body">
              <label className="adm-field" htmlFor={prefix + "name"}>
                Colour name
                <input
                  id={prefix + "name"}
                  required
                  maxLength={150}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </label>
              <label className="adm-field" htmlFor={prefix + "code"}>
                Colour code
                <input
                  id={prefix + "code"}
                  required
                  maxLength={40}
                  pattern="[A-Za-z0-9][A-Za-z0-9 _-]*"
                  value={editing.code}
                  onChange={(e) =>
                    setEditing({ ...editing, code: e.target.value })
                  }
                />
              </label>
              <div className="adm-form-grid">
                <label className="adm-field" htmlFor={prefix + "hex"}>
                  HEX value
                  <input
                    id={prefix + "hex"}
                    required
                    pattern="#[a-fA-F0-9]{6}"
                    value={editing.hex}
                    onChange={(e) =>
                      setEditing({ ...editing, hex: e.target.value })
                    }
                  />
                </label>
                <label className="adm-field" htmlFor={prefix + "picker"}>
                  Colour picker
                  <input
                    id={prefix + "picker"}
                    type="color"
                    value={
                      /^#[a-f0-9]{6}$/i.test(editing.hex)
                        ? editing.hex
                        : "#000000"
                    }
                    onChange={(e) =>
                      setEditing({ ...editing, hex: e.target.value })
                    }
                  />
                </label>
              </div>
              <label className="adm-field" htmlFor={prefix + "family"}>
                Colour family
                <select
                  aria-label="Colour family"
                  id={prefix + "family"}
                  value={editing.family}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      family: e.target.value as ColorShade["family"],
                    })
                  }
                >
                  {COLOUR_FAMILIES.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              {error && (
                <p role="alert" className="adm-error">
                  {error}
                </p>
              )}
            </div>
          )}
          <div className="adm-dialog-footer">
            <button type="button" className="adm-secondary" onClick={close}>
              Cancel
            </button>
            <button className="adm-primary">Apply to workspace</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
