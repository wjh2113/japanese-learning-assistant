let isNative = false;
let ttsPromise = null;
let recognitionListener = null;
let nativeModules = null;

function detectNative() {
  if (typeof window === 'undefined') return false;
  try {
    const cap = window.Capacitor;
    return !!(cap && cap.isNativePlatform?.());
  } catch {
    return false;
  }
}

async function ensureNativeModules() {
  if (!detectNative()) return null;
  if (nativeModules) return nativeModules;
  try {
    const [tts, stt] = await Promise.all([
      import('@capacitor-community/text-to-speech'),
      import('@capacitor-community/speech-recognition'),
    ]);
    nativeModules = { TextToSpeech: tts.TextToSpeech, SpeechRecognition: stt.SpeechRecognition };
    isNative = true;
    return nativeModules;
  } catch (e) {
    console.warn('Capacitor speech modules not available, using Web Speech API', e);
    isNative = false;
    return null;
  }
}

export async function speak(text, rate = 1.0) {
  if (!text) return;

  const mods = await ensureNativeModules();
  if (mods) {
    try {
      await stopSpeaking();
      const p = mods.TextToSpeech.speak({
        text,
        lang: 'ja-JP',
        rate,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });
      ttsPromise = p;
      await p;
    } catch (e) {
      console.warn('Native TTS failed, falling back to web TTS', e);
      ttsPromise = null;
      return webSpeak(text, rate);
    } finally {
      ttsPromise = null;
    }
    return;
  }

  return webSpeak(text, rate);
}

function webSpeak(text, rate) {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('浏览器不支持语音合成'));
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP';
    utter.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find((v) => v.lang === 'ja-JP' || v.lang.startsWith('ja'));
    if (jaVoice) utter.voice = jaVoice;
    utter.onend = () => resolve();
    utter.onerror = (e) => reject(e.error ? new Error(e.error) : new Error('语音播放失败'));
    window.speechSynthesis.speak(utter);
  });
}

export async function stopSpeaking() {
  const mods = await ensureNativeModules();
  if (mods) {
    try { await mods.TextToSpeech.stop(); } catch {}
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  ttsPromise = null;
}

export function isSpeaking() {
  if (isNative) return ttsPromise !== null;
  return window.speechSynthesis ? window.speechSynthesis.speaking : false;
}

export function getVoices() {
  return window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
}

export async function startRecognition(options = {}) {
  const mods = await ensureNativeModules();
  if (mods) {
    const available = await mods.SpeechRecognition.available();
    if (!available.available) {
      throw new Error('设备不支持语音识别');
    }
    const opts = {
      language: options.lang || 'ja-JP',
      maxResults: 1,
      prompt: '',
      partialResults: options.interimResults ?? false,
      popup: false,
    };
    return { native: true, options: opts };
  }

  const SpeechRecognitionWeb = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionWeb) {
    throw new Error('浏览器不支持语音识别，请使用 Chrome/Edge/Safari');
  }
  const rec = new SpeechRecognitionWeb();
  rec.lang = options.lang || 'ja-JP';
  rec.continuous = options.continuous ?? false;
  rec.interimResults = options.interimResults ?? false;
  rec.maxAlternatives = 1;
  return { native: false, recognition: rec };
}

export async function removeRecognitionListener() {
  const mods = await ensureNativeModules();
  if (recognitionListener && mods) {
    mods.SpeechRecognition.removeAllListeners();
    recognitionListener = null;
  }
}

export async function addRecognitionListener(event, callback) {
  const mods = await ensureNativeModules();
  if (!mods) return;
  recognitionListener = true;
  mods.SpeechRecognition.addListener(event, callback);
}

export async function requestSpeechPermissions() {
  const mods = await ensureNativeModules();
  if (!mods) return { microphone: 'granted' };
  return mods.SpeechRecognition.requestPermissions();
}

export async function stopRecognition() {
  const mods = await ensureNativeModules();
  if (mods) {
    try { await mods.SpeechRecognition.stop(); } catch {}
  }
}

export function loadVoices() {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve([]);
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      resolve(voices);
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
  });
}
