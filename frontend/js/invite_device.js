/**
 * Stable device id for invite-bound interviews (x-device-id header).
 */

import { getAuthToken } from "./auth/session.js";

function _storageKey(inviteToken = "") {
  const t = String(inviteToken || "").trim();
  return t ? `karnexInviteDevice:${t}` : "karnexInviteDevice";
}

export function readInviteDeviceId(inviteToken = "") {
  try {
    return window.localStorage.getItem(_storageKey(inviteToken)) || "";
  } catch (_) {
    return "";
  }
}

export function writeInviteDeviceId(value, inviteToken = "") {
  const v = String(value || "").trim();
  if (!v) return;
  try {
    window.localStorage.setItem(_storageKey(inviteToken), v);
  } catch (_) {
    /* ignore */
  }
}

function _inviteTokenFromJwt() {
  const token = getAuthToken();
  if (!token) return "";
  try {
    const part = token.split(".")[1];
    if (!part) return "";
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload.invite_token || "").trim();
  } catch (_) {
    return "";
  }
}

/** Device id sent on every authenticated API call during invite interviews. */
export function resolveInviteDeviceId() {
  const inviteToken = _inviteTokenFromJwt();
  let deviceId = readInviteDeviceId(inviteToken);
  if (!deviceId) deviceId = readInviteDeviceId("");
  if (!deviceId && typeof crypto !== "undefined" && crypto.randomUUID) {
    deviceId = crypto.randomUUID();
    writeInviteDeviceId(deviceId, inviteToken || "");
  }
  return deviceId;
}
