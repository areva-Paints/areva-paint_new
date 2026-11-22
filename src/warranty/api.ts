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
