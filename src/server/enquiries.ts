import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir, readContent } from "../admin/content-store";
import { writePrivateJson } from "./storage";

export interface StoredEnquiry {
  id: string;
  topic: string;
  fullName: string;
  phone: string;
  city: string;
  productName?: string;
  shadeName?: string;
  message?: string;
  createdAt: string;
  status: "pending" | "in_review" | "assigned_to_dealer";
  assignedDepot?: string;
}
const file = () => path.join(dataDir, "enquiries.json");
export function readEnquiries(): StoredEnquiry[] {
  if (!fs.existsSync(file())) return [];
  const rows = JSON.parse(fs.readFileSync(file(), "utf8"));
  if (!Array.isArray(rows)) throw Error("Invalid enquiries store");
  return rows;
}
export function createEnquiry(body: Record<string, unknown>) {
  const text = (key: string, max: number, required = false) => {
    const value = body[key] ?? "";
    if (
      typeof value !== "string" ||
      value.length > max ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) ||
      (required && !value.trim())
    )
      throw Error(`Enter a valid ${key} (up to ${max} characters).`);
    return value.trim();
  };
  const fullName = text("fullName", 150, true),
    phone = text("phone", 25, true);
  if (!/^\+?[0-9 ()-]{7,25}$/.test(phone))
    throw Error("Enter a valid contact phone number.");
  const city = text("city", 150),
    topic = text("topic", 150) || "Request a quotation";
  const productName = text("productName", 150),
    shadeName = text("shadeName", 200),
    message = text("message", 3000);
  const dealers = readContent().dealers;
  const matchedDepot =
    dealers.find((d) => d.city.toLowerCase() === city.toLowerCase()) ||
    dealers[0];
  const enquiry: StoredEnquiry = {
    id: `ARV-REQ-${crypto.randomUUID()}`,
    topic,
    fullName,
    phone,
    city,
    ...(productName ? { productName } : {}),
    ...(shadeName ? { shadeName } : {}),
    ...(message ? { message } : {}),
    createdAt: new Date().toISOString(),
    status: matchedDepot ? "assigned_to_dealer" : "pending",
    assignedDepot: matchedDepot
      ? `${matchedDepot.name} (${matchedDepot.city})`
      : "Pending dealer assignment",
  };
  const rows = readEnquiries();
  // Refuse additional writes instead of silently deleting real customer records.
  if (rows.length >= 10000)
    throw Error(
      "Enquiry capacity reached. Please contact the Areva team directly.",
    );
  writePrivateJson(file(), [enquiry, ...rows]);
  return { enquiry, matchedDepot };
}
