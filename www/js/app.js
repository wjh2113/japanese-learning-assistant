import { loadConfig, saveConfig, DEFAULT_CONFIG } from './config.js';
import { isConfigured, testConnection } from './api.js';
import { loadVoices } from './speech.js';
import listening from './modules/listening.js';
import speaking from './modules/speaking.js';
import reading from './modules/reading.js';
import writing from './modules/writing.js';

const modules = { listening, speaking, reading, writing };
let currentTab = 'listening';
let configCache = null;
let initialized = false;

function getElements() {
  return {
    moduleContent: document.getElementById('moduleContent'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    settingsForm: document.getElementById('settingsForm'),
    apiBase: document.getElementById('apiBase'),
    apiKey: document.getElementById('apiKey'),
    apiModel: document.getElementById('apiModel'),
    customApiModel: document.getElementById('customApiModel'),
    defaultLevel: document.getElementById('defaultLevel'),
    testConnection: document.getElementById('testConnection'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    levelBadge: document.getElementById('levelBadge'),
  };
}

export async function getCachedConfig() {
  if (!configCache) configCache = await loadConfig();
  return configCache;
}

export function invalidateConfigCache() {
  configCache = null;
}

export function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  overlay.classList.toggle('hidden', !show);
  overlay.classList.toggle('flex', show);
}

export function setLoadingText(text) {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  const p = overlay.querySelector('p');
  if (p) p.textContent = text;
}

export function switchTab(tab) {
  if (!modules[tab]) {
    console.error('Unknown tab:', tab);
    return;
  }
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('tab-active', active);
  });
  renderModule();
}

function renderModule() {
  const content = document.getElementById('moduleContent');
  if (!content) {
    console.error('moduleContent not found');
    return;
  }
  const mod = modules[currentTab];
  content.innerHTML = '';
  content.classList.remove('fade-in');
  void content.offsetWidth;
  content.classList.add('fade-in');

  try {
    const result = mod.render(content);
    if (result && typeof result.then === 'function') {
      result.catch((e) => showFatalError('模块渲染失败：' + e.message));
    }
  } catch (e) {
    console.error('renderModule error:', e);
    showFatalError('模块渲染失败：' + e.message);
  }
}

function getSelectedModel(els) {
  const select = els.apiModel;
  if (!select) return DEFAULT_CONFIG.apiModel;
  if (select.value === 'custom') {
    return (els.customApiModel?.value || '').trim() || DEFAULT_CONFIG.apiModel;
  }
  return select.value;
}

async function openSettings() {
  const cfg = await loadConfig();
  const els = getElements();
  if (els.apiBase) els.apiBase.value = cfg.apiBase || DEFAULT_CONFIG.apiBase;
  if (els.apiKey) els.apiKey.value = cfg.apiKey || '';

  if (els.apiModel) {
    const knownModels = ['deepseek-v4-pro', 'deepseek-v4', 'deepseek-chat', 'deepseek-reasoner'];
    if (knownModels.includes(cfg.apiModel)) {
      els.apiModel.value = cfg.apiModel;
      if (els.customApiModel) els.customApiModel.classList.add('hidden');
    } else {
      els.apiModel.value = 'custom';
      if (els.customApiModel) {
        els.customApiModel.value = cfg.apiModel || '';
        els.customApiModel.classList.remove('hidden');
      }
    }
  }

  if (els.defaultLevel) els.defaultLevel.value = cfg.defaultLevel || 'N5';
  if (els.settingsModal) {
    els.settingsModal.classList.remove('hidden');
    els.settingsModal.classList.add('flex');
  }
}

function closeSettings() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function saveSettings(e) {
  e.preventDefault();
  const els = getElements();
  const cfg = {
    apiBase: (els.apiBase?.value || '').trim() || DEFAULT_CONFIG.apiBase,
    apiKey: (els.apiKey?.value || '').trim(),
    apiModel: getSelectedModel(els),
    defaultLevel: els.defaultLevel?.value || 'N5',
  };
  await saveConfig(cfg);
  invalidateConfigCache();
  await updateLevelBadge();
  closeSettings();
  renderModule();
  showToast('设置已保存');
}

async function handleTestConnection() {
  const els = getElements();
  const cfg = {
    apiBase: (els.apiBase?.value || '').trim() || DEFAULT_CONFIG.apiBase,
    apiKey: (els.apiKey?.value || '').trim(),
    apiModel: getSelectedModel(els),
    defaultLevel: els.defaultLevel?.value || 'N5',
  };
  await saveConfig(cfg);
  invalidateConfigCache();
  showLoading(true);
  setLoadingText('正在测试连接…');
  try {
    const result = await testConnection();
    showToast(result.ok ? '连接成功' : `连接失败：${result.error}`);
  } finally {
    showLoading(false);
    setLoadingText('AI 思考中…');
  }
}

async function updateLevelBadge() {
  const cfg = await loadConfig();
  const badge = document.getElementById('levelBadge');
  if (badge) badge.textContent = cfg.defaultLevel || 'N5';
}

function isNativePlatform() {
  if (typeof window === 'undefined') return false;
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform?.());
  } catch {
    return false;
  }
}

function showToast(message) {
  if (isNativePlatform()) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm z-50 fade-in';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  } else {
    alert(message);
  }
}

function showFatalError(message) {
  const content = document.getElementById('moduleContent');
  if (!content) return;
  content.innerHTML = `
    <div class="p-4 bg-rose-50 text-rose-700 rounded-lg">
      <p class="font-semibold">应用初始化失败</p>
      <p class="text-sm">${message}</p>
      <p class="text-sm mt-2">请检查浏览器控制台（F12）获取详细错误信息。若使用 file:// 协议打开，请改用本地 HTTP 服务器访问。 </p>
    </div>
  `;
}

async function initBackButton() {
  if (!isNativePlatform()) return;
  try {
    const { App } = await import('@capacitor/app');
    await App.addListener('backButton', () => {
      const modal = document.getElementById('settingsModal');
      if (modal && !modal.classList.contains('hidden')) {
        closeSettings();
      } else {
        App.exitApp();
      }
    });
  } catch (e) {
    console.warn('Capacitor App plugin not available', e);
  }
}

async function init() {
  if (initialized) return;
  initialized = true;

  console.log('[App] Initializing...');
  loadVoices();

  const els = getElements();
  if (!els.moduleContent) throw new Error('页面结构不完整，缺少 moduleContent');

  els.tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  if (els.settingsBtn) els.settingsBtn.addEventListener('click', openSettings);
  if (els.closeSettings) els.closeSettings.addEventListener('click', closeSettings);
  if (els.settingsForm) els.settingsForm.addEventListener('submit', saveSettings);
  if (els.testConnection) els.testConnection.addEventListener('click', handleTestConnection);

  if (els.settingsModal) {
    els.settingsModal.addEventListener('click', (e) => {
      if (e.target === els.settingsModal) closeSettings();
    });
  }

  await updateLevelBadge();
  await initBackButton();

  const configured = await isConfigured();
  console.log('[App] Configured:', configured);
  if (!configured) {
    openSettings();
  }

  renderModule();
  console.log('[App] Rendered default tab:', currentTab);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init().catch((e) => {
    console.error('App init failed', e);
    showFatalError(e.message);
  }));
} else {
  init().catch((e) => {
    console.error('App init failed', e);
    showFatalError(e.message);
  });
}
