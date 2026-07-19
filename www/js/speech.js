import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

const isNative = Capacitor.isNativePlatform();
let ttsPromise = null;
let recognitionListener = null;

export async function speak(text, rate = 1.0) {
  if (!text) return;

  if (isNative) {
    try {
      await stopSpeaking();
      const p = TextToSpeech.speak({
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
  if (isNative) {
    try { await TextToSpeech.stop(); } catch {}
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
  if (isNative) {
    const available = await SpeechRecognition.available();
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

export function removeRecognitionListener() {
  if (recognitionListener) {
    SpeechRecognition.removeAllListeners();
    recognitionListener = null;
  }
}

export function addRecognitionListener(event, callback) {
  if (!isNative) return;
  recognitionListener = true;
  SpeechRecognition.addListener(event, callback);
}

export async function requestSpeechPermissions() {
  if (!isNative) return { microphone: 'granted' };
  return SpeechRecognition.requestPermissions();
}

export async function stopRecognition() {
  if (isNative) {
    try { await SpeechRecognition.stop(); } catch {}
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
