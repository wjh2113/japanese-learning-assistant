import { loadHistory, loadVocab, removeVocab } from '../config.js';

export async function renderHistoryPanel(container) {
  const history = await loadHistory();
  const vocab = await loadVocab();

  container.innerHTML = `
    <div class="grid md:grid-cols-2 gap-6">
      <div>
        <h3 class="font-semibold mb-3">学习历史</h3>
        <div class="max-h-64 overflow-y-auto space-y-2">
          ${history.length === 0 ? '<p class="text-sm text-slate-400">暂无记录</p>' : history.map((h) => `
            <div class="p-2 bg-slate-50 rounded text-sm">
              <span class="inline-block px-2 py-0.5 bg-sky-100 text-sky-700 rounded text-xs mr-2">${h.level}</span>
              <span class="font-medium">${typeLabel(h.type)}</span>
              <span class="text-slate-500"> · ${h.title || ''} · ${new Date(h.timestamp).toLocaleString()}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div>
        <h3 class="font-semibold mb-3">收藏单词</h3>
        <div class="max-h-64 overflow-y-auto space-y-2">
          ${vocab.length === 0 ? '<p class="text-sm text-slate-400">暂无收藏</p>' : vocab.map((v) => `
            <div class="p-2 bg-slate-50 rounded text-sm flex justify-between items-center">
              <div>
                <span class="font-medium">${v.word}</span>
                <span class="text-slate-500"> ${v.reading} — ${v.meaning}</span>
              </div>
              <button data-word="${v.word}" class="remove-vocab text-rose-500 hover:text-rose-700 active:text-rose-800 px-2">删除</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.remove-vocab').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await removeVocab(btn.dataset.word);
      await renderHistoryPanel(container);
    });
  });
}

function typeLabel(type) {
  const map = {
    listening: '听力',
    speaking: '口语',
    reading: '阅读',
    writing: '写作',
    'writing-corrected': '写作批改',
  };
  return map[type] || type;
}
