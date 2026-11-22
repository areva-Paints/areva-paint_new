/*
 * Send same-origin warranty requests with JSON and no-store responses, surfacing server validation messages to the public flow.
 */
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
    throw Error(
      data.error || "The request could not be completed. Please try again.",
    );
  return data;
}
