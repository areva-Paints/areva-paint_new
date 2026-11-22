/*
 * Provide public CMS content to React consumers and refresh it after focus or saved-content notifications.
 * Private accounts and history never enter this context.
 */
import { contentUrl, resolveContentImages } from "../site-content";
import React, { createContext, useContext, useEffect, useState } from "react";
import type { SiteContent } from "./content-types";
const Context = createContext<SiteContent | null>(null);
/* Read the public CMS snapshot from the nearest content provider. */
export const useSiteContent = () => useContext(Context);
/* Load public content and keep consumers in sync with saved-content notifications. */
export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<SiteContent | null>(null);
  useEffect(() => {
    let active = true,
      generation = 0;
    let pending: AbortController | undefined;
    /* Refresh public content from the configured shared backend. */
    const load = () => {
      const request = ++generation;
      pending?.abort();
      pending = new AbortController();
      return fetch(contentUrl("/api/content"), {
        cache: "no-store",
        signal: pending.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((c) => {
          if (active && request === generation && c)
            setContent(resolveContentImages(c));
        })
        .catch(() => {});
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
  return <Context.Provider value={content}>{children}</Context.Provider>;
}
