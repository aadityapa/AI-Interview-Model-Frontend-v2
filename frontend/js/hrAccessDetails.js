/**
 * HR Setup — Candidate Access Details card (invite link, access key, email).
 */

import { formatHrDateTimeDisplay } from "./hrSetupUi.js";

let _accessState = {
  inviteUrl: "",
  accessKey: "",
  interviewDate: "",
  status: "Interview Scheduled",
  candidateEmail: "",
};

async function _copyText(text, btn, okLabel = "Copied!") {
  const t = String(text || "").trim();
  if (!t) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
    } else {
      const el = document.createElement("textarea");
      el.value = t;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    if (btn) {
      const prev = btn.innerHTML;
      btn.classList.add("is-copied");
      btn.innerHTML = okLabel;
      setTimeout(() => {
        btn.classList.remove("is-copied");
        btn.innerHTML = prev;
      }, 2000);
    }
    return true;
  } catch {
    return false;
  }
}

function _buildAllDetailsText() {
  const lines = [
    "Interview Link:",
    _accessState.inviteUrl || "—",
    "",
    "Access Key:",
    _accessState.accessKey || "—",
    "",
    "Interview Date:",
    _accessState.interviewDate || "—",
  ];
  return lines.join("\n");
}

function _buildEmailBody() {
  return [
    "Hello Candidate,",
    "",
    "Your interview has been scheduled.",
    "",
    "Interview Link:",
    _accessState.inviteUrl || "—",
    "",
    "Access Key:",
    _accessState.accessKey || "—",
    "",
    "Interview Date:",
    _accessState.interviewDate || "—",
    "",
    "Regards,",
    "HR Team",
  ].join("\n");
}

export function showCandidateAccessDetails({
  inviteUrl = "",
  accessKey = "",
  scheduledAt = "",
  status = "Interview Scheduled",
  candidateEmail = "",
} = {}) {
  const card = document.getElementById("kxAccessDetailsCard");
  if (!card) return;

  const inviteInput = document.getElementById("kxInviteLinkInput");
  const keyBlock = document.getElementById("kxAccessKeyBlock");
  const keyDisplay = document.getElementById("kxAccessKeyDisplay");
  const statusEl = document.getElementById("kxAccessStatus");
  const dateEl = document.getElementById("kxAccessDate");
  const openLink = document.getElementById("kxOpenLinkBtn");

  const url = String(inviteUrl || "").trim();
  const key = String(accessKey || "").trim();
  const dateLabel = formatHrDateTimeDisplay(scheduledAt);

  _accessState = {
    inviteUrl: url,
    accessKey: key,
    interviewDate: dateLabel,
    status: status || "Interview Scheduled",
    candidateEmail: String(candidateEmail || "").trim(),
  };

  if (inviteInput) {
    inviteInput.value = url;
    inviteInput.title = url;
  }
  if (openLink) {
    openLink.href = url || "#";
    openLink.style.pointerEvents = url ? "" : "none";
    openLink.setAttribute("aria-disabled", url ? "false" : "true");
  }
  if (keyBlock && keyDisplay) {
    if (key) {
      keyBlock.style.display = "";
      keyDisplay.textContent = key;
    } else {
      keyBlock.style.display = "none";
      keyDisplay.textContent = "";
    }
  }
  if (statusEl) statusEl.textContent = _accessState.status;
  if (dateEl) dateEl.textContent = dateLabel || "—";

  card.style.display = url ? "block" : "none";
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export async function kxCopyInviteLink() {
  const btn = document.getElementById("kxCopyLinkBtn");
  await _copyText(_accessState.inviteUrl, btn, "Copied!");
}

export async function kxCopyAccessKey() {
  const btn = document.getElementById("kxCopyKeyBtn");
  await _copyText(_accessState.accessKey, btn, "Copied!");
}

export async function kxCopyAllAccessDetails() {
  const btn = document.getElementById("kxCopyAllBtn");
  await _copyText(_buildAllDetailsText(), btn, "All Copied!");
}

export function kxOpenInviteLink() {
  const url = _accessState.inviteUrl;
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

export function kxOpenSendEmailModal() {
  const modal = document.getElementById("kxEmailModal");
  const subject = document.getElementById("kxEmailSubject");
  const body = document.getElementById("kxEmailBody");
  const mailto = document.getElementById("kxMailtoLink");
  if (!modal) return;

  const subj = "Interview Invitation";
  const bodyText = _buildEmailBody();
  if (subject) subject.value = subj;
  if (body) body.value = bodyText;

  const to = encodeURIComponent(_accessState.candidateEmail || "");
  const s = encodeURIComponent(subj);
  const b = encodeURIComponent(bodyText);
  if (mailto) {
    mailto.href = _accessState.candidateEmail
      ? `mailto:${to}?subject=${s}&body=${b}`
      : `mailto:?subject=${s}&body=${b}`;
  }

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

export function kxCloseSendEmailModal() {
  const modal = document.getElementById("kxEmailModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

export async function kxCopyEmailBody() {
  const body = document.getElementById("kxEmailBody");
  const btn = document.getElementById("kxCopyEmailBtn");
  await _copyText(body?.value || _buildEmailBody(), btn, "Copied!");
}

export function initHrAccessDetailsUi() {
  document.getElementById("kxCopyLinkBtn")?.addEventListener("click", kxCopyInviteLink);
  document.getElementById("kxCopyKeyBtn")?.addEventListener("click", kxCopyAccessKey);
  document.getElementById("kxCopyAllBtn")?.addEventListener("click", kxCopyAllAccessDetails);
  document.getElementById("kxOpenLinkBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    kxOpenInviteLink();
  });
  document.getElementById("kxSendEmailBtn")?.addEventListener("click", kxOpenSendEmailModal);
  document.getElementById("kxEmailModalClose")?.addEventListener("click", kxCloseSendEmailModal);
  document.getElementById("kxCopyEmailBtn")?.addEventListener("click", kxCopyEmailBody);
  document.querySelector("#kxEmailModal .kx-email-modal-backdrop")?.addEventListener("click", kxCloseSendEmailModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") kxCloseSendEmailModal();
  });
}
