const AUTH_KEYS = ["authUser", "authToken", "authTokenExpiryIst"] as const;

export function getAuthToken(): string {
  try {
    return window.localStorage.getItem("authToken") || "";
  } catch {
    return "";
  }
}

export function clearAuthSession(): void {
  try {
    for (const k of AUTH_KEYS) {
      window.localStorage.removeItem(k);
      window.sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

export function isAccessTokenExpired(leewaySec = 45): boolean {
  const raw = getAuthToken();
  if (!raw) return true;
  const parts = raw.split(".");
  if (parts.length < 2) return false;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const json = JSON.parse(atob(b64 + pad)) as { exp?: number };
    const exp = Number(json.exp);
    if (!Number.isFinite(exp)) return false;
    return Math.floor(Date.now() / 1000) >= exp - leewaySec;
  } catch {
    return false;
  }
}
