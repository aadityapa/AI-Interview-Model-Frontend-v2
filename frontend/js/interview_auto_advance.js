/**
 * Smart auto-advance interview engine (Jun 2026).
 * Robust client-side VAD: noise calibration, speech-band energy, confirmation windows.
 */

import { state } from "./state.js";
import { apiFetch } from "./core.js";
import { isSileroSpeechActive, startSileroVad, stopSileroVad } from "./vad_silero.js";

const VOICE_COMMAND_PATTERNS = [
  /\bnext question\b/i,
  /\bskip\b/i,
  /\bi am done\b/i,
  /\bi'm done\b/i,
  /\bthat'?s all\b/i,
  /\bmove on\b/i,
  /\bfinished\b/i,
  /\bthat is my answer\b/i,
];

const SPEECH_BAND_LOW_HZ = 300;
const SPEECH_BAND_HIGH_HZ = 3400;
const CALIBRATION_MS = 1000;
const SPEECH_END_HANGOVER_MS = 280;
const DEBUG_LOG_THROTTLE_MS = 500;

/** Explicit interview phases — never allow deadlocks between these. */
export const AUTO_ADVANCE_PHASE = {
  IDLE: "idle",
  WAITING_FOR_RESPONSE: "waiting_for_response",
  NO_RESPONSE_WARNING: "no_response_warning",
  LISTENING: "listening",
  ANSWER_CAPTURED: "answer_captured",
  SUBMITTING: "moving_next",
  SKIPPED: "question_skipped",
};

let _active = false;
let _turnSeq = 0;
let _audioCtx = null;
let _analyser = null;
let _freqBuf = null;
let _timeBuf = null;
let _vadHandle = null;
let _countdownHandle = null;
let _countdownInterval = null;
let _speechRecognition = null;
let _callbacks = null;
let _turnMeta = null;
let _phase = AUTO_ADVANCE_PHASE.IDLE;

let _speechConfirmed = false;
let _speechCandidateSince = 0;
let _speechStartTs = 0;
let _lastSpeechTs = 0;
let _silenceSinceTs = 0;
let _belowHangoverSince = 0;
let _turnStartTs = 0;
let _confirmedSpeechMs = 0;
let _lastConfirmedSpeechFrameTs = 0;
let _interimTranscript = "";
let _confirmationActive = false;
let _noResponseHandled = false;
let _bannerActionInFlight = false;
let _bannerUiBound = false;

let _calibrated = false;
let _calibrationUntil = 0;
let _calibrationSamples = [];
let _noiseFloor = 0.01;
let _lastDebugLevelTs = 0;
let _debugPanelEl = null;
let _skipCountdownSeq = 0;
let _skipCountdownActive = false;
let _sileroActive = false;
let _sileroSpeechSince = 0;
let _warningCountdownSpeechSince = 0;
let _responseWaitHandle = null;
let _hardFallbackHandle = null;
let _hardFallbackDeadline = 0;
let _warningCycleId = 0;
let _warningCount = 0;
const WARNING_RESUME_SPEECH_MS = 1000;
const WARNING_CANCEL_MIN_MS = 500;
const HARD_NO_RESPONSE_MS = 15000;
const SUBSTANTIVE_SPEECH_MS = 800;

function _cfg() {
  return state.autoAdvance || {};
}

function _enabled() {
  return !!_cfg().enabled;
}

function _vadDebugEnabled() {
  try {
    if (new URLSearchParams(window.location.search).get("vad_debug") === "1") return true;
    return localStorage.getItem("vad_debug") === "1";
  } catch (_) {
    return false;
  }
}

function _vadLog(event, detail = {}) {
  const msg = `[VAD] ${event}`;
  if (_vadDebugEnabled()) {
    console.info(msg, detail);
    _appendDebugPanel(event, detail);
  }
}

/** Always-on lifecycle logs required for interview flow diagnostics (BUG #6). */
function _vadEventLog(event, detail = {}) {
  const msg = `[VAD] ${event}`;
  console.info(msg, Object.keys(detail).length ? detail : "");
  if (_vadDebugEnabled()) {
    _appendDebugPanel(event, detail);
  }
}

function _logAlways(prefix, event, detail = {}) {
  const msg = `[${prefix}] ${event}`;
  console.info(msg, Object.keys(detail).length ? detail : "");
  if (_vadDebugEnabled()) {
    _appendDebugPanel(`${prefix} ${event}`, detail);
  }
}

function _logInterview(event, detail = {}) {
  const msg = `[INTERVIEW] ${event}`;
  console.info(msg, Object.keys(detail).length ? detail : "");
}

function _appendDebugPanel(event, detail) {
  if (!_debugPanelEl) {
    _debugPanelEl = document.getElementById("vadDebugPanel");
  }
  if (!_debugPanelEl) return;
  const line = document.createElement("div");
  line.className = "vad-debug-line";
  const extra = Object.keys(detail).length ? ` ${JSON.stringify(detail)}` : "";
  line.textContent = `${new Date().toLocaleTimeString()} — ${event}${extra}`;
  _debugPanelEl.appendChild(line);
  while (_debugPanelEl.childNodes.length > 40) {
    _debugPanelEl.removeChild(_debugPanelEl.firstChild);
  }
  _debugPanelEl.scrollTop = _debugPanelEl.scrollHeight;
}

function _ensureDebugPanel() {
  if (!_vadDebugEnabled()) return;
  let panel = document.getElementById("vadDebugPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "vadDebugPanel";
    panel.className = "vad-debug-panel";
    panel.setAttribute("aria-live", "polite");
    const title = document.createElement("div");
    title.className = "vad-debug-title";
    title.textContent = "VAD Debug";
    panel.appendChild(title);
    document.body.appendChild(panel);
  }
  panel.hidden = false;
  _debugPanelEl = panel;
}

function _hideDebugPanel() {
  const panel = document.getElementById("vadDebugPanel");
  if (panel) panel.hidden = true;
}

