import React from "react";
import { FileText } from "lucide-react";
import { useSiteContent } from "../admin/ContentContext";
export function ShadeCardDownloads() {
  const cards = useSiteContent()?.shadeCards || [];
  if (!cards.length) return null;
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      <h3 className="font-bold mb-3">Download colour shade cards</h3>
      <div className="flex gap-3 flex-wrap">
        {cards.map((c) => (
          <a
            key={c.id}
            href={c.url}
            download
            className="flex items-center gap-2 px-4 py-3 bg-white border border-purple-200 rounded-xl text-sm font-semibold text-purple-800"
          >
            <FileText size={18} />
            {c.title} (PDF)
          </a>
        ))}
      </div>
    </div>
  );
}
