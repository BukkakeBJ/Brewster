/** Survive the brief API restart during local development without losing UI state. */
export async function getJson<T>(path: string): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      return (await response.json()) as T;
    } catch (error) {
      last = error;
      if (attempt < 4)
        await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
    }
  }
  throw last;
}
