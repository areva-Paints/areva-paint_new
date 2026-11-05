import { contentUrl, resolveContentImages } from "../site-content";
import React, { createContext, useContext, useEffect, useState } from "react";
import type { SiteContent } from "./content-types";
const Context = createContext<SiteContent | null>(null);
export const useSiteContent = () => useContext(Context);
export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<SiteContent | null>(null);
  useEffect(() => {
    const load = () =>
      fetch(contentUrl("/api/content"), { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((c) => {
          if (c) setContent(resolveContentImages(c));
        })
        .catch(() => {});
    load();
    const changed = (event: StorageEvent) => {
      if (event.key === "areva-content-updated") void load();
    };
    window.addEventListener("focus", load);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("focus", load);
      window.removeEventListener("storage", changed);
    };
  }, []);
  return <Context.Provider value={content}>{children}</Context.Provider>;
}
