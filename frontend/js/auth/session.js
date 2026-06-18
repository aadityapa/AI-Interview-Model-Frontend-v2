/** HR/candidate API bearer token + profile (localStorage for same-origin /admin tab). */

export const AUTH_USER_KEY = "authUser";
export const AUTH_TOKEN_KEY = "authToken";
export const AUTH_EXPIRY_KEY = "authTokenExpiryIst";

const AUTH_KEYS = [AUTH_USER_KEY, AUTH_TOKEN_KEY, AUTH_EXPIRY_KEY];
export { AUTH_KEYS as AUTH_STORAGE_KEYS };

export function getAuthToken() {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch (_) {
    return "";
  }
}

export function getAuthUserRaw() {
  try {
    return window.localStorage.getItem(AUTH_USER_KEY) || "";
  } catch (_) {
    return "";
  }
}

/** Best-effort JWT exp check (no signature verification; server still validates). */
export function isAccessTokenExpired(leewaySec = 45) {
  const raw = getAuthToken();
  if (!raw) return true;
  const parts = raw.split(".");
  if (parts.length < 2) return false;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const json = JSON.parse(atob(b64 + pad));
    const exp = Number(json.exp);
    if (!Number.isFinite(exp)) return false;
    return Math.floor(Date.now() / 1000) >= exp - leewaySec;
  } catch (_) {
    return false;
  }
}

export function hasAuthSession() {
  return !!getAuthToken() && !isAccessTokenExpired();
}

export function saveAuthSession(user, token, expiresAtIst) {
  try {
    if (user) window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    if (expiresAtIst) window.localStorage.setItem(AUTH_EXPIRY_KEY, expiresAtIst);
  } catch (_) {
    /* ignore quota */
  }
}

export function clearAuthSession() {
  try {
    for (const k of AUTH_KEYS) {
      window.localStorage.removeItem(k);
      window.sessionStorage.removeItem(k);
    }
  } catch (_) {
    /* ignore */
  }
}