function _wordCount(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function _speechThreshold() {
  const base = Number(_cfg().speech_energy_threshold) || 0.038;
  return Math.max(base, _noiseFloor * 4.0);
}

function _hangoverThreshold() {
  return _speechThreshold() * 0.65;
}

function _speechConfirmMs() {
  return Math.max(300, Math.min(500, Number(_cfg().speech_confirm_ms) || 400));
}

function _answerMeetsMinimum() {
  const minWords = Number(_cfg().minimum_answer_words) || 5;
  const minDurSec = Number(_cfg().minimum_speech_duration_sec) || 2;
  const words = _wordCount(_interimTranscript);
  const speechDurSec = _confirmedSpeechMs / 1000;
  return words >= minWords || speechDurSec >= minDurSec;
}

function _clearTimers() {
  if (_countdownHandle) {
    clearTimeout(_countdownHandle);
    _countdownHandle = null;
  }
  if (_countdownInterval) {
    clearInterval(_countdownInterval);
    _countdownInterval = null;
  }
}

function _clearResponseWaitTimer() {
  if (_responseWaitHandle) {
    clearTimeout(_responseWaitHandle);
    _responseWaitHandle = null;
  }
}

function _clearResponseTimers() {
  _clearResponseWaitTimer();
  if (_hardFallbackHandle) {
    clearTimeout(_hardFallbackHandle);
    _hardFallbackHandle = null;
  }
}

function _maxWarningsBeforeFinalize() {
  return Math.max(1, Number(_cfg().max_no_response_warnings) || 3);
}

function _getExternalCaptureText() {
  try {
    return String(_callbacks?.getCaptureText?.() || "").trim();
  } catch (_) {
    return "";
  }
}

function _getCombinedCaptureText() {
  const external = _getExternalCaptureText();
  if (external) return external;
  return String(_interimTranscript || "").trim();
}

/** Partial transcripts do NOT block warnings — candidate may have started then gone silent. */
function _shouldBlockNoResponseWarning() {
  if (_sileroHumanSpeech()) return true;
  if (_speechConfirmed && _lastSpeechTs && Date.now() - _lastSpeechTs < 1200) return true;
  return false;
}

function _hasCapturableAnswer() {
  if (_wordCount(_getCombinedCaptureText()) > 0) return true;
  if (_confirmedSpeechMs >= 1000) return true;
  return false;
}

function _scheduleNextWarningWait() {
  _noResponseHandled = false;
  _skipCountdownActive = false;
  _warningCountdownSpeechSince = 0;
  _bannerActionInFlight = false;
  _clearTimers();
  _hideBanner();
  _turnStartTs = Date.now();
  _setPhase(AUTO_ADVANCE_PHASE.WAITING_FOR_RESPONSE, "Waiting for your response…");
  _startResponseTimers();
  _logInterview("Waiting for response before next warning", { warningCount: _warningCount });
}

function _scheduleHardFallbackTimer() {
  if (_hardFallbackHandle) {
    clearTimeout(_hardFallbackHandle);
    _hardFallbackHandle = null;
  }
  _hardFallbackDeadline = Date.now() + HARD_NO_RESPONSE_MS;
  _hardFallbackHandle = setTimeout(() => {
    _hardFallbackHandle = null;
    if (!_active) return;
    if (!_noResponseHandled) {
      if (_shouldBlockNoResponseWarning()) return;
      _logInterview("Hard timeout — forcing warning", { afterSec: HARD_NO_RESPONSE_MS / 1000 });
      _beginNoResponseWarning();
      return;
    }
    if (_skipCountdownActive && _canAutoSkipAfterCountdown()) {
      _skipCountdownActive = false;
      _logInterview("Hard timeout — warning countdown expired", { warningNumber: _warningCount });
      const maxWarnings = _maxWarningsBeforeFinalize();
      if (_warningCount < maxWarnings) {
        _scheduleNextWarningWait();
      } else if (_hasCapturableAnswer()) {
        void _triggerAutoSubmit("hard_timeout_save_partial", { partial_answer: true });
      } else {
        void _triggerAutoSkip("hard_timeout_fallback");
      }
    }
  }, HARD_NO_RESPONSE_MS);
}

function _startResponseTimers() {
  _clearResponseTimers();
  const waitMs = (_cfg().initial_response_wait_sec || 5) * 1000;
  _logInterview("Silence timer started", { waitSec: waitMs / 1000, hardSec: HARD_NO_RESPONSE_MS / 1000 });
  _scheduleHardFallbackTimer();
  _responseWaitHandle = setTimeout(() => {
    _responseWaitHandle = null;
    if (!_active || _noResponseHandled || _shouldBlockNoResponseWarning()) return;
    if (_phase !== AUTO_ADVANCE_PHASE.WAITING_FOR_RESPONSE) return;
    _logInterview("Silence timer fired", { waitSec: waitMs / 1000 });
    _beginNoResponseWarning();
  }, waitMs);
}

function _resetWarningCycleState(reason = "warning_resume") {
  _noResponseHandled = false;
  _skipCountdownActive = false;
  _warningCountdownSpeechSince = 0;
  _sileroSpeechSince = 0;
  _bannerActionInFlight = false;
  _clearTimers();
  _hideBanner();
  _turnStartTs = Date.now();
  _scheduleHardFallbackTimer();
  _logInterview("Warning state reset", { reason, warningCycleId: _warningCycleId });
}

function _stopVad() {
  if (_vadHandle) {
    cancelAnimationFrame(_vadHandle);
    _vadHandle = null;
  }
  if (_analyser) {
    try {
      _analyser.disconnect();
    } catch (_) {
      /* ignore */
    }
    _analyser = null;
  }
  if (_audioCtx) {
    try {
      _audioCtx.close();
    } catch (_) {
      /* ignore */
    }
    _audioCtx = null;
  }
  _freqBuf = null;
  _timeBuf = null;
}

function _stopSpeechRecognition() {
  if (!_speechRecognition) return;
  try {
    _speechRecognition.onresult = null;
    _speechRecognition.onerror = null;
    _speechRecognition.onend = null;
    _speechRecognition.stop();
  } catch (_) {
    /* ignore */
  }
  _speechRecognition = null;
}

function _isNoResponseWarningPhase() {
  return _phase === AUTO_ADVANCE_PHASE.NO_RESPONSE_WARNING;
}

function _isAnswerCapturedPhase() {
  return _confirmationActive || _phase === AUTO_ADVANCE_PHASE.ANSWER_CAPTURED;
}

function _setBannerButtonsEnabled(enabled) {
  const cont = document.getElementById("autoAdvanceContinueBtn");
  const conf = document.getElementById("autoAdvanceConfirmBtn");
  [cont, conf].forEach((btn) => {
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.remove("is-loading");
  });
}

function _setBannerButtonsLoading(loading) {
  const cont = document.getElementById("autoAdvanceContinueBtn");
  const conf = document.getElementById("autoAdvanceConfirmBtn");
  [cont, conf].forEach((btn) => {
    if (!btn) return;
    btn.disabled = !!loading;
    btn.classList.toggle("is-loading", !!loading);
  });
}

function _updateBannerForPhase(phase) {
  const titleEl = document.getElementById("autoAdvanceTitle");
  const msgEl = document.getElementById("autoAdvanceMessage");
  const confirmBtn = document.getElementById("autoAdvanceConfirmBtn");
  const continueBtn = document.getElementById("autoAdvanceContinueBtn");

  if (phase === AUTO_ADVANCE_PHASE.NO_RESPONSE_WARNING) {
    if (titleEl) titleEl.innerText = "⚠ No response detected";
    if (msgEl) msgEl.innerText = "Speak now or question will be skipped";
    if (confirmBtn) confirmBtn.innerText = "Skip Question";
    if (continueBtn) continueBtn.innerText = "Continue Speaking";
    return;
  }

  if (phase === AUTO_ADVANCE_PHASE.ANSWER_CAPTURED) {
    if (titleEl) titleEl.innerText = "Answer detected";
    if (msgEl) msgEl.innerText = "Moving to next question in:";
    if (confirmBtn) confirmBtn.innerText = "Submit Now";
    if (continueBtn) continueBtn.innerText = "Continue Speaking";
  }
}

function _setPhase(phase, message) {
  if (
    _skipCountdownActive &&
    phase !== AUTO_ADVANCE_PHASE.NO_RESPONSE_WARNING &&
    phase !== AUTO_ADVANCE_PHASE.SKIPPED &&
    phase !== AUTO_ADVANCE_PHASE.LISTENING &&
    phase !== AUTO_ADVANCE_PHASE.SUBMITTING
  ) {
    return;
  }
  _phase = phase;
  if (_callbacks?.onPhase) _callbacks.onPhase(phase, message);

  const banner = document.getElementById("autoAdvanceBanner");
  const msgEl = document.getElementById("autoAdvanceMessage");
  const showBanner =
    phase === AUTO_ADVANCE_PHASE.ANSWER_CAPTURED ||
    phase === AUTO_ADVANCE_PHASE.NO_RESPONSE_WARNING ||
    phase === AUTO_ADVANCE_PHASE.SUBMITTING ||
    phase === AUTO_ADVANCE_PHASE.SKIPPED;

  if (showBanner) {
    _updateBannerForPhase(phase);
  }

  if (banner) {
    banner.classList.toggle("is-visible", showBanner);
    banner.dataset.phase = phase;
  }

  if (msgEl && message && !showBanner) {
    msgEl.innerText = message;
  }

  if (showBanner) {
    _setBannerButtonsEnabled(true);
    _bannerActionInFlight = false;
  }
}

function _hideBanner() {
  const banner = document.getElementById("autoAdvanceBanner");
  if (banner) banner.classList.remove("is-visible");
  _setBannerButtonsEnabled(true);
  _bannerActionInFlight = false;
}

function _rmsFromTimeDomain(timeBuf) {
  let sum = 0;
  for (let i = 0; i < timeBuf.length; i++) {
    const v = (timeBuf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / timeBuf.length);
}

function _zeroCrossingRate(timeBuf) {
  let crossings = 0;
  for (let i = 1; i < timeBuf.length; i++) {
    const a = timeBuf[i] - 128;
    const b = timeBuf[i - 1] - 128;
    if ((a >= 0 && b < 0) || (a < 0 && b >= 0)) crossings++;
  }
  return crossings / timeBuf.length;
}

function _speechBandRatio(analyser, freqBuf, sampleRate) {
  analyser.getByteFrequencyData(freqBuf);
  const binCount = freqBuf.length;
  const nyquist = sampleRate / 2;
  const binHz = nyquist / binCount;
  const lowBin = Math.floor(SPEECH_BAND_LOW_HZ / binHz);
  const highBin = Math.min(binCount - 1, Math.ceil(SPEECH_BAND_HIGH_HZ / binHz));

  let total = 0;
  let speechBand = 0;
  for (let i = 0; i < binCount; i++) {
    const e = freqBuf[i] / 255;
    total += e;
    if (i >= lowBin && i <= highBin) speechBand += e;
  }
  return total > 0.001 ? speechBand / total : 0;
}

function _analyzeFrame() {
  _analyser.getByteTimeDomainData(_timeBuf);
  const rms = _rmsFromTimeDomain(_timeBuf);
  const zcr = _zeroCrossingRate(_timeBuf);
  const bandRatio = _speechBandRatio(_analyser, _freqBuf, _audioCtx.sampleRate);
  return { rms, zcr, bandRatio };
}

function _isSpeechCandidate(features) {
  if (
    (_skipCountdownActive || _isNoResponseWarningPhase() || _speechConfirmed) &&
    _sileroHumanSpeech()
  ) {
    return true;
  }
  const threshold = _speechThreshold();
  const energyOk = features.rms >= threshold;
  const bandOk = features.bandRatio >= 0.22 && features.bandRatio <= 0.9;
  const notTransient = features.zcr <= 0.38;
  return energyOk && bandOk && notTransient;
}

function _isStillSpeaking(features) {
  return features.rms >= _hangoverThreshold() && features.bandRatio >= 0.18;
}

function _isWarningPhaseSpeech(features) {
  return features.rms >= _speechThreshold() * 0.8 && features.bandRatio >= 0.15;
}

function _sileroHumanSpeech() {
  return _sileroActive || isSileroSpeechActive();
}

function _trackWarningCountdownSpeech(features, now) {
  if (!_skipCountdownActive && !_isNoResponseWarningPhase()) {
    _warningCountdownSpeechSince = 0;
    return;
  }
  const fftSpeech =
    features &&
    (_isWarningPhaseSpeech(features) ||
      (features.rms >= _speechThreshold() && features.bandRatio >= 0.18));
  if (_sileroHumanSpeech() || fftSpeech) {
    if (!_warningCountdownSpeechSince) _warningCountdownSpeechSince = now;
  } else if (!_sileroHumanSpeech() && !fftSpeech && _warningCountdownSpeechSince) {
    if (now - _warningCountdownSpeechSince < 200) return;
    _warningCountdownSpeechSince = 0;
  }
}

function _warningResumeSignal(features, now) {
  if (_wordCount(_getCombinedCaptureText()) > 0) return "transcript_words";
  _trackWarningCountdownSpeech(features, now);
  if (
    _warningCountdownSpeechSince > 0 &&
    now - _warningCountdownSpeechSince >= WARNING_CANCEL_MIN_MS
  ) {
    return "warning_speech_sustained";
  }
  return null;
}

function _cancelSkipCountdown(reason, { hideBanner = true } = {}) {
  if (!_skipCountdownActive && !_noResponseHandled && !_isNoResponseWarningPhase()) return false;
  _skipCountdownSeq += 1;
  _skipCountdownActive = false;
  _clearTimers();
  if (hideBanner) _hideBanner();
  _noResponseHandled = false;
  _bannerActionInFlight = false;
  _warningCountdownSpeechSince = 0;
  _vadEventLog("Countdown cancelled", { reason, warningCycleId: _warningCycleId });
  return true;
}

function _resumeAnswerDuringWarning(reason, features, now) {
  if (!_skipCountdownActive && !_isNoResponseWarningPhase() && !_noResponseHandled) return false;
  if (!_cancelSkipCountdown(reason)) return false;

  _vadEventLog("Voice detected", { reason, during: "warning_countdown", warningCycleId: _warningCycleId });
  _logAlways("VAD", "Speech detected");
  _logAlways("VAD", "Warning cancelled");
  _logInterview("Warning cancelled by speech", { reason, warningCycleId: _warningCycleId });

  if (!_speechConfirmed) {
    if (features && (_isSpeechCandidate(features) || _isWarningPhaseSpeech(features))) {
      if (!_speechCandidateSince) _speechCandidateSince = now;
    }
    _confirmSpeech(now);
  } else {
    _setPhase(AUTO_ADVANCE_PHASE.LISTENING, "Listening…");
    _vadEventLog("Listening");
  }
  _resetWarningCycleState("speech_during_warning");
  return true;
}

function _onTranscriptDuringWarning() {
  if (!_skipCountdownActive && !_isNoResponseWarningPhase() && !_noResponseHandled) return;
  if (_wordCount(_interimTranscript) === 0) return;
  _resumeAnswerDuringWarning("transcript_words", null, Date.now());
}

function _finishCalibration() {
  if (_calibrationSamples.length === 0) {
    _noiseFloor = (Number(_cfg().speech_energy_threshold) || 0.038) * 0.35;
  } else {
    const sorted = [..._calibrationSamples].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.75);
    _noiseFloor = sorted[Math.min(idx, sorted.length - 1)];
  }
  _calibrated = true;
  _vadLog("Calibration complete", {
    noiseFloor: Number(_noiseFloor.toFixed(4)),
    threshold: Number(_speechThreshold().toFixed(4)),
  });
}

function _resetSpeechTracking() {
  _speechConfirmed = false;
  _speechCandidateSince = 0;
  _speechStartTs = 0;
  _lastSpeechTs = 0;
  _silenceSinceTs = 0;
  _belowHangoverSince = 0;
  _confirmedSpeechMs = 0;
  _lastConfirmedSpeechFrameTs = 0;
  _sileroSpeechSince = 0;
  _warningCountdownSpeechSince = 0;
}

function _confirmSpeech(now) {
  if (_speechConfirmed) return;
  _speechConfirmed = true;
  _speechStartTs = now;
  _lastSpeechTs = now;
  _lastConfirmedSpeechFrameTs = now;
  _silenceSinceTs = 0;
  _belowHangoverSince = 0;
  _vadLog("Speech Started", {
    threshold: Number(_speechThreshold().toFixed(4)),
    bandRatio: "confirmed",
  });
  _vadEventLog("Listening");
  _setPhase(AUTO_ADVANCE_PHASE.LISTENING, "Listening…");
  if (_callbacks?.onSpeechStart) _callbacks.onSpeechStart(now);
}

function _endSpeech(now) {
  if (!_speechConfirmed) return;
  const durationSec = ((now - _speechStartTs) / 1000).toFixed(1);
  _vadLog("Speech Ended", { durationSec });
  _lastSpeechTs = now;
  if (!_silenceSinceTs) _silenceSinceTs = now;
}

function _matchesVoiceCommand(text) {
  if (!_cfg().voice_commands_enabled) return false;
  const t = String(text || "").trim();
  if (!t) return false;
  return VOICE_COMMAND_PATTERNS.some((re) => re.test(t));
}

function _buildEventMeta(trigger, extra = {}) {
  const now = Date.now();
  const captureText = _getCombinedCaptureText();
  const base = {
    trigger,
    question_index: _turnMeta?.questionIndex,
    warning_count: _warningCount,
    start_speaking_at: _speechStartTs ? new Date(_speechStartTs).toISOString() : null,
    end_speaking_at: new Date(now).toISOString(),
    silence_duration_ms: _silenceSinceTs && _lastSpeechTs ? Math.max(0, now - _silenceSinceTs) : null,
    speech_duration_ms: _confirmedSpeechMs || null,
    confirmed_speech_ms: _confirmedSpeechMs || null,
    word_count: _wordCount(captureText || _interimTranscript),
    speech_confirmed: _speechConfirmed,
    silero_speech_active: _sileroHumanSpeech(),
    vad_speech_detected: _speechConfirmed || _sileroHumanSpeech(),
    interim_transcript: captureText || _interimTranscript,
    capture_text: captureText,
    interim_transcript_len: (captureText || _interimTranscript).length,
    noise_floor: Number(_noiseFloor.toFixed(5)),
    speech_threshold: Number(_speechThreshold().toFixed(5)),
    ...extra,
  };
  if (base.auto_submitted === undefined) {
    base.auto_submitted = !["no_response", "manual_skip"].includes(trigger) || !!extra.partial_answer;
  }
  if (base.skipped === undefined) {
    base.skipped = trigger === "no_response" || trigger === "manual_skip";
  }
  return base;
}

function _startCountdown(seconds, mode, onComplete) {
  _clearTimers();
  const seq = ++_skipCountdownSeq;
  let left = Math.max(1, Number(seconds) || 1);
  const countdownEl = document.getElementById("autoAdvanceCountdown");
  const statusEl = document.getElementById("candidateStatus");

  const tick = () => {
    if (countdownEl) countdownEl.innerText = String(left);
    if (statusEl) {
      statusEl.innerText =
        mode === "no_response"
          ? `Speak now or question will be skipped in ${left}s`
          : `Answer detected — moving to next question in ${left}s`;
    }
  };

  tick();
  _countdownInterval = setInterval(() => {
    if (seq !== _skipCountdownSeq) return;
    left -= 1;
    if (left <= 0) {
      _clearTimers();
      if (seq !== _skipCountdownSeq) return;
      onComplete();
      return;
    }
    tick();
  }, 1000);
}

async function _validateSkipWithServer(meta) {
  try {
    const res = await apiFetch("/candidate/validate-speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_advance_meta: meta, action: "skip" }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.allow_skip !== false;
  } catch (_) {
    return !_sileroHumanSpeech() && !_speechConfirmed && _wordCount(_interimTranscript) === 0;
  }
}

async function _triggerAutoSubmit(trigger, extra = {}) {
  if (!_active) return;
  const onAutoSubmit = _callbacks?.onAutoSubmit;
  if (!onAutoSubmit) return;
  _vadLog("Auto Submit Triggered", { trigger });
  const meta = _buildEventMeta(trigger, { auto_submitted: true, skipped: false, ...extra });
  stopAutoAdvanceTurn();
  onAutoSubmit(meta);
}

async function _triggerAutoSkip(reason) {
  if (!_active) return;
  if (_hasCapturableAnswer()) {
    _logAlways("ANSWER", "Partial transcript detected");
    _logAlways("ANSWER", "Saving transcript");
    await _triggerAutoSubmit("save_before_skip", { partial_answer: true });
    return;
  }
  if (_sileroHumanSpeech() || _speechConfirmed || _wordCount(_interimTranscript) > 0) {
    _logAlways("VAD", "Auto skip blocked — human speech active");
    _resumeAnswerDuringWarning("speech_active_before_skip", null, Date.now());
    return;
  }
  const onAutoSkip = _callbacks?.onAutoSkip;
  if (!onAutoSkip) return;
  const meta = _buildEventMeta("no_response", { skipped: true, auto_submitted: false });
  const allowed = await _validateSkipWithServer(meta);
  if (!allowed) {
    _logAlways("VAD", "Server blocked auto-skip — speech evidence");
    _resumeAnswerDuringWarning("server_speech_validation", null, Date.now());
    return;
  }
  _vadLog("Auto Skip Triggered", { reason });
  const skipReason = reason || "Auto skip — no response detected";
  stopAutoAdvanceTurn();
  onAutoSkip(skipReason, meta);
}

function _beginConfirmationCountdown() {
  if (_confirmationActive) return;
  _confirmationActive = true;
  const sec = _cfg().confirmation_before_next_sec ?? 3;
  _vadEventLog("Answer complete", { confirmationSec: sec });
  _setPhase(
    AUTO_ADVANCE_PHASE.ANSWER_CAPTURED,
    `Answer detected. Moving to next question in ${sec} seconds…`
  );
  _startCountdown(sec, "answer_captured", () => {
    _confirmationActive = false;
    _setPhase(AUTO_ADVANCE_PHASE.SUBMITTING, "Submitting your answer…");
    _triggerAutoSubmit("silence");
  });
}

function _cancelConfirmation() {
  if (!_confirmationActive) return;
  _confirmationActive = false;
  _clearTimers();
  _hideBanner();
  _setPhase(AUTO_ADVANCE_PHASE.LISTENING, "Continue speaking — we're still listening.");
}

function _resumeFromNoResponseWarning() {
  if (!_active || !_isNoResponseWarningPhase()) return;
  if (_bannerActionInFlight) return;

  _cancelSkipCountdown("continue_speaking_button");
  _resetWarningCycleState("continue_speaking_button");
  _startResponseTimers();
  _vadLog("Waiting Timer reset", { reason: "continue_speaking" });
  _setPhase(AUTO_ADVANCE_PHASE.WAITING_FOR_RESPONSE, "Waiting for your response…");
}

function _canAutoSkipAfterCountdown() {
  if (!_active) return false;
  if (_sileroHumanSpeech()) return false;
  if (_speechConfirmed) return false;
  if (_speechCandidateSince > 0) return false;
  if (_wordCount(_getCombinedCaptureText()) > 0) return false;
  if (_confirmedSpeechMs >= WARNING_RESUME_SPEECH_MS) return false;
  return true;
}

function _beginNoResponseWarning() {
  if (!_active || _noResponseHandled) return;
  if (_shouldBlockNoResponseWarning()) return;
  _warningCount += 1;
  _noResponseHandled = true;
  _warningCycleId += 1;
  _warningCountdownSpeechSince = 0;
  _clearResponseWaitTimer();
  _logAlways("WARNING", `Warning #${_warningCount} shown`);
  _logInterview("Warning displayed", { warningCycleId: _warningCycleId, warningNumber: _warningCount });
  _vadLog("No-response warning shown", { warningNumber: _warningCount });

  const cd = _cfg().no_response_countdown_sec || 3;
  _setPhase(AUTO_ADVANCE_PHASE.NO_RESPONSE_WARNING, "No response detected. Please start speaking.");
  _skipCountdownActive = true;
  _vadEventLog("Waiting for response", { phase: "warning_countdown", seconds: cd, warningNumber: _warningCount });
  _logInterview("Countdown started", { seconds: cd, warningCycleId: _warningCycleId, warningNumber: _warningCount });
  _logAlways("WARNING", "Countdown started", { seconds: cd, warningNumber: _warningCount });
  _startCountdown(cd, "no_response", () => {
    void (async () => {
      if (!_skipCountdownActive) return;
      if (!_canAutoSkipAfterCountdown()) {
        _logAlways("VAD", "Countdown expired but skip blocked — speech/transcript detected");
        _resumeAnswerDuringWarning("countdown_speech_detected", null, Date.now());
        return;
      }
      _skipCountdownActive = false;
      _logInterview("Countdown completed", { warningNumber: _warningCount });

      const maxWarnings = _maxWarningsBeforeFinalize();
      if (_warningCount < maxWarnings) {
        _logAlways("WARNING", `Warning #${_warningCount} ended — scheduling warning #${_warningCount + 1}`);
        _scheduleNextWarningWait();
        return;
      }

      if (_hasCapturableAnswer()) {
        _logAlways("ANSWER", "Partial transcript detected");
        _logAlways("ANSWER", "Saving transcript");
        _setPhase(AUTO_ADVANCE_PHASE.SUBMITTING, "Saving your answer…");
        await _triggerAutoSubmit("no_response_save_partial", { partial_answer: true });
        return;
      }

      if (!_cfg().auto_skip_enabled) {
        _noResponseHandled = false;
        _scheduleNextWarningWait();
        return;
      }

      _setPhase(AUTO_ADVANCE_PHASE.SKIPPED, "Question skipped — loading next question…");
      _logInterview("Question skipped", { warningNumber: _warningCount });
      await _triggerAutoSkip("Auto skip — no response after warnings");
    })();
  });
}

function _onSilenceDetected(now) {
  if (!_active || _confirmationActive || !_speechConfirmed) return;

  const silenceMs = (_cfg().silence_detection_sec || 3) * 1000;
  const silenceDur = now - _silenceSinceTs;
  if (silenceDur < silenceMs) return;

  _vadLog("Silence Duration", { sec: Number((silenceDur / 1000).toFixed(1)) });
  _vadEventLog("Silence detected", { sec: Number((silenceDur / 1000).toFixed(1)) });

  if (!_answerMeetsMinimum()) {
    _vadLog("Answer incomplete — resuming listen", {
      words: _wordCount(_interimTranscript),
      speechSec: Number((_confirmedSpeechMs / 1000).toFixed(1)),
    });
    _resetSpeechTracking();
    _setPhase(AUTO_ADVANCE_PHASE.WAITING_FOR_RESPONSE, "Keep speaking — we need a fuller answer.");
    return;
  }

  _silenceSinceTs = _lastSpeechTs + silenceMs;
  if (_cfg().confirmation_before_next_sec > 0) {
    _beginConfirmationCountdown();
  } else {
    _vadEventLog("Answer complete", { autoSubmit: true });
    _setPhase(AUTO_ADVANCE_PHASE.SUBMITTING, "Answer captured. Submitting…");
    _triggerAutoSubmit("silence");
  }
}

function _processSpeechCandidate(features, isCandidate, now) {
  if (_skipCountdownActive || _isNoResponseWarningPhase() || (_noResponseHandled && !_speechConfirmed)) {
    const signal = _warningResumeSignal(features, now);
    if (signal) {
      _resumeAnswerDuringWarning(signal, features, now);
    }
  }

  if (isCandidate) {
    if (!_speechCandidateSince) _speechCandidateSince = now;
    if (!_speechConfirmed && now - _speechCandidateSince >= _speechConfirmMs()) {
      if (_confirmationActive) _cancelConfirmation();
      if (_noResponseHandled || _skipCountdownActive || _isNoResponseWarningPhase()) {
        _resumeAnswerDuringWarning("speech_confirmed", features, now);
        return;
      }
      _confirmSpeech(now);
    }
    if (_speechConfirmed) {
      _lastSpeechTs = now;
      _belowHangoverSince = 0;
      _silenceSinceTs = 0;
      if (_lastConfirmedSpeechFrameTs) {
        _confirmedSpeechMs += now - _lastConfirmedSpeechFrameTs;
      }
      _lastConfirmedSpeechFrameTs = now;
    }
    return;
  }

  _speechCandidateSince = 0;

  if (_speechConfirmed) {
    if (_isStillSpeaking(features)) {
      _belowHangoverSince = 0;
      _lastSpeechTs = now;
      _silenceSinceTs = 0;
      if (_lastConfirmedSpeechFrameTs) {
        _confirmedSpeechMs += now - _lastConfirmedSpeechFrameTs;
      }
      _lastConfirmedSpeechFrameTs = now;
      return;
    }

    if (!_belowHangoverSince) _belowHangoverSince = now;
    if (now - _belowHangoverSince >= SPEECH_END_HANGOVER_MS) {
      _endSpeech(now);
      if (!_confirmationActive) {
        _onSilenceDetected(now);
      }
    }
  }
}

function _vadLoop() {
  if (!_active || !_analyser || !_timeBuf || !_freqBuf) return;
  const now = Date.now();
  const features = _analyzeFrame();

  if (now - _lastDebugLevelTs >= DEBUG_LOG_THROTTLE_MS) {
    _lastDebugLevelTs = now;
    const levelDetail = {
      rms: Number(features.rms.toFixed(4)),
      band: Number(features.bandRatio.toFixed(3)),
      zcr: Number(features.zcr.toFixed(3)),
      threshold: Number(_speechThreshold().toFixed(4)),
      silero: _sileroHumanSpeech(),
      speechConfirmed: _speechConfirmed,
    };
    _vadLog("Audio Level", levelDetail);
  }

  if (!_calibrated) {
    _calibrationSamples.push(features.rms);
    if (now >= _calibrationUntil) {
      _finishCalibration();
    }
    _vadHandle = requestAnimationFrame(_vadLoop);
    return;
  }

  const isCandidate = _isSpeechCandidate(features);
  _processSpeechCandidate(features, isCandidate, now);

  if (_skipCountdownActive || _isNoResponseWarningPhase()) {
    const lateSignal = _warningResumeSignal(features, now);
    if (lateSignal) {
      _resumeAnswerDuringWarning(lateSignal, features, now);
    }
  }

  if (
    _calibrated &&
    !_confirmationActive &&
    !_noResponseHandled &&
    _phase === AUTO_ADVANCE_PHASE.WAITING_FOR_RESPONSE &&
    !_shouldBlockNoResponseWarning()
  ) {
    const waitMs = (_cfg().initial_response_wait_sec || 5) * 1000;
    if (now - _turnStartTs >= waitMs && !_responseWaitHandle) {
      _vadLog("Waiting Timer expired (vad loop backup)", {
        waitingSec: ((now - _turnStartTs) / 1000).toFixed(1),
      });
      _beginNoResponseWarning();
    }
  }

  if (_cfg().voice_commands_enabled && _interimTranscript && _matchesVoiceCommand(_interimTranscript)) {
    if (_answerMeetsMinimum() || _speechConfirmed) {
      _setPhase(AUTO_ADVANCE_PHASE.SUBMITTING, "Voice command detected. Submitting…");
      _triggerAutoSubmit("voice_command");
      return;
    }
  }

  _vadHandle = requestAnimationFrame(_vadLoop);
}

function _startSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  try {
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      _interimTranscript = text.trim();
      if (_callbacks?.onInterimTranscript) _callbacks.onInterimTranscript(_interimTranscript);
      _onTranscriptDuringWarning();
      if (_cfg().voice_commands_enabled && _matchesVoiceCommand(_interimTranscript)) {
        if (_answerMeetsMinimum() || _speechConfirmed) {
          _setPhase(AUTO_ADVANCE_PHASE.SUBMITTING, "Voice command detected. Submitting…");
          _triggerAutoSubmit("voice_command");
        }
      }
    };
    rec.onerror = () => {};
    rec.onend = () => {
      if (_active) {
        try {
          rec.start();
        } catch (_) {
          /* ignore */
        }
      }
    };
    rec.start();
    _speechRecognition = rec;
  } catch (_) {
    /* ignore */
  }
}

