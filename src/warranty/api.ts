/*
 * Send same-origin warranty requests with JSON and no-store responses, surfacing server validation messages to the public flow.
 */
/* Preserve response status so an expired customer-history session returns to mobile entry. */
export class WarrantyApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "WarrantyApiError";
  }
}
/* Send same-origin warranty JSON with no-store caching and expose server errors. */
export async function warrantyApi<T = any>(
  url: string,
  body?: unknown,
  method: "POST" | "PATCH" | "DELETE" = "POST",
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new WarrantyApiError(
      data.error || "The request could not be completed. Please try again.",
      response.status,
    );
  return data;
}

/* Keep the full reference in the request body and the private PDF in memory.
 * The server checks the scoped session, login phone and saved approval again.
 */
export async function fetchWarrantyReport(
  reference: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch("/api/warranty/registrations/report.pdf", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference }),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new WarrantyApiError(
      data.error || "Your warranty PDF could not be loaded. Please try again.",
      response.status,
    );
  }
  if (!response.headers.get("Content-Type")?.startsWith("application/pdf"))
    throw Error("Your warranty PDF could not be loaded. Please try again.");
  return response.blob();
}
