import React, { createContext, useContext, useEffect, useState } from "react";
import type { SiteContent } from "./content-types";
const Context = createContext<SiteContent | null>(null);
export const useSiteContent = () => useContext(Context);
export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<SiteContent | null>(null);
  useEffect(() => {
    const load = () =>
      fetch("/api/content")
        .then((r) => (r.ok ? r.json() : null))
        .then((c) => {
          if (c) setContent(c);
        })
        .catch(() => {});
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);
  return <Context.Provider value={content}>{children}</Context.Provider>;
}