export function applyAutoAdvanceConfig(payload = {}) {
  const aa = payload.auto_advance || payload;
  state.autoAdvance = {
    enabled: !!(aa.enabled ?? payload.auto_advance_enabled),
    initial_response_wait_sec: Number(aa.initial_response_wait_sec ?? aa.response_wait_timeout) || 5,
    silence_detection_sec: Number(aa.silence_detection_sec ?? aa.silence_detection_timeout) || 3,
    no_response_countdown_sec: Number(aa.no_response_countdown_sec) || 3,
    max_no_response_warnings: Number(aa.max_no_response_warnings) || 3,
    auto_skip_enabled: aa.auto_skip_enabled !== false,
    voice_commands_enabled: aa.voice_commands_enabled !== false,
    confirmation_before_next_sec: Number(aa.confirmation_before_next_sec ?? 3),
    minimum_answer_words: Number(aa.minimum_answer_words) || 5,
    minimum_speech_duration_sec: Number(aa.minimum_speech_duration_sec) || 2,
    speech_energy_threshold: Number(aa.speech_energy_threshold) || 0.038,
    speech_confirm_ms: Number(aa.speech_confirm_ms) || 400,
  };
}

export function getAutoAdvanceCaptureSnapshot() {
  const captureText = _getCombinedCaptureText();
  return {
    active: _active,
    capture_text: captureText,
    interim_transcript: captureText || _interimTranscript,
    speech_duration_ms: _confirmedSpeechMs || 0,
    confirmed_speech_ms: _confirmedSpeechMs || 0,
    word_count: _wordCount(captureText || _interimTranscript),
    speech_confirmed: _speechConfirmed,
    silero_speech_active: _sileroHumanSpeech(),
    warning_count: _warningCount,
  };
}

