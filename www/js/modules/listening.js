import { chatJson } from '../api.js';
import { loadConfig, addHistory } from '../config.js';
import { speak, stopSpeaking } from '../speech.js';
import { showLoading, setLoadingText } from '../app.js';
import { renderLevelSelector } from '../components/levelSelector.js';

let state = {
  level: 'N5',
  topic: '',
  material: null,
  playbackRate: 1,
  showingOriginal: true,
};

const topics = [
  '日常问候', '购物', '餐厅点餐', '问路', '天气', '兴趣爱好', '旅行', '工作', '学校生活', '家庭',
];

export default { render };

async function render(container) {
  const cfg = await loadConfig();
  state.level = cfg.defaultLevel;

  container.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-wrap items-end gap-3 md:gap-4">
        ${renderLevelSelector(state.level, (lvl) => { state.level = lvl; })}
        <div class="flex-1 min-w-[160px]">
          <label class="block text-sm font-medium mb-1">主题</label>
          <select id="listenTopic" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
            <option value="">随机主题</option>
            ${topics.map((t) => `<option value="${t}" ${state.topic === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <button id="genListen" class="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 active:bg-sky-800 transition">生成听力材料</button>
      </div>

      <div id="listenError" class="hidden p-3 bg-rose-50 text-rose-700 rounded-lg text-sm"></div>

      <div id="listenResult" class="hidden space-y-4">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h3 id="listenTitle" class="text-lg font-bold"></h3>
          <div class="flex gap-2">
            <button id="toggleOriginal" class="px-3 py-1.5 text-sm border rounded-lg hover:bg-slate-100 active:bg-slate-200">隐藏原文</button>
            <button id="playListen" class="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:bg-emerald-800">▶️ 播放</button>
          </div>
        </div>

        <div class="flex items-center gap-3 text-sm">
          <label>语速：</label>
          <input type="range" id="rateSlider" min="0.5" max="1.5" step="0.25" value="1" class="w-32">
          <span id="rateValue">1.0x</span>
        </div>

        <div id="listenText" class="p-4 bg-slate-50 rounded-lg leading-7 text-lg ruby-text min-h-[120px]"></div>

        <div id="listenTrans" class="p-4 bg-slate-50 rounded-lg text-slate-600"></div>

        <div>
          <h4 class="font-semibold mb-2">重点词汇</h4>
          <div id="listenVocab" class="flex flex-wrap gap-2"></div>
        </div>

        <div class="border-t pt-4">
          <label class="block text-sm font-medium mb-1">听写练习：写下你听到的内容</label>
          <textarea id="dictationInput" rows="3" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="请用日语输入..."></textarea>
          <button id="checkDictation" class="mt-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 active:bg-sky-800 transition">提交听写</button>
          <div id="dictationFeedback" class="mt-3 hidden"></div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#genListen').addEventListener('click', generateMaterial);
  container.querySelector('#listenTopic').addEventListener('change', (e) => {
    state.topic = e.target.value;
  });

  const res = container.querySelector('#listenResult');
  if (state.material) renderMaterial(res);
}

function showError(message) {
  const box = document.querySelector('#listenError');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('hidden');
}

function hideError() {
  const box = document.querySelector('#listenError');
  if (!box) return;
  box.classList.add('hidden');
}

async function generateMaterial() {
  const cfg = await loadConfig();
  state.level = document.querySelector('#levelSelect')?.value || cfg.defaultLevel;
  state.topic = document.querySelector('#listenTopic')?.value || '';

  const topicText = state.topic || topics[Math.floor(Math.random() * topics.length)];
  const prompt = `为 JLPT ${state.level} 学习者生成一段日语听力练习材料。\n` +
    `主题：${topicText}\n` +
    `要求：\n` +
    `1. 长度适合听力练习（N5 约 80-120 词，N1 约 250-350 词）。\n` +
    `2. 使用符合等级的词汇和语法。\n` +
    `3. 内容有趣、自然。\n` +
    `4. 返回严格 JSON：{"title":"标题","japanese":"日文原文（可含振假名 ruby 标记）","translation":"中文翻译","vocabulary":[{"word":"单词","reading":"读音","meaning":"中文释义"}]}。`;

  hideError();
  showLoading(true);
  setLoadingText('正在生成听力材料…');
  try {
    const material = await chatJson([
      { role: 'system', content: '你是专业的日语教师，擅长生成适合各 JLPT 等级的学习材料。' },
      { role: 'user', content: prompt },
    ]);
    state.material = material;
    state.showingOriginal = true;
    const res = document.querySelector('#listenResult');
    renderMaterial(res);
    res.classList.remove('hidden');
    await addHistory({ type: 'listening', title: material.title, level: state.level });
  } catch (e) {
    showError('生成失败：' + e.message);
  } finally {
    showLoading(false);
    setLoadingText('AI 思考中…');
  }
}

function renderMaterial(container) {
  if (!container) return;
  container.classList.remove('hidden');
  container.querySelector('#listenTitle').textContent = state.material.title || '';
  container.querySelector('#listenText').innerHTML = state.showingOriginal
    ? state.material.japanese || ''
    : '（原文已隐藏，请通过听力理解）';
  container.querySelector('#listenTrans').innerHTML = `<strong>参考翻译：</strong><br>${state.material.translation || ''}`;

  const vocab = state.material.vocabulary || [];
  container.querySelector('#listenVocab').innerHTML = vocab.map((v) =>
    `<span class="px-2 py-1 bg-sky-50 text-sky-800 rounded text-sm border border-sky-100" title="${v.reading}：${v.meaning}">${v.word}</span>`
  ).join('');

  const btn = container.querySelector('#toggleOriginal');
  btn.textContent = state.showingOriginal ? '隐藏原文' : '显示原文';

  container.querySelector('#rateSlider').value = state.playbackRate;
  container.querySelector('#rateValue').textContent = state.playbackRate + 'x';

  container.querySelector('#toggleOriginal').onclick = () => {
    state.showingOriginal = !state.showingOriginal;
    renderMaterial(container);
  };

  container.querySelector('#playListen').onclick = () => {
    const text = state.material.japanese?.replace(/<[^>]+>/g, '') || '';
    speak(text, state.playbackRate).catch((e) => showError(e.message));
  };

  container.querySelector('#rateSlider').oninput = (e) => {
    state.playbackRate = parseFloat(e.target.value);
    container.querySelector('#rateValue').textContent = state.playbackRate + 'x';
  };

  container.querySelector('#checkDictation').onclick = () => {
    const input = container.querySelector('#dictationInput').value.trim();
    checkDictation(input);
  };
}

function checkDictation(input) {
  if (!input) {
    showError('请输入听写内容');
    return;
  }
  const original = (state.material.japanese || '').replace(/<[^>]+>/g, '').trim();
  const feedback = document.querySelector('#dictationFeedback');

  const similarity = calculateSimilarity(input, original);
  let message = '';
  if (similarity >= 0.85) message = 'Excellent！听写非常准确。';
  else if (similarity >= 0.6) message = '不错，抓住了大部分内容，还有少量遗漏或错误。';
  else message = '还需要多加练习，建议放慢语速多听几遍。';

  feedback.classList.remove('hidden');
  feedback.innerHTML = `
    <div class="p-3 rounded-lg ${similarity >= 0.6 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}">
      <p class="font-semibold">相似度：${Math.round(similarity * 100)}%</p>
      <p>${message}</p>
      <p class="text-sm mt-2"><strong>原文：</strong>${original}</p>
    </div>
  `;
}

function calculateSimilarity(a, b) {
  const clean = (s) => s.replace(/\s+/g, '').replace(/[。、,.!?！？]/g, '');
  const sa = clean(a);
  const sb = clean(b);
  if (!sa || !sb) return 0;
  const dist = levenshtein(sa, sb);
  return Math.max(0, 1 - dist / Math.max(sa.length, sb.length));
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
