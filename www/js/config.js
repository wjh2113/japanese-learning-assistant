const CONFIG_KEY = 'japanese_learning_config';
const HISTORY_KEY = 'japanese_learning_history';
const VOCAB_KEY = 'japanese_learning_vocab';

const DEFAULT_CONFIG = {
  apiBase: 'https://api.deepseek.com/v1',
  apiKey: '',
  apiModel: 'deepseek-v4-pro',
  defaultLevel: 'N5',
};

let isNative = false;
let preferencesModule = null;

function detectNative() {
  if (typeof window === 'undefined') return false;
  try {
    const cap = window.Capacitor;
    return !!(cap && cap.isNativePlatform?.());
  } catch {
    return false;
  }
}

async function ensurePreferences() {
  if (!detectNative()) return null;
  if (preferencesModule) return preferencesModule;
  try {
    preferencesModule = await import('@capacitor/preferences');
    isNative = true;
    return preferencesModule;
  } catch (e) {
    console.warn('Capacitor Preferences not available, using localStorage', e);
    isNative = false;
    return null;
  }
}

async function nativeGet(key) {
  const prefs = await ensurePreferences();
  if (!prefs) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  const { value } = await prefs.Preferences.get({ key });
  return value;
}

async function nativeSet(key, value) {
  const prefs = await ensurePreferences();
  if (!prefs) {
    try { localStorage.setItem(key, value); } catch {}
    return;
  }
  await prefs.Preferences.set({ key, value });
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
