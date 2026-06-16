import { invalidateApiCache } from "../api/client";
import { clearAuthSession, getAuthToken } from "./authSession";

/**
 * Same behavior as the main portal logout: clear tokens, in-memory API cache,
 * Cache API, notify server, then open the HR login shell at /.
 */
export async function performAdminLogout(): Promise<void> {
  const bearer = getAuthToken();
  clearAuthSession();
  invalidateApiCache();
  if (typeof window !== "undefined" && window.caches?.keys) {
    try {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    } catch {
      /* ignore */
    }
  }
  if (bearer) {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}` },
        keepalive: true,
      });
    } catch {
      /* ignore */
    }
  }
  window.location.replace(`${window.location.origin}/`);
}
