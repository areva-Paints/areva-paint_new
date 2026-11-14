export async function warrantyApi<T = any>(
  url: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
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
