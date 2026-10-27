/** Node fetch has no cookie jar. Model one browser per client for API tests. */
export function browserClient() {
  let cookie = "";
  return async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (cookie) headers.set("Cookie", cookie);
    const response = await globalThis.fetch(url, { ...init, headers });
    const stored = response.headers
      .get("set-cookie")
      ?.match(/(?:__Host-)?brewmaster_owner=[A-Za-z0-9_-]+/);
    if (stored) cookie = stored[0];
    return response;
  };
}