export function resetAutoAdvanceUi() {
  stopAutoAdvanceTurn();
  _hideBanner();
}

export function stopAutoAdvanceTurn() {
  _active = false;
  _turnSeq += 1;
  _confirmationActive = false;
  _resetSpeechTracking();
  _interimTranscript = "";
  _noResponseHandled = false;
  _bannerActionInFlight = false;
  _calibrated = false;
  _calibrationSamples = [];
  _skipCountdownSeq += 1;
  _skipCountdownActive = false;
  _clearTimers();
  _clearResponseTimers();
  _hardFallbackDeadline = 0;
  _warningCountdownSpeechSince = 0;
  _hideBanner();
  _stopVad();
  void stopSileroVad();
  _sileroActive = false;
  _stopSpeechRecognition();
  _callbacks = null;
  _turnMeta = null;
  _phase = AUTO_ADVANCE_PHASE.IDLE;
  _hideDebugPanel();
}

export function isAutoAdvanceActive() {
  return _active && _enabled();
}

export function cancelAutoAdvancePopup() {
  if (_bannerActionInFlight) return;
  if (_isAnswerCapturedPhase()) {
    _cancelConfirmation();
    return;
  }
  if (_isNoResponseWarningPhase()) {
    _resumeFromNoResponseWarning();
    return;
  }
  _cancelConfirmation();
}

