import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const CONFIG_KEY = 'japanese_learning_config';
const HISTORY_KEY = 'japanese_learning_history';
const VOCAB_KEY = 'japanese_learning_vocab';

const DEFAULT_CONFIG = {
  apiBase: 'https://api.openai.com/v1',
  apiKey: '',
  apiModel: 'gpt-4o-mini',
  defaultLevel: 'N5',
};

const isNative = Capacitor.isNativePlatform();

async function nativeGet(key) {
  if (!isNative) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  const { value } = await Preferences.get({ key });
  return value;
}

async function nativeSet(key, value) {
  if (!isNative) {
    try { localStorage.setItem(key, value); } catch {}
    return;
  }
  await Preferences.set({ key, value });
}

export async function loadConfig() {
  try {
    const saved = await nativeGet(CONFIG_KEY);
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config) {
  await nativeSet(CONFIG_KEY, JSON.stringify(config));
}

export async function loadHistory() {
  try {
    const saved = await nativeGet(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export async function addHistory(entry) {
  const history = await loadHistory();
  history.unshift({ ...entry, timestamp: Date.now() });
  await nativeSet(HISTORY_KEY, JSON.stringify(history.slice(0, 200)));
}

export async function loadVocab() {
  try {
    const saved = await nativeGet(VOCAB_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export async function addVocab(word) {
  const vocab = await loadVocab();
  if (!vocab.some((v) => v.word === word.word)) {
    vocab.unshift(word);
    await nativeSet(VOCAB_KEY, JSON.stringify(vocab.slice(0, 500)));
  }
}

export async function removeVocab(word) {
  const vocab = (await loadVocab()).filter((v) => v.word !== word);
  await nativeSet(VOCAB_KEY, JSON.stringify(vocab));
}

export { DEFAULT_CONFIG };
