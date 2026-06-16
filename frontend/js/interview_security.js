/**
 * Interview Security Module
 * - Tab switch detection with progressive warnings
 * - Additional face detection warnings (via face_detection.js)
 * - Auto-termination after 4 violations
 * - Best-effort fullscreen recovery when candidate returns
 */

import { apiFetch } from "./core.js";

let violationCount = 0;
const violationCountsByType = { tab_switch: 0, multiple_faces: 0 };
let securityActive = false;
let warningModal = null;
let violationBadge = null;
let lastBlurTime = 0;
let fullscreenRecoveryInFlight = false;
let lastFullscreenRecoveryAttempt = 0;
const BLUR_DEBOUNCE_MS = 1500;
const MAX_WARNINGS = 3;

const VIOLATION_LABELS = {
  tab_switch: "Tab switch",
  multiple_faces: "Extra face",
};

const WARNING_COPY = {
  tab_switch: [
    {
      title: "Warning — Tab Switch Detected",
      message:
        "You switched away from the interview window. This activity is monitored and recorded. Please stay on this page.",
    },
    {
      title: "Second Warning — Tab Switch",
      message:
        "You have switched tabs again. Continued violations will result in interview termination.",
    },
    {
      title: "Final Warning — Tab Switch",
      message:
        "This is your FINAL warning for leaving the interview window. One more violation will automatically terminate your interview.",
    },
  ],
  multiple_faces: [
    {
      title: "Warning — Additional Person Detected",
      message:
        "Another face was detected in your camera view. Only you should be visible during the interview. Remove other people from the frame.",
    },
    {
      title: "Second Warning — Multiple Faces",
      message:
        "Multiple faces were detected again. Continued violations will result in interview termination.",
    },
    {
      title: "Final Warning — Multiple Faces",
      message:
        "This is your FINAL warning for multiple faces on camera. One more violation will automatically terminate your interview.",
    },
  ],
  termination: {
    title: "Interview Terminated",
    message:
      "Your interview has been automatically terminated due to repeated policy violations. The HR team has been notified.",
  },
};

function createWarningModal() {
  if (document.getElementById("securityWarningModal")) return;
  const overlay = document.createElement("div");
  overlay.id = "securityWarningModal";
  overlay.style.cssText = `
    display:none; position:fixed; inset:0; z-index:99999;
    background:rgba(0,0,0,0.85); backdrop-filter:blur(8px);
    justify-content:center; align-items:center;
  `;
  overlay.innerHTML = `
    <div style="
      background:linear-gradient(135deg,#1e1b4b,#312e81);
      border:2px solid rgba(239,68,68,0.4); border-radius:20px;
      padding:40px 36px; max-width:480px; width:90%; text-align:center;
      box-shadow:0 25px 60px rgba(0,0,0,0.6);
    ">
      <div id="secWarnIcon" style="font-size:48px;margin-bottom:16px;">⚠️</div>
      <h2 id="secWarnTitle" style="color:#fbbf24;font-size:22px;font-weight:800;margin:0 0 12px;"></h2>
      <p id="secWarnMsg" style="color:#e2e8f0;font-size:15px;line-height:1.6;margin:0 0 24px;"></p>
      <div id="secWarnCounter" style="color:#f87171;font-size:13px;font-weight:700;margin-bottom:20px;"></div>
      <button id="secWarnBtn" onclick="document.getElementById('securityWarningModal').style.display='none'" style="
        padding:12px 32px; background:linear-gradient(135deg,#6366f1,#4f46e5);
        color:#fff; border:none; border-radius:12px; font-weight:700;
        font-size:15px; cursor:pointer; transition:all 0.2s;
      ">I Understand</button>
    </div>
  `;
  document.body.appendChild(overlay);
  warningModal = overlay;
}

function createViolationBadge() {
  if (document.getElementById("violationBadge")) return;
  const badge = document.createElement("div");
  badge.id = "violationBadge";
  badge.style.cssText = `
    display:none; position:fixed; top:12px; right:12px; z-index:9999;
    background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4);
    backdrop-filter:blur(8px); border-radius:12px; padding:8px 16px;
    color:#fca5a5; font-size:12px; font-weight:700;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  `;
  badge.innerHTML = `<span id="violationBadgeIcon">Shield</span> <span id="violationBadgeText">Violations: <span id="violationBadgeCount">0</span>/${MAX_WARNINGS + 1}</span>`;
  document.body.appendChild(badge);
  violationBadge = badge;
}

function warningForType(type, level) {
  const list = WARNING_COPY[type] || WARNING_COPY.tab_switch;
  return list[Math.min(Math.max(level, 1), MAX_WARNINGS) - 1] || list[0];
}

