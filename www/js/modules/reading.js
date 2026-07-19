import { chatJson } from '../api.js';
import { loadConfig, addHistory, addVocab, loadVocab, removeVocab } from '../config.js';
import { speak } from '../speech.js';
import { showLoading, setLoadingText } from '../app.js';
import { renderLevelSelector } from '../components/levelSelector.js';

let state = {
  level: 'N5',
  genre: '',
  article: null,
  answers: {},
  vocab: [],
};

const genres = ['故事', '新闻', '说明文', '对话', '文化', '科技'];

export default { render };

async function render(container) {
  const cfg = await loadConfig();
  state.level = cfg.defaultLevel;
  state.vocab = await loadVocab();

  container.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-wrap items-end gap-3 md:gap-4">
        ${renderLevelSelector(state.level, (lvl) => { state.level = lvl; })}
        <div class="flex-1 min-w-[160px]">
          <label class="block text-sm font-medium mb-1">体裁</label>
          <select id="readGenre" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
            <option value="">随机体裁</option>
            ${genres.map((g) => `<option value="${g}" ${state.genre === g ? 'selected' : ''}>${g}</option>`).join('')}
          </select>
        </div>
        <button id="genRead" class="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 active:bg-sky-800 transition">生成阅读材料</button>
      </div>

      <div id="readError" class="hidden p-3 bg-rose-50 text-rose-700 rounded-lg text-sm"></div>

      <div id="readResult" class="hidden space-y-5">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h3 id="readTitle" class="text-xl font-bold"></h3>
          <button id="readAloud" class="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:bg-emerald-800">🔊 朗读全文</button>
        </div>

        <div id="readBody" class="p-4 bg-slate-50 rounded-lg leading-8 text-lg ruby-text"></div>

        <div id="wordPopup" class="hidden p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p class="font-semibold"><span id="popupWord"></span> <small id="popupReading" class="text-slate-500"></small></p>
          <p id="popupMeaning" class="text-slate-700"></p>
          <button id="saveWordBtn" class="mt-2 px-3 py-1 text-sm bg-sky-600 text-white rounded-lg active:bg-sky-800">收藏单词</button>
        </div>

        <div id="quizSection" class="space-y-3">
          <h4 class="font-semibold">理解测验</h4>
          <div id="quizList" class="space-y-3"></div>
          <button id="submitQuiz" class="w-full md:w-auto px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 active:bg-sky-800 transition">提交答案</button>
          <div id="quizFeedback" class="hidden"></div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#genRead').addEventListener('click', generateArticle);
  container.querySelector('#readGenre').addEventListener('change', (e) => {
    state.genre = e.target.value;
  });

  if (state.article) renderArticle(document.querySelector('#readResult'));
}

function showError(message) {
  const box = document.querySelector('#readError');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('hidden');
}

function hideError() {
  const box = document.querySelector('#readError');
  if (!box) return;
  box.classList.add('hidden');
}

async function generateArticle() {
  const cfg = await loadConfig();
  state.level = document.querySelector('#levelSelect')?.value || cfg.defaultLevel;
  state.genre = document.querySelector('#readGenre')?.value || '';
  const genreText = state.genre || genres[Math.floor(Math.random() * genres.length)];

  const prompt = `为 JLPT ${state.level} 学习者生成一篇日语阅读材料。\n` +
    `体裁：${genreText}\n` +
    `要求：\n` +
    `1. 长度适合该等级（N5 约 150 字，N1 约 600 字）。\n` +
    `2. 使用符合等级的词汇和语法。\n` +
    `3. 正文中的重点单词附带振假名 ruby 标记，如 <ruby>日本<rt>にほん</rt></ruby>。\n` +
    `4. 返回严格 JSON：{"title":"标题","body":"正文（含 ruby 标记）","translation":"中文翻译","vocabulary":[{"word":"单词","reading":"读音","meaning":"中文释义"}],"questions":[{"question":"问题","options":["A","B","C","D"],"answer":0,"explanation":"解析"}]}。`;

  hideError();
  showLoading(true);
  setLoadingText('正在生成阅读材料…');
  try {
    const article = await chatJson([
      { role: 'system', content: '你是专业的日语阅读教师，擅长生成适合各 JLPT 等级的阅读材料。' },
      { role: 'user', content: prompt },
    ]);
    state.article = article;
    state.answers = {};
    const res = document.querySelector('#readResult');
    renderArticle(res);
    await addHistory({ type: 'reading', title: article.title, level: state.level });
  } catch (e) {
    showError('生成失败：' + e.message);
  } finally {
    showLoading(false);
    setLoadingText('AI 思考中…');
  }
}

