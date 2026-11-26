/*
 * Provide public CMS content to React consumers and refresh it after focus or saved-content notifications.
 * Private accounts and history never enter this context.
 */
import { contentUrl, resolveContentImages } from "../site-content";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SiteContent } from "./content-types";
const Context = createContext<SiteContent | null>(null);
const StatusContext = createContext({
  loading: true,
  error: "",
  reload: () => {},
});
/* Read the public CMS snapshot from the nearest content provider. */
export const useSiteContent = () => useContext(Context);
export const useContentStatus = () => useContext(StatusContext);
/* Load public content and keep consumers in sync with saved-content notifications. */
export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const reload = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true,
      generation = 0,
      hasSnapshot = false;
    let pending: AbortController | undefined;
    /* Refresh public content from the configured shared backend. */
    const load = () => {
      const request = ++generation;
      pending?.abort();
      pending = new AbortController();
      if (!hasSnapshot) setStatus({ loading: true, error: "" });
      return fetch(contentUrl("/api/content"), {
        cache: "no-store",
        signal: pending.signal,
      })
        .then((r) => {
          if (!r.ok)
            throw Error("Could not load the published colour catalogue.");
          return r.json();
        })
        .then((c) => {
          if (!c || !Array.isArray(c.colours) || !Array.isArray(c.shadeCards))
            throw Error("The published catalogue could not be read.");
          if (active && request === generation && c) {
            hasSnapshot = true;
            setContent(resolveContentImages(c));
            setStatus({ loading: false, error: "" });
          }
        })
        .catch((error) => {
          if (active && request === generation && error.name !== "AbortError")
            setStatus({
              loading: false,
              error:
                "The published catalogue could not refresh. Please try again.",
            });
        });
    };
    reload.current = () => {
      void load();
    };
    load();
    /* Reload content when another same-origin tab announces a saved CMS change. */
    const changed = (event: StorageEvent) => {
      if (event.key === "areva-content-updated") void load();
    };
    window.addEventListener("focus", load);
    window.addEventListener("storage", changed);
    return () => {
      active = false;
      pending?.abort();
      window.removeEventListener("focus", load);
      window.removeEventListener("storage", changed);
    };
  }, []);
  return (
    <Context.Provider value={content}>
      <StatusContext.Provider
        value={{ ...status, reload: () => reload.current() }}
      >
        {children}
      </StatusContext.Provider>
    </Context.Provider>
  );
}
