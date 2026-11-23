/* Admin and customer downloads share one saved-snapshot report and one bounded
 * generation pool. Access is rechecked after asynchronous PDF generation.
 */
import type { Response, NextFunction } from "express";
import type { WarrantyRegistration } from "../warranty/types";
import { createWarrantyPdf } from "./warranty-pdf";

let activeReports = 0;
export async function sendWarrantyReport(
  row: WarrantyRegistration,
  res: Response,
  next: NextFunction,
  access: {
    authorized: () => boolean;
    expiredMessage: string;
    recordAccess?: () => void;
  },
): Promise<void> {
  if (activeReports >= 2) {
    res.setHeader("Retry-After", "5");
    res
      .status(503)
      .json({ error: "PDF generation is busy. Please try again shortly." });
    return;
  }
  activeReports++;
  try {
    const pdf = await createWarrantyPdf(row);
    if (!access.authorized()) {
      res.status(401).json({ error: access.expiredMessage });
      return;
    }
    if (res.destroyed) return;
    access.recordAccess?.();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Areva-Warranty-' + row.reference + '.pdf"',
    );
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    res.send(pdf);
  } catch (error) {
    next(error);
  } finally {
    activeReports--;
  }
}