function renderArticle(container) {
  if (!container) return;
  container.classList.remove('hidden');
  container.querySelector('#readTitle').textContent = state.article.title || '';
  container.querySelector('#readBody').innerHTML = state.article.body || '';

  container.querySelector('#readAloud').onclick = () => {
    const text = (state.article.body || '').replace(/<[^>]+>/g, '');
    speak(text, 1).catch((e) => showError(e.message));
  };

  const body = container.querySelector('#readBody');
  // Make word-level elements clickable; wrap bare text nodes for full coverage
  wrapTextNodes(body);
  body.querySelectorAll('ruby, span, .lookup-word').forEach((el) => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      lookupWord(el.textContent.trim());
    });
  });
  body.addEventListener('click', (e) => {
    const selection = window.getSelection().toString().trim();
    if (selection) lookupWord(selection);
  });

  const quizList = container.querySelector('#quizList');
  const questions = state.article.questions || [];
  quizList.innerHTML = questions.map((q, idx) => `
    <div class="p-3 bg-slate-50 rounded-lg">
      <p class="font-medium mb-2">${idx + 1}. ${q.question}</p>
      <div class="space-y-1">
        ${q.options.map((opt, i) => `
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="q${idx}" value="${i}" class="accent-sky-600">
            <span>${String.fromCharCode(65 + i)}. ${opt}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');

  quizList.querySelectorAll('input[type="radio"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const idx = parseInt(e.target.name.replace('q', ''), 10);
      state.answers[idx] = parseInt(e.target.value, 10);
    });
  });

  container.querySelector('#submitQuiz').onclick = checkQuiz;
}

async function lookupWord(word) {
  if (!word) return;
  const popup = document.querySelector('#wordPopup');
  const popupWord = document.querySelector('#popupWord');
  const popupReading = document.querySelector('#popupReading');
  const popupMeaning = document.querySelector('#popupMeaning');
  const saveBtn = document.querySelector('#saveWordBtn');

  const local = state.vocab.find((v) => v.word === word);
  if (local) {
    popupWord.textContent = local.word;
    popupReading.textContent = local.reading;
    popupMeaning.textContent = local.meaning;
    popup.classList.remove('hidden');
    saveBtn.textContent = '已收藏';
    saveBtn.disabled = true;
    return;
  }

  showLoading(true);
  setLoadingText('正在查词…');
  let result = null;
  try {
    result = await chatJson([
      { role: 'system', content: '你是日语词典，只输出 JSON。' },
      { role: 'user', content: `解释日语单词「${word}」，返回 {"word":"原词","reading":"振假名读音","meaning":"中文释义"}。如果这不是完整单词，请尽量给出最相关的解释。` },
    ]);
    popupWord.textContent = result.word || word;
    popupReading.textContent = result.reading || '';
    popupMeaning.textContent = result.meaning || '';
    popup.classList.remove('hidden');
    saveBtn.textContent = '收藏单词';
    saveBtn.disabled = false;
    saveBtn.onclick = async () => {
      await addVocab(result);
      state.vocab.push(result);
      saveBtn.textContent = '已收藏';
      saveBtn.disabled = true;
    };
  } catch (e) {
    popupWord.textContent = word;
    popupReading.textContent = '';
    popupMeaning.textContent = '查词失败：' + e.message;
    popup.classList.remove('hidden');
  } finally {
    showLoading(false);
    setLoadingText('AI 思考中…');
  }
}

function wrapTextNodes(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement && node.parentElement.closest('.lookup-word')) continue;
    nodes.push(node);
  }
  nodes.forEach((n) => {
    const text = n.textContent;
    if (!text.trim()) return;
    const frag = document.createDocumentFragment();
    // Split Japanese/non-Japanese chunks roughly by character type
    let current = '';
    let lastType = null;
    for (const ch of text) {
      const type = /[぀-ゟ゠-ヿ一-龯㐀-䶿]/.test(ch) ? 'ja' : 'other';
      if (lastType && lastType !== type && current.trim()) {
        appendChunk(frag, current);
        current = '';
      }
      current += ch;
      lastType = type;
    }
    if (current.trim()) appendChunk(frag, current);
    if (frag.childNodes.length > 0) {
      n.parentNode.replaceChild(frag, n);
    }
  });
}

function appendChunk(frag, text) {
  // Keep whitespace as-is, wrap Japanese chunks
  if (/[぀-ゟ゠-ヿ一-龯㐀-䶿]/.test(text.trim())) {
    const span = document.createElement('span');
    span.className = 'lookup-word';
    span.textContent = text;
    frag.appendChild(span);
  } else {
    frag.appendChild(document.createTextNode(text));
  }
}

function checkQuiz() {
  const questions = state.article.questions || [];
  if (questions.length === 0) return;

  let correct = 0;
  const details = questions.map((q, idx) => {
    const userAnswer = state.answers[idx];
    const isCorrect = userAnswer === q.answer;
    if (isCorrect) correct++;
    return { idx, isCorrect, userAnswer, correctAnswer: q.answer, explanation: q.explanation };
  });

  const feedback = document.querySelector('#quizFeedback');
  feedback.classList.remove('hidden');
  const percent = Math.round((correct / questions.length) * 100);
  const color = percent >= 80 ? 'text-emerald-600' : percent >= 60 ? 'text-amber-600' : 'text-rose-600';
  feedback.innerHTML = `
    <div class="p-4 bg-slate-50 rounded-lg">
      <p class="text-xl font-bold ${color}">得分：${correct}/${questions.length}（${percent}%）</p>
      <div class="mt-3 space-y-2">
        ${details.map((d) => `
          <div class="p-2 rounded ${d.isCorrect ? 'bg-emerald-50' : 'bg-rose-50'}">
            <p class="text-sm">${d.idx + 1}. ${d.isCorrect ? '✅ 正确' : `❌ 你的答案：${String.fromCharCode(65 + d.userAnswer)}，正确答案：${String.fromCharCode(65 + d.correctAnswer)}`}</p>
            <p class="text-sm text-slate-600">${d.explanation || ''}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
