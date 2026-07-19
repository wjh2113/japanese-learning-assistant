import { loadConfig } from './config.js';

export async function getConfig() {
  return loadConfig();
}

export async function isConfigured() {
  const cfg = await loadConfig();
  return !!(cfg.apiKey && cfg.apiBase);
}

export async function chat(messages, options = {}) {
  const cfg = await loadConfig();
  if (!cfg.apiKey || !cfg.apiBase) {
    throw new Error('请先配置 API Base URL 和 API Key');
  }

  const url = cfg.apiBase.replace(/\/$/, '') + '/chat/completions';
  const body = {
    model: cfg.apiModel || 'gpt-4o-mini',
    messages,
    temperature: options.temperature ?? 0.7,
    ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('网络请求失败：' + (e.message || '无法连接到 API 服务器'));
  }

  if (!res.ok) {
    let err = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      err = data.error?.message || JSON.stringify(data);
    } catch {
      err = await res.text();
    }
    throw new Error(err);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function chatJson(messages, options = {}) {
  const content = await chat(messages, { ...options, jsonMode: true });
  try {
    return JSON.parse(content);
  } catch (e) {
    // Try extracting JSON from markdown code fence
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {}
    }
    throw new Error('AI 返回不是有效 JSON：' + content.slice(0, 200));
  }
}

export async function testConnection() {
  const cfg = await loadConfig();
  if (!cfg.apiKey || !cfg.apiBase) return { ok: false, error: '缺少 API 配置' };
  try {
    const content = await chat([
      { role: 'user', content: 'Say "ok" only.' },
    ], { temperature: 0 });
    return { ok: content.toLowerCase().includes('ok'), error: '' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function levelDescription(level) {
  const map = {
    N5: '入门：基础单词、简单句型',
    N4: '初级：日常会话、基本语法',
    N3: '中级：较复杂文章、职场生活',
    N2: '中高级：新闻评论、抽象表达',
    N1: '高级：学术文章、 nuanced 表达',
  };
  return map[level] || '';
}
