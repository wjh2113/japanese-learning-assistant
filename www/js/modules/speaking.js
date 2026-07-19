import { chat, chatJson } from '../api.js';
import { loadConfig, addHistory } from '../config.js';
import { speak, startRecognition, addRecognitionListener, removeRecognitionListener, stopRecognition } from '../speech.js';
import { showLoading, setLoadingText } from '../app.js';
import { renderLevelSelector } from '../components/levelSelector.js';

let state = {
  level: 'N5',
  scenario: '',
  targetText: '',
  recognizedText: '',
  evaluating: false,
};

const scenarios = [
  '自我介绍', '点餐', '问路', '购物', '约会', '面试', '旅行咨询', '电话留言',
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
          <label class="block text-sm font-medium mb-1">场景</label>
          <select id="speakScenario" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
            <option value="">随机场景</option>
            ${scenarios.map((s) => `<option value="${s}" ${state.scenario === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <button id="genSpeak" class="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 active:bg-sky-800 transition">生成口语题</button>
      </div>

      <div id="speakError" class="hidden p-3 bg-rose-50 text-rose-700 rounded-lg text-sm"></div>

      <div id="speakCard" class="hidden space-y-4">
        <div class="p-4 bg-sky-50 rounded-lg">
          <p class="text-sm text-slate-500 mb-1">请朗读或回答：</p>
          <p id="speakPrompt" class="text-xl font-medium text-slate-900"></p>
          <p id="speakHint" class="text-sm text-slate-600 mt-2"></p>
        </div>

        <div class="flex flex-wrap gap-3">
          <button id="playSample" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition">🔊 播放标准发音</button>
          <button id="recordBtn" class="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 active:bg-rose-800 transition">🎙️ 开始录音</button>
        </div>

        <div id="recStatus" class="text-sm text-slate-500 hidden">正在听…</div>
        <div id="recognizedBox" class="hidden p-3 bg-slate-50 rounded-lg">
          <p class="text-sm text-slate-500">识别结果：</p>
          <p id="recognizedText" class="text-lg"></p>
        </div>

        <button id="evaluateSpeak" class="hidden px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 active:bg-sky-800 transition">让 AI 评估</button>

        <div id="speakFeedback" class="hidden"></div>
      </div>
    </div>
  `;

  container.querySelector('#genSpeak').addEventListener('click', generatePrompt);
  container.querySelector('#speakScenario').addEventListener('change', (e) => {
    state.scenario = e.target.value;
  });

  const card = container.querySelector('#speakCard');
  if (state.targetText) renderCard(card);
}

function showError(message) {
  const box = document.querySelector('#speakError');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('hidden');
}

function hideError() {
  const box = document.querySelector('#speakError');
  if (!box) return;
  box.classList.add('hidden');
}

async function generatePrompt() {
  const cfg = await loadConfig();
  state.level = document.querySelector('#levelSelect')?.value || cfg.defaultLevel;
  state.scenario = document.querySelector('#speakScenario')?.value || '';
  const scenarioText = state.scenario || scenarios[Math.floor(Math.random() * scenarios.length)];

  const prompt = `为 JLPT ${state.level} 学习者生成一道日语口语练习题。\n` +
    `场景：${scenarioText}\n` +
    `要求：\n` +
    `1. 给出一句需要朗读或回答的日文（含振假名 ruby 标记）。\n` +
    `2. 提供中文提示，告诉学习者该说什么。\n` +
    `3. 返回严格 JSON：{"prompt":"日文提示","hint":"中文说明","expected":"期望的日语回答（含 ruby）"}。`;

  hideError();
  showLoading(true);
  setLoadingText('正在生成口语题…');
  try {
    const data = await chatJson([
      { role: 'system', content: '你是专业的日语口语教师。' },
      { role: 'user', content: prompt },
    ]);
    state.targetText = data.expected || data.prompt;
    state.promptText = data.prompt;
    state.hintText = data.hint;
    state.recognizedText = '';
    const card = document.querySelector('#speakCard');
    renderCard(card);
    await addHistory({ type: 'speaking', title: scenarioText, level: state.level });
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
  card.querySelector('#speakPrompt').innerHTML = state.promptText || '';
  card.querySelector('#speakHint').textContent = state.hintText || '';
  card.querySelector('#recognizedBox').classList.add('hidden');
  card.querySelector('#evaluateSpeak').classList.add('hidden');
  card.querySelector('#speakFeedback').classList.add('hidden');
  card.querySelector('#recStatus').classList.add('hidden');

  card.querySelector('#playSample').onclick = () => {
    const text = (state.targetText || '').replace(/<[^>]+>/g, '');
    speak(text, 1).catch((e) => showError(e.message));
  };

  const recordBtn = card.querySelector('#recordBtn');
  recordBtn.onclick = () => startRecording(recordBtn);

  card.querySelector('#evaluateSpeak').onclick = evaluateSpeaking;
}

async function startRecording(btn) {
  const status = document.querySelector('#recStatus');
  status.classList.remove('hidden');
  status.textContent = '正在听，请用日语朗读…';
  btn.disabled = true;
  btn.textContent = '录音中…';

  try {
    const rec = await startRecognition({ lang: 'ja-JP', continuous: false, interimResults: false });

    if (rec.native) {
      await removeRecognitionListener();
      await addRecognitionListener('listeningResult', (result) => {
        if (result.matches && result.matches.length > 0) {
          const text = result.matches[0];
          state.recognizedText = text;
          showResult(text);
        }
      });
      await addRecognitionListener('listeningError', (err) => {
        console.error('Speech recognition error', err);
        showError('语音识别失败：' + (err.message || '未知错误'));
        resetBtn();
      });
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
      await SpeechRecognition.start(rec.options);
      resetBtn();
      return;
    }

    const webRec = rec.recognition;
    webRec.onresult = (event) => {
      const text = event.results[0][0].transcript;
      state.recognizedText = text;
      showResult(text);
    };
    webRec.onerror = (event) => {
      showError('语音识别失败：' + event.error);
    };
    webRec.onend = () => {
      resetBtn();
    };
    webRec.start();
  } catch (e) {
    showError(e.message);
    resetBtn();
  }

  function resetBtn() {
    status.classList.add('hidden');
    btn.disabled = false;
    btn.textContent = '🎙️ 重新录音';
  }
}

function showResult(text) {
  const box = document.querySelector('#recognizedBox');
  box.classList.remove('hidden');
  document.querySelector('#recognizedText').textContent = text;
  document.querySelector('#evaluateSpeak').classList.remove('hidden');
}

async function evaluateSpeaking() {
  if (!state.recognizedText) {
    showError('请先录音');
    return;
  }
  const expected = (state.targetText || '').replace(/<[^>]+>/g, '');
  const prompt = `作为日语口语教师，评估学习者的口语表达。\n` +
    `期望内容：${expected}\n` +
    `学习者识别结果：${state.recognizedText}\n` +
    `请从发音准确度（基于文本差异近似判断）、语法正确性、自然度三方面评价，给出 0-100 综合分数和具体改进建议。\n` +
    `返回严格 JSON：{"score":85,"pronunciation":"评价","grammar":"评价","naturalness":"评价","suggestions":"建议"}。`;

  showLoading(true);
  setLoadingText('AI 评估中…');
  try {
    const result = await chatJson([
      { role: 'system', content: '你是严格的日语口语评分老师，只输出 JSON。' },
      { role: 'user', content: prompt },
    ]);
    renderFeedback(result);
  } catch (e) {
    try {
      const text = await chat([
        { role: 'system', content: '你是严格的日语口语评分老师。' },
        { role: 'user', content: prompt.replace('返回严格 JSON：...', '请用中文给出评分和建议。') },
      ]);
      renderFeedback({ score: '?', pronunciation: text, grammar: '', naturalness: '', suggestions: '' });
    } catch (e2) {
      showError('评估失败：' + e2.message);
    }
  } finally {
    showLoading(false);
    setLoadingText('AI 思考中…');
  }
}

function renderFeedback(result) {
  const box = document.querySelector('#speakFeedback');
  box.classList.remove('hidden');
  const scoreColor = result.score >= 80 ? 'text-emerald-600' : result.score >= 60 ? 'text-amber-600' : 'text-rose-600';
  box.innerHTML = `
    <div class="p-4 bg-slate-50 rounded-lg space-y-2">
      <p class="text-2xl font-bold ${scoreColor}">综合得分：${result.score}</p>
      ${result.pronunciation ? `<p><strong>发音：</strong>${result.pronunciation}</p>` : ''}
      ${result.grammar ? `<p><strong>语法：</strong>${result.grammar}</p>` : ''}
      ${result.naturalness ? `<p><strong>自然度：</strong>${result.naturalness}</p>` : ''}
      ${result.suggestions ? `<p><strong>改进建议：</strong>${result.suggestions}</p>` : ''}
    </div>
  `;
}
