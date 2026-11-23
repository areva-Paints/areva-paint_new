/* Fetch an approved report through the private customer API. Blob URLs live only
 * for the preview/download; closing or leaving aborts any pending request.
 */
import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";
import { fetchWarrantyReport, WarrantyApiError } from "./api";

export type WarrantyReportAction = {
  reference: string;
  mode: "view" | "download";
};

export function WarrantyReport({
  action,
  onDone,
  onError,
  onSessionExpired,
}: {
  action: WarrantyReportAction;
  onDone: () => void;
  onError: (message: string) => void;
  onSessionExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const callbacks = useRef({ onDone, onError, onSessionExpired });
  callbacks.current = { onDone, onError, onSessionExpired };
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { reference, mode } = action;
  const filename = `Areva-Warranty-${reference}.pdf`;

  /* Native dialogs keep keyboard focus within the preview and restore it on close. */
  useEffect(() => {
    if (mode !== "view") return;
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [mode]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let previewUrl = "";
    setUrl("");
    setError("");
    void (async () => {
      try {
        const blob = await fetchWarrantyReport(reference, controller.signal);
        if (!active) return;
        const objectUrl = URL.createObjectURL(blob);
        if (mode === "view") {
          previewUrl = objectUrl;
          setUrl(objectUrl);
        } else {
          const anchor = document.createElement("a");
          anchor.href = objectUrl;
          anchor.download = filename;
          document.body.append(anchor);
          anchor.click();
          anchor.remove();
          // Give the browser time to consume the Blob after this component closes.
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
          callbacks.current.onDone();
        }
      } catch (failure) {
        if (!active || controller.signal.aborted) return;
        if (failure instanceof WarrantyApiError && failure.status === 401) {
          callbacks.current.onSessionExpired();
          return;
        }
        const message = (failure as Error).message;
        if (mode === "view") setError(message);
        else {
          callbacks.current.onError(message);
          callbacks.current.onDone();
        }
      }
    })();
    return () => {
      active = false;
      controller.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [reference, mode, attempt, filename]);

  if (mode === "download")
    return (
      <div className="wr-report-loading" role="status">
        Preparing your warranty PDF…
        <button type="button" className="wr-history-refresh" onClick={onDone}>
          Cancel
        </button>
      </div>
    );

  return (
    <dialog
      ref={dialog}
      className="wr-report-dialog"
      aria-labelledby="wr-report-title"
      onCancel={(event) => {
        event.preventDefault();
        onDone();
      }}
    >
      <div className="wr-report-header">
        <div>
          <h2 id="wr-report-title">Warranty PDF</h2>
          <p className="wr-reference">{reference}</p>
        </div>
        <button
          type="button"
          className="wr-history-refresh"
          onClick={onDone}
          autoFocus
        >
          <X size={18} /> Close PDF
        </button>
      </div>
      {error ? (
        <div className="wr-report-feedback">
          <p className="wr-error" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="wr-history-refresh"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCw size={16} /> Try again
          </button>
        </div>
      ) : url ? (
        <>
          <div className="wr-report-toolbar">
            <p>The saved approval details and review notes from Areva.</p>
            <a className="wr-primary" href={url} download={filename}>
              <Download size={17} /> Download PDF
            </a>
          </div>
          <iframe title="Approved warranty PDF" src={url} />
          <p className="wr-report-hint">
            If your browser cannot preview the PDF, use Download PDF.
          </p>
        </>
      ) : (
        <p className="wr-report-feedback" role="status">
          Loading your warranty PDF…
        </p>
      )}
    </dialog>
  );
}
