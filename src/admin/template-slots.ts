/* Keep CMS text out of prototype rewrite passes. Insert escaped HTML/JSON only
 * after the structural transformations, with per-render opaque placeholders.
 * Slots preserve prepared markup; callers must still escape HTML and script data.
 */
import crypto from "node:crypto";

export function templateSlots() {
  const prefix = "AREVA_SLOT_" + crypto.randomUUID().replaceAll("-", "") + "_";
  const values: string[] = [];
  const add = (value: string) => {
    const marker = `<!--${prefix}${values.length}-->`;
    values.push(value);
    return marker;
  };
  /* Preserve the section opening for shared banners/navigation while deferring its CMS body. */
  const section = (markup: string) => {
    const root = markup.match(/^(<section\b[^>]*>)([\s\S]*)(<\/section>)$/);
    if (!root) throw Error("Expected one rendered section for a template slot");
    return root[1] + add(root[2]) + root[3];
  };
  const restore = (html: string) => {
    for (let index = 0; index < values.length; index++)
      html = html.replaceAll(`<!--${prefix}${index}-->`, () => values[index]);
    return html;
  };
  return { add, section, restore };
}
