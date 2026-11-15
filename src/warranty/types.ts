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
export const DEMO_OTP = "123456";
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
  consent: boolean;
  submissionId: string;
}
export interface WarrantyRegistration extends Omit<
  WarrantyInput,
  "receiptId" | "submissionId"
> {
  id: string;
  reference: string;
  mobile: string;
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
  createdAt: string;
}
