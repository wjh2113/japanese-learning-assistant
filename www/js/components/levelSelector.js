const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];

export function renderLevelSelector(selectedLevel, onChange) {
  return `
    <div class="min-w-[100px] md:min-w-[120px]">
      <label class="block text-sm font-medium mb-1">JLPT 等级</label>
      <select id="levelSelect" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
        ${levels.map((lvl) => `
          <option value="${lvl}" ${selectedLevel === lvl ? 'selected' : ''}>${lvl}</option>
        `).join('')}
      </select>
    </div>
  `;
}

export function getSelectedLevel() {
  const el = document.querySelector('#levelSelect');
  return el ? el.value : 'N5';
}
