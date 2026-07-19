import { chatJson } from '../api.js';
import { loadConfig, addHistory } from '../config.js';
import { speak } from '../speech.js';
import { showLoading, setLoadingText } from '../app.js';
import { renderLevelSelector } from '../components/levelSelector.js';

let state = {
  level: 'N5',
  topic: '',
  essay: '',
  correction: null,
};

const topics = [
  '私の趣味', '私の家族', '好きな季節', '一番楽しかった旅行', '将来の夢',
  '日本語を勉強する理由', '大切な友達', '休日の過ごし方', '最近読んだ本', '環境問題について',
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
          <label class="block text-sm font-medium mb-1">写作题目</label>
          <select id="writeTopic" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
            <option value="">随机题目</option>
            ${topics.map((t) => `<option value="${t}" ${state.topic === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <button id="genWrite" class="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 active:bg-sky-800 transition">生成题目</button>
      </div>

      <div id="writeError" class="hidden p-3 bg-rose-50 text-rose-700 rounded-lg text-sm"></div>

      <div id="writeCard" class="hidden space-y-4">
        <div class="p-4 bg-sky-50 rounded-lg">
          <p class="text-sm text-slate-500 mb-1">题目：</p>
          <p id="writePrompt" class="text-xl font-bold text-slate-900"></p>
          <p id="writeHint" class="text-sm text-slate-600 mt-2"></p>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">你的作文</label>
          <textarea id="essayInput" rows="8" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="请用日语写作..."></textarea>
          <div class="flex justify-between items-center mt-2">
            <span id="essayCount" class="text-xs text-slate-400">0 字</span>
            <button id="submitEssay" class="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 active:bg-sky-800 transition">提交批改</button>
          </div>
        </div>

        <div id="writeFeedback" class="hidden space-y-4">
          <div class="p-4 bg-slate-50 rounded-lg">
            <p class="text-xl font-bold mb-2">批改结果</p>
            <p id="overallScore" class="text-2xl font-bold"></p>
            <div id="mistakesList" class="mt-3 space-y-2"></div>
          </div>

          <div class="p-4 bg-emerald-50 rounded-lg">
            <p class="font-semibold mb-2">修改后范文</p>
            <p id="revisedEssay" class="leading-7"></p>
            <button id="readRevised" class="mt-2 px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:bg-emerald-800">🔊 朗读范文</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#genWrite').addEventListener('click', generateTopic);
  container.querySelector('#writeTopic').addEventListener('change', (e) => {
    state.topic = e.target.value;
  });

  const input = container.querySelector('#essayInput');
  if (input) {
    input.addEventListener('input', () => {
      container.querySelector('#essayCount').textContent = `${input.value.length} 字`;
    });
    input.value = state.essay || '';
    container.querySelector('#essayCount').textContent = `${input.value.length} 字`;
  }

  container.querySelector('#submitEssay').addEventListener('click', submitEssay);

  const card = container.querySelector('#writeCard');
  if (state.topic || state.correction) renderCard(card);
}

function showError(message) {
  const box = document.querySelector('#writeError');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('hidden');
}

function hideError() {
  const box = document.querySelector('#writeError');
  if (!box) return;
  box.classList.add('hidden');
}

async function generateTopic() {
  const cfg = await loadConfig();
  state.level = document.querySelector('#levelSelect')?.value || cfg.defaultLevel;
  state.topic = document.querySelector('#writeTopic')?.value || '';
  const topicText = state.topic || topics[Math.floor(Math.random() * topics.length)];

  const prompt = `为 JLPT ${state.level} 学习者生成一道日语写作题。\n` +
    `题目参考：${topicText}\n` +
    `要求：\n` +
    `1. 给出一个清晰的日语作文题目。\n` +
    `2. 提供写作要点提示（用中文）。\n` +
    `3. 返回严格 JSON：{"topic":"日语题目","hint":"中文写作要点","expectedLength":"建议字数"}。`;

  hideError();
  showLoading(true);
  setLoadingText('正在生成写作题…');
  try {
    const data = await chatJson([
      { role: 'system', content: '你是专业的日语写作教师。' },
      { role: 'user', content: prompt },
    ]);
    state.topic = data.topic;
    state.hint = data.hint;
    state.expectedLength = data.expectedLength;
    state.correction = null;
    const card = document.querySelector('#writeCard');
    renderCard(card);
    await addHistory({ type: 'writing', title: data.topic, level: state.level });
  } catch (e) {
    showError('生成失败：' + e.message);
  } finally {
    showLoading(false);
    setLoadingText('AI 思考中…');
  }
}

function renderCard(card) {
  if (!card) return;
  card.classList.remove('hidden');
  card.querySelector('#writePrompt').textContent = state.topic || '';
  card.querySelector('#writeHint').innerHTML = `
    <strong>写作要点：</strong>${state.hint || ''}<br>
    <strong>建议字数：</strong>${state.expectedLength || ''}`;

  const feedback = card.querySelector('#writeFeedback');
  if (state.correction) {
    feedback.classList.remove('hidden');
    renderCorrection(feedback);
  } else {
    feedback.classList.add('hidden');
  }
}

async function submitEssay() {
  const essay = document.querySelector('#essayInput').value.trim();
  if (!essay) {
    showError('请先输入作文');
    return;
  }
  state.essay = essay;

  const prompt = `作为日语写作教师，批改以下 JLPT ${state.level} 水平的作文。\n` +
    `题目：${state.topic}\n` +
    `作文内容：\n${essay}\n` +
    `要求：\n` +
    `1. 给出 0-100 综合评分。\n` +
    `2. 列出主要错误（语法、用词、敬体/简体、表达不自然等），每条包含 original（错误原文）、correction（正确写法）、explanation（中文解释）。\n` +
    `3. 给出修改后的完整范文。\n` +
    `4. 返回严格 JSON：{"score":85,"mistakes":[{"original":"...","correction":"...","explanation":"..."}],"revisedEssay":"修改后的作文"}。`;

  hideError();
  showLoading(true);
  setLoadingText('AI 批改中…');
  try {
    const correction = await chatJson([
      { role: 'system', content: '你是严格的日语写作批改老师，只输出 JSON。' },
      { role: 'user', content: prompt },
    ]);
    state.correction = correction;
    const card = document.querySelector('#writeCard');
    renderCard(card);
    await addHistory({ type: 'writing-corrected', title: state.topic, level: state.level });
  } catch (e) {
    showError('批改失败：' + e.message);
  } finally {
    showLoading(false);
    setLoadingText('AI 思考中…');
  }
}

function renderCorrection(container) {
  const c = state.correction;
  const scoreColor = c.score >= 80 ? 'text-emerald-600' : c.score >= 60 ? 'text-amber-600' : 'text-rose-600';
  container.querySelector('#overallScore').innerHTML = `综合得分：<span class="${scoreColor}">${c.score}</span>`;

  const list = container.querySelector('#mistakesList');
  const mistakes = c.mistakes || [];
  if (mistakes.length === 0) {
    list.innerHTML = '<p class="text-emerald-600">未发现明显错误，写得很好！</p>';
  } else {
    list.innerHTML = mistakes.map((m) => `
      <div class="p-3 bg-white rounded border border-slate-200">
        <p class="text-rose-600">❌ ${m.original}</p>
        <p class="text-emerald-600">✅ ${m.correction}</p>
        <p class="text-sm text-slate-600 mt-1">${m.explanation}</p>
      </div>
    `).join('');
  }

  container.querySelector('#revisedEssay').textContent = c.revisedEssay || '';
  container.querySelector('#readRevised').onclick = () => {
    speak(c.revisedEssay || '', 1).catch((e) => showError(e.message));
  };
}