function showWarning(level, type = "tab_switch") {
  if (!warningModal) createWarningModal();
  if (level >= MAX_WARNINGS + 1) {
    const warn = WARNING_COPY.termination;
    document.getElementById("secWarnTitle").textContent = warn.title;
    document.getElementById("secWarnMsg").textContent = warn.message;
    document.getElementById("secWarnCounter").textContent = `Total violations: ${violationCount}`;
    document.getElementById("secWarnIcon").textContent = "🚫";
    const btn = document.getElementById("secWarnBtn");
    btn.textContent = "Interview Ended";
    btn.style.background = "linear-gradient(135deg,#dc2626,#b91c1c)";
    btn.onclick = () => {
      window.location.reload();
    };
  } else {
    const warn = warningForType(type, level);
    document.getElementById("secWarnTitle").textContent = warn.title;
    document.getElementById("secWarnMsg").textContent = warn.message;
    document.getElementById("secWarnCounter").textContent = `Warnings: ${Math.min(violationCount, MAX_WARNINGS)} of ${MAX_WARNINGS}`;
    document.getElementById("secWarnIcon").textContent = level >= 3 ? "🔴" : "⚠️";
    const btn = document.getElementById("secWarnBtn");
    btn.textContent = "I Understand";
    btn.style.background = "linear-gradient(135deg,#6366f1,#4f46e5)";
    btn.onclick = () => {
      warningModal.style.display = "none";
    };
  }
  warningModal.style.display = "flex";
}

function updateBadge() {
  if (!violationBadge) createViolationBadge();
  if (violationCount > 0) {
    violationBadge.style.display = "block";
    document.getElementById("violationBadgeCount").textContent = violationCount;
    const textEl = document.getElementById("violationBadgeText");
    if (textEl) {
      const parts = [];
      if (violationCountsByType.tab_switch) parts.push(`tab ${violationCountsByType.tab_switch}`);
      if (violationCountsByType.multiple_faces) parts.push(`faces ${violationCountsByType.multiple_faces}`);
      const detail = parts.length ? ` (${parts.join(", ")})` : "";
      textEl.innerHTML = `Violations: <span id="violationBadgeCount">${violationCount}</span>/${MAX_WARNINGS + 1}${detail}`;
    }
    if (violationCount >= 3) {
      violationBadge.style.borderColor = "rgba(239,68,68,0.8)";
      violationBadge.style.background = "rgba(239,68,68,0.25)";
    }
  }
}

async function restoreFullscreenAfterReturn() {
  if (!securityActive || document.hidden || document.fullscreenElement || fullscreenRecoveryInFlight) return;
  const now = Date.now();
  if (now - lastFullscreenRecoveryAttempt < 2000) return;
  lastFullscreenRecoveryAttempt = now;
  fullscreenRecoveryInFlight = true;
  try {
    if (typeof window.enterFullscreen === "function") {
      await window.enterFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch (_) {
    // Some browsers require a direct user gesture. The interview can continue.
  } finally {
    fullscreenRecoveryInFlight = false;
  }
}

function mapProctorViolationType(type) {
  if (type === "tab_switch") return "tabSwitch";
  if (type === "multiple_faces") return "extraFace";
  return type;
}

async function reportViolation(type, details = "") {
  violationCount++;
  if (Object.prototype.hasOwnProperty.call(violationCountsByType, type)) {
    violationCountsByType[type] += 1;
  }
  updateBadge();
  if (violationCount <= MAX_WARNINGS) showWarning(violationCount, type);

  if (typeof window.__karnexReportProctorViolation === "function") {
    try {
      window.__karnexReportProctorViolation(mapProctorViolationType(type), details);
    } catch (_) {
      /* ignore */
    }
  }

  try {
    const fd = new FormData();
    fd.append("violation_type", type);
    fd.append("details", details);
    const res = await apiFetch("/interview/violation", { method: "POST", body: fd });
    const data = await res.json();
    if (data.auto_terminated || violationCount > MAX_WARNINGS) {
      showWarning(MAX_WARNINGS + 1, type);
      triggerAutoTermination();
    }
  } catch (_) {
    if (violationCount > MAX_WARNINGS) {
      showWarning(MAX_WARNINGS + 1, type);
      triggerAutoTermination();
    }
  }
}

export function reportSecurityViolation(type, details = "") {
  if (!securityActive) return;
  reportViolation(type, details);
}

function triggerAutoTermination() {
  securityActive = false;
  try {
    window.__karnexInterviewExitOutcome = "terminated";
  } catch (_) {
    /* ignore */
  }
  if (typeof window.submitInterview === "function") {
    window.submitInterview();
  }
}

function onVisibilityChange() {
  if (!securityActive) return;
  if (document.hidden) {
    const now = Date.now();
    if (now - lastBlurTime < BLUR_DEBOUNCE_MS) return;
    lastBlurTime = now;
    reportViolation("tab_switch", "document.hidden via visibilitychange");
    return;
  }
  window.setTimeout(() => void restoreFullscreenAfterReturn(), 250);
}

export function activateInterviewSecurity() {
  if (securityActive) return;
  securityActive = true;
  violationCount = 0;
  violationCountsByType.tab_switch = 0;
  violationCountsByType.multiple_faces = 0;

  createWarningModal();
  createViolationBadge();

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("focus", restoreFullscreenAfterReturn);
}

export function deactivateInterviewSecurity() {
  securityActive = false;
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("focus", restoreFullscreenAfterReturn);

  if (warningModal) warningModal.style.display = "none";
  if (violationBadge) violationBadge.style.display = "none";
}
