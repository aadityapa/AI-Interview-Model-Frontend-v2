import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { ThemeProvider } from "./theme/ThemeProvider";

window.addEventListener("storage", (e: StorageEvent) => {
  if ((e.key === "authToken" || e.key === "authUser") && e.oldValue && !e.newValue) {
    window.setTimeout(() => window.location.reload(), 0);
  }
});

async function maybeAutoClearCache() {
  const key = "karnexAdminVersion";
  try {
    const res = await fetch("/version", { method: "GET", cache: "no-store" });
    const data = await res.json();
    const ver = String(data?.version || "").trim();
    if (!ver) return;
    const prev = String(window.localStorage.getItem(key) || "").trim();
    if (prev && prev !== ver) {
      // Refresh cached assets on a new backend version WITHOUT logging the user
      // out — auth keys are preserved so a redeploy never drops the session.
      const keep = new Set([key, "authUser", "authToken", "authTokenExpiryIst"]);
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i);
        if (!k) continue;
        if (keep.has(k)) continue;
        window.localStorage.removeItem(k);
      }
      if (window.caches && typeof window.caches.keys === "function") {
        try {
          const keys = await window.caches.keys();
          await Promise.all(keys.map((k) => window.caches.delete(k)));
        } catch (_) {
          /* ignore */
        }
      }
      window.localStorage.setItem(key, ver);
      window.location.reload();
      return;
    }
    if (!prev) window.localStorage.setItem(key, ver);
  } catch (_) {
    // ignore
  }
}

void maybeAutoClearCache();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
