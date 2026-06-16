/**
 * Silero VAD via @ricky0123/vad-web (WASM).
 * Human-speech detector — ignores keyboard clicks, fan/AC hum better than energy-only VAD.
 */

const VAD_WEB_VERSION = "0.0.22";
const ONNX_VERSION = "1.14.0";

let _micVad = null;
let _speechActive = false;
let _initPromise = null;
let _callbacks = null;

function _assetPaths() {
  const onnxBase = (typeof window !== "undefined" && window.KARNEX_VAD_ONNX_BASE) || "";
  const vadBase = (typeof window !== "undefined" && window.KARNEX_VAD_ASSET_BASE) || "";
  if (onnxBase && vadBase) {
    return { onnxWASMBasePath: onnxBase, baseAssetPath: vadBase };
  }
  return {
    onnxWASMBasePath: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_VERSION}/dist/`,
    baseAssetPath: `https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@${VAD_WEB_VERSION}/dist/`,
  };
}

async function _loadMicVadClass() {
  try {
    const mod = await import("@ricky0123/vad-web");
    return mod.MicVAD;
  } catch (_) {
    const mod = await import(
      /* webpackIgnore: true */
      `https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@${VAD_WEB_VERSION}/dist/index.js`
    );
    return mod.MicVAD;
  }
}

export function isSileroSpeechActive() {
  return _speechActive;
}

export function sileroVadAvailable() {
  return typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext);
}

/**
 * @param {MediaStream} stream - live microphone stream (cloned track ok)
 * @param {{ onSpeechStart?: () => void, onSpeechEnd?: () => void }} callbacks
 */
export async function startSileroVad(stream, callbacks = {}) {
  await stopSileroVad();
  if (!stream || !stream.getAudioTracks?.().length || !sileroVadAvailable()) {
    return false;
  }
  _callbacks = callbacks;
  _initPromise = _initPromise || _loadMicVadClass();
  try {
    const MicVAD = await _initPromise;
    const paths = _assetPaths();
    _micVad = await MicVAD.new({
      stream,
      onnxWASMBasePath: paths.onnxWASMBasePath,
      baseAssetPath: paths.baseAssetPath,
      positiveSpeechThreshold: 0.72,
      negativeSpeechThreshold: 0.55,
      minSpeechFrames: 3,
      preSpeechPadFrames: 2,
      redemptionFrames: 10,
      onSpeechStart: () => {
        _speechActive = true;
        _callbacks?.onSpeechStart?.();
      },
      onSpeechEnd: () => {
        _speechActive = false;
        _callbacks?.onSpeechEnd?.();
      },
      onVADMisfire: () => {
        /* short false positive — keep state unless we were never confirmed */
      },
    });
    await _micVad.start();
    return true;
  } catch (err) {
    console.warn(
      "[VAD] Silero init failed — FFT fallback only. Self-host WASM via window.KARNEX_VAD_ONNX_BASE / KARNEX_VAD_ASSET_BASE.",
      err
    );
    _micVad = null;
    _speechActive = false;
    return false;
  }
}

export async function stopSileroVad() {
  _speechActive = false;
  _callbacks = null;
  if (_micVad) {
    try {
      _micVad.pause();
      _micVad.destroy();
    } catch (_) {
      /* ignore */
    }
    _micVad = null;
  }
}
