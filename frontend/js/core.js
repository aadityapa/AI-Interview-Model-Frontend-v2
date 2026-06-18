import { clearAuthSession, getAuthToken } from "./auth/session.js";
import { resolveInviteDeviceId } from "./invite_device.js";

const API = "";

export async function handleJson(res) {
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function handleJsonOrText(res) {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Request failed with status ${res.status}`);
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.error) {
      throw new Error(parsed.error);
    }
    return parsed;
  } catch (_) {
    return text;
  }
}

export async function apiFetch(path, init, options = {}) {
  const token = getAuthToken();
  const headers = new Headers((init && init.headers) || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("x-device-id")) {
    const deviceId = resolveInviteDeviceId();
    if (deviceId) headers.set("x-device-id", deviceId);
  }
  const timeoutMs = Number(options.timeoutMs) || 0;
  let signal = init && init.signal;
  let timer = null;
  if (timeoutMs > 0) {
    const controller = new AbortController();
    if (signal) {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    timer = setTimeout(() => controller.abort(), timeoutMs);
    signal = controller.signal;
  }
  let res;
  try {
    res = await fetch(`${API}${path}`, { ...(init || {}), headers, signal });
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (res.status === 401 && token) {
    clearAuthSession();
    try {
      window.dispatchEvent(new CustomEvent("kx-auth-lost"));
    } catch (_) {
      /* ignore */
    }
  }
  return res;
}

export async function assertBackendOnline() {
  try {
    await apiFetch("/session-status", { method: "GET" });
  } catch (_) {
    throw new Error("Cannot reach backend API. Start backend using start_app.bat (or start_app.bat --http).");
  }
}

export function setAiState(text) {
  const el = document.getElementById("aiState");
  if (el) el.innerText = text;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
