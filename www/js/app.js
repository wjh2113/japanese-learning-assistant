import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { loadConfig, saveConfig, DEFAULT_CONFIG } from './config.js';
import { isConfigured, testConnection } from './api.js';
import { loadVoices, requestSpeechPermissions } from './speech.js';
import listening from './modules/listening.js';
import speaking from './modules/speaking.js';
import reading from './modules/reading.js';
import writing from './modules/writing.js';

const modules = { listening, speaking, reading, writing };
let currentTab = 'listening';
let configCache = null;

const els = {
  moduleContent: document.getElementById('moduleContent'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeSettings: document.getElementById('closeSettings'),
  settingsForm: document.getElementById('settingsForm'),
  apiBase: document.getElementById('apiBase'),
  apiKey: document.getElementById('apiKey'),
  apiModel: document.getElementById('apiModel'),
  defaultLevel: document.getElementById('defaultLevel'),
  testConnection: document.getElementById('testConnection'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  levelBadge: document.getElementById('levelBadge'),
};

export async function getCachedConfig() {
  if (!configCache) configCache = await loadConfig();
  return configCache;
}

export function invalidateConfigCache() {
  configCache = null;
}

export function showLoading(show) {
  els.loadingOverlay.classList.toggle('hidden', !show);
  els.loadingOverlay.classList.toggle('flex', show);
}

export function setLoadingText(text) {
  els.loadingOverlay.querySelector('p').textContent = text;
}

export function switchTab(tab) {
  currentTab = tab;
  els.tabBtns.forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('tab-active', active);
  });
  renderModule();
}

function renderModule() {
  const mod = modules[currentTab];
  els.moduleContent.innerHTML = '';
  els.moduleContent.classList.remove('fade-in');
  void els.moduleContent.offsetWidth;
  els.moduleContent.classList.add('fade-in');
  mod.render(els.moduleContent);
}

async function openSettings() {
  const cfg = await loadConfig();
  els.apiBase.value = cfg.apiBase || '';
  els.apiKey.value = cfg.apiKey || '';
  els.apiModel.value = cfg.apiModel || '';
  els.defaultLevel.value = cfg.defaultLevel || 'N5';
  els.settingsModal.classList.remove('hidden');
  els.settingsModal.classList.add('flex');
}

function closeSettings() {
  els.settingsModal.classList.add('hidden');
  els.settingsModal.classList.remove('flex');
}

async function saveSettings(e) {
  e.preventDefault();
  const cfg = {
    apiBase: els.apiBase.value.trim() || DEFAULT_CONFIG.apiBase,
    apiKey: els.apiKey.value.trim(),
    apiModel: els.apiModel.value.trim() || DEFAULT_CONFIG.apiModel,
    defaultLevel: els.defaultLevel.value,
  };
  await saveConfig(cfg);
  invalidateConfigCache();
  await updateLevelBadge();
  closeSettings();
  renderModule();
  showToast('设置已保存');
}

async function handleTestConnection() {
  const cfg = {
    apiBase: els.apiBase.value.trim() || DEFAULT_CONFIG.apiBase,
    apiKey: els.apiKey.value.trim(),
    apiModel: els.apiModel.value.trim() || DEFAULT_CONFIG.apiModel,
    defaultLevel: els.defaultLevel.value,
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
  els.levelBadge.textContent = cfg.defaultLevel || 'N5';
}

function showToast(message) {
  if (Capacitor.isNativePlatform()) {
    // Use a simple in-app toast
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm z-50 fade-in';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  } else {
    alert(message);
  }
}

async function init() {
  loadVoices();
  if (Capacitor.isNativePlatform()) {
    try {
      await requestSpeechPermissions();
    } catch (e) {
      console.warn('Speech permission request failed', e);
    }
  }
  await updateLevelBadge();

  els.tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  els.settingsBtn.addEventListener('click', openSettings);
  els.closeSettings.addEventListener('click', closeSettings);
  els.settingsForm.addEventListener('submit', saveSettings);
  els.testConnection.addEventListener('click', handleTestConnection);

  els.settingsModal.addEventListener('click', (e) => {
    if (e.target === els.settingsModal) closeSettings();
  });

  if (Capacitor.isNativePlatform()) {
    App.addListener('backButton', () => {
      if (!els.settingsModal.classList.contains('hidden')) {
        closeSettings();
      } else {
        App.exitApp();
      }
    });
  }

  const configured = await isConfigured();
  if (!configured) {
    openSettings();
  }

  renderModule();
}

init();
