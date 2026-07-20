let isNative = false;
let ttsPromise = null;
let recognitionListener = null;
let nativeModules = null;
let voicesReady = false;

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

async function ensureWebVoices() {
  if (voicesReady) return;
  if (!window.speechSynthesis) {
    throw new Error('浏览器不支持语音合成');
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    voicesReady = true;
    return;
  }
  await new Promise((resolve) => {
    window.speechSynthesis.onvoiceschanged = () => {
      voicesReady = true;
      resolve();
    };
    setTimeout(() => {
      voicesReady = true;
      resolve();
    }, 1000);
  });
}

function findJapaneseVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  return voices.find((v) => v.lang === 'ja-JP' || v.lang?.startsWith('ja'));
}

function webSpeak(text, rate) {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('浏览器不支持语音合成'));
      return;
    }

    // Some browsers (especially mobile) need a user gesture; resume if paused
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP';
    utter.rate = rate;

    const jaVoice = findJapaneseVoice();
    if (jaVoice) {
      utter.voice = jaVoice;
    } else {
      console.warn('未找到日语语音，将使用浏览器默认语音朗读');
    }

    let resolved = false;
    utter.onend = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };
    utter.onerror = (e) => {
      if (resolved) return;
      resolved = true;
      if (!jaVoice) {
        reject(new Error('语音播放失败：未找到日语语音包，请安装系统日语语音或更换浏览器'));
      } else {
        reject(new Error(e.error ? `语音播放失败：${e.error}` : '语音播放失败'));
      }
    };

    // Some browsers (e.g. Chrome on Windows) stop speaking after ~15s; chunk long text
    if (text.length > 200) {
      speakInChunks(text, rate, resolve, reject);
      return;
    }

    window.speechSynthesis.speak(utter);
  });
}

function speakInChunks(text, rate, resolve, reject) {
  // Split by sentence-ending punctuation to keep natural pauses
  const chunks = text.split(/([。！？.!?\n]+)/).filter(Boolean);
  const sentences = [];
  for (let i = 0; i < chunks.length; i += 2) {
    sentences.push((chunks[i] || '') + (chunks[i + 1] || ''));
  }

  let index = 0;
  function next() {
    if (index >= sentences.length) {
      resolve();
      return;
    }
    const chunk = sentences[index++];
    if (!chunk.trim()) {
      next();
      return;
    }
    const utter = new SpeechSynthesisUtterance(chunk);
    utter.lang = 'ja-JP';
    utter.rate = rate;
    const jaVoice = findJapaneseVoice();
    if (jaVoice) utter.voice = jaVoice;
    utter.onend = next;
    utter.onerror = (e) => reject(new Error(e.error ? `语音播放失败：${e.error}` : '语音播放失败'));
    window.speechSynthesis.speak(utter);
  }
  next();
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

export async function loadVoices() {
  try {
    await ensureWebVoices();
  } catch (e) {
    console.warn('Load voices failed:', e);
  }
}

export function hasJapaneseVoice() {
  return !!findJapaneseVoice();
}