export function confirmAutoAdvanceNow() {
  if (!_active || _bannerActionInFlight) return;

  _bannerActionInFlight = true;
  _setBannerButtonsLoading(true);
  _clearTimers();
  _confirmationActive = false;

  if (_isNoResponseWarningPhase()) {
    if (_hasCapturableAnswer()) {
      _setPhase(AUTO_ADVANCE_PHASE.SUBMITTING, "Saving your answer…");
      void _triggerAutoSubmit("manual_skip_with_answer", { partial_answer: true });
      return;
    }
    _setPhase(AUTO_ADVANCE_PHASE.SKIPPED, "Skipping question…");
    void _triggerAutoSkip("Candidate skipped — no response");
    return;
  }

  _setPhase(AUTO_ADVANCE_PHASE.SUBMITTING, "Submitting your answer…");
  _triggerAutoSubmit("manual_immediate");
}

/** @deprecated Use cancelAutoAdvancePopup */
export function cancelAutoAdvanceConfirmation() {
  cancelAutoAdvancePopup();
}

/** @deprecated Use confirmAutoAdvanceNow */
export function submitAutoAdvanceImmediately() {
  confirmAutoAdvanceNow();
}

/**
 * External activity hook (candidate recorder transcript, mic open, etc.).
 * Cancels no-response countdown immediately — works in manual and dynamic modes.
 */
