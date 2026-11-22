/*
 * Define warranty submission, receipt, session and review contracts shared by the public form, admin screens and backend.
 * Final statuses are Approved and Rejected.
 */
export const WARRANTY_STATUSES = {
  pending_review: "Pending review",
  needs_information: "Needs information",
  approved: "Approved",
  rejected: "Rejected",
} as const;
export type WarrantyStatus = keyof typeof WARRANTY_STATUSES;
export interface WarrantyReview {
  id: string;
  status: WarrantyStatus;
  actor: string;
  at: string;
  notes: string;
  approvalConfirmed: boolean;
}
/* Recognize approved/rejected records whose review decision is read-only. */
export function isFinalWarrantyStatus(status: WarrantyStatus): boolean {
  return status === "approved" || status === "rejected";
}
export const DEMO_OTP = "123456";
export const WARRANTY_HISTORY_LIMIT = 100;
/* Complete references contain a random UUID; a short date, phone or ID is never a lookup proof. */
export function normalizeWarrantyReference(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reference = value.trim().toUpperCase();
  return /^ARV-WR-[0-9]{8}-[A-F0-9]{8}(?:-[A-F0-9]{4}){3}-[A-F0-9]{12}$/.test(
    reference,
  )
    ? reference
    : null;
}
/* Customer history intentionally excludes addresses, invoices, attachments and private review notes. */
export interface WarrantyHistoryItem {
  reference: string;
  productName: string;
  categoryName: string;
  purchaseDate: string;
  createdAt: string;
  status: WarrantyStatus;
}
export interface WarrantyHistoryResponse {
  registrations: WarrantyHistoryItem[];
  total: number;
}
export interface ReceiptInfo {
  id: string;
  name: string;
  mime: string;
  bytes: number;
}
export interface WarrantyInput {
  customerName: string;
  email: string;
  alternateMobile: string;
  productId: string;
  purchaseDate: string;
  quantity: string;
  packSize: string;
  batchNumber: string;
  shade: string;
  dealerId: string;
  dealerName: string;
  dealerPhone: string;
  dealerAddress: string;
  dealerCity: string;
  invoiceNumber: string;
  siteAddress: string;
  city: string;
  state: string;
  pinCode: string;
  applicationDate: string;
  paintedArea: string;
  applicatorName: string;
  applicatorPhone: string;
  notes: string;
  receiptId: string;
  sitePhotoIds?: string[];
  consent: boolean;
  submissionId: string;
}
export interface WarrantyRegistration extends Omit<
  WarrantyInput,
  "receiptId" | "submissionId" | "sitePhotoIds"
> {
  id: string;
  reference: string;
  mobile: string;
  loginMobile: string;
  categoryId: string;
  categoryName: string;
  productName: string;
  warrantyYears: number;
  warrantyLabel: string;
  verificationMode: "demo";
  mobileVerified: false;
  status: WarrantyStatus;
  version: number;
  reviewNotes: string;
  reviewedBy: string;
  reviewedAt: string | null;
  approvalConfirmed: boolean;
  reviewHistory: WarrantyReview[];
  receipt: ReceiptInfo;
  sitePhotos?: ReceiptInfo[];
  createdAt: string;
}
