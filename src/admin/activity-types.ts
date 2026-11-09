export const ACTIVITY_SECTIONS = {
  landingImages: "Landing images",
  products: "Products",
  dealers: "Authorised dealers",
  colours: "Colours",
  shadeCards: "PDF shade cards",
  galleryProjects: "Gallery projects",
  galleryPhotos: "Project photos",
  galleryAds: "Gallery ads",
  uploads: "Uploads",
  website: "Website",
  account: "Admin account",
} as const;
export type ActivitySection = keyof typeof ACTIVITY_SECTIONS;
export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "reordered"
  | "uploaded"
  | "published"
  | "signed_in"
  | "signed_out";
export interface ActivityEvent {
  id: string;
  at: string;
  actor: string;
  action: ActivityAction;
  section: ActivitySection;
  entityId: string;
  label: string;
  fields: string[];
  revision?: number;
  fileUrl?: string;
  bytes?: number;
}
export interface ActivityStore {
  startedAt: string | null;
  events: ActivityEvent[];
}
export interface ActivitySummary {
  startedAt: string | null;
  totalEvents: number;
  latest: Record<string, string>;
  lastPublishedAt: string | null;
  lastSection: Partial<Record<ActivitySection, string>>;
}
export interface ActivityPage extends ActivitySummary {
  events: ActivityEvent[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
