const DEFAULT_TIMEOUT_MS = 8000;

/** GET a JSON document, failing on non-2xx responses or after `timeoutMs`. */
export async function fetchJson<T = unknown>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`Request to ${new URL(url).host} failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
}