export function notifyAutoAdvanceAnswerActivity(source, detail = {}) {
  if (!_active) return;
  if (!_skipCountdownActive && !_isNoResponseWarningPhase() && !_noResponseHandled) return;

  const text = String(detail.text || _interimTranscript || "").trim();
  if (source === "transcript" && _wordCount(text) > 0) {
    _interimTranscript = text;
    if (_callbacks?.onInterimTranscript) _callbacks.onInterimTranscript(_interimTranscript);
    _resumeAnswerDuringWarning("external_transcript", null, Date.now());
  }
}

export function initAutoAdvanceBannerUi() {
  if (_bannerUiBound) return;
  _bannerUiBound = true;

  const continueBtn = document.getElementById("autoAdvanceContinueBtn");
  const confirmBtn = document.getElementById("autoAdvanceConfirmBtn");

  continueBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    cancelAutoAdvancePopup();
  });

  confirmBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    confirmAutoAdvanceNow();
  });
}

/**
 * Begin smart auto-advance for the current question turn.
 */
export function beginAutoAdvanceTurn(opts = {}) {
  stopAutoAdvanceTurn();
  if (!_enabled() || opts.isWarmup) return;

  const turnSeq = ++_turnSeq;
  _active = true;
  _callbacks = opts;
  _turnMeta = {
    questionIndex: opts.questionIndex,
    questionText: opts.questionText,
  };
  _calibrated = false;
  _calibrationSamples = [];
  _calibrationUntil = Date.now() + CALIBRATION_MS;
  _turnStartTs = Date.now();
  _warningCount = 0;
  _resetSpeechTracking();
  _phase = AUTO_ADVANCE_PHASE.WAITING_FOR_RESPONSE;

  _ensureDebugPanel();
  _vadEventLog("Waiting for response", {
    questionIndex: opts.questionIndex,
    timeoutSec: _cfg().initial_response_wait_sec || 5,
  });
  _vadLog("Waiting Timer started", {
    timeoutSec: _cfg().initial_response_wait_sec || 5,
  });

  _setPhase(AUTO_ADVANCE_PHASE.WAITING_FOR_RESPONSE, "Waiting for your response…");
  _logInterview("Waiting for response started", {
    waitSec: _cfg().initial_response_wait_sec || 5,
  });
  _startResponseTimers();

  const stream = opts.audioStream;
  if (!stream || !stream.getAudioTracks?.().length) {
    console.warn("[INTERVIEW] No audio stream — hard silence timers still active");
    return;
  }

  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === "suspended") {
      void _audioCtx.resume().catch(() => {});
    }
    const source = _audioCtx.createMediaStreamSource(stream);
    _analyser = _audioCtx.createAnalyser();
    _analyser.fftSize = 2048;
    _analyser.smoothingTimeConstant = 0.55;
    source.connect(_analyser);
    _timeBuf = new Uint8Array(_analyser.fftSize);
    _freqBuf = new Uint8Array(_analyser.frequencyBinCount);
    _vadHandle = requestAnimationFrame(_vadLoop);
    _startSpeechRecognition();
    void startSileroVad(stream, {
      onSpeechStart: () => {
        _sileroActive = true;
        const now = Date.now();
        if (!_sileroSpeechSince) _sileroSpeechSince = now;
        if (_skipCountdownActive || _isNoResponseWarningPhase()) {
          if (!_warningCountdownSpeechSince) _warningCountdownSpeechSince = now;
          return;
        }
        // Do not confirm speech from Silero alone during initial wait — FFT must agree.
      },
      onSpeechEnd: () => {
        _sileroActive = false;
        _sileroSpeechSince = 0;
        _vadEventLog("Silence detected", { source: "silero" });
      },
    });
  } catch (err) {
    console.warn("[auto-advance] VAD init failed", err);
  }

  return () => {
    if (turnSeq === _turnSeq) stopAutoAdvanceTurn();
  };
}
