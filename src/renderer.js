// Where: Electron renderer. What: render the timer popover. Why: make the menu bar state inspectable without opening Claude Code.

const remainingEl = document.querySelector('[data-remaining]');
const usedEl = document.querySelector('[data-used]');
const resetEl = document.querySelector('[data-reset]');
const sevenDayUsedEl = document.querySelector('[data-seven-day-used]');
const sevenDayResetEl = document.querySelector('[data-seven-day-reset]');
const updatedEl = document.querySelector('[data-updated]');
const modelEl = document.querySelector('[data-model]');
const barEl = document.querySelector('[data-bar]');
const sevenDayBarEl = document.querySelector('[data-seven-day-bar]');
const setupStatusEl = document.querySelector('[data-setup-status]');
const setupButtonEl = document.querySelector('[data-setup-button]');

function formatUpdatedAt(value) {
  if (!value) return '未取得';

  const updatedAtMs = new Date(value).getTime();
  if (!Number.isFinite(updatedAtMs)) return '未取得';

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - updatedAtMs) / 1000));
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes < 1) return '1分未満前';
  if (elapsedMinutes < 60) return `${elapsedMinutes}分前`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}時間前`;

  return `${Math.floor(elapsedHours / 24)}日前`;
}

function render(state) {
  const used = state.fiveHour.usedPercentage;
  const normalizedUsed = Number.isFinite(used) ? Math.max(0, Math.min(100, used)) : 0;
  const sevenDayUsed = state.sevenDay.usedPercentage;
  const normalizedSevenDayUsed = Number.isFinite(sevenDayUsed)
    ? Math.max(0, Math.min(100, sevenDayUsed))
    : 0;

  remainingEl.textContent = state.fiveHour.remaining;
  usedEl.textContent = Number.isFinite(used) ? `${Math.round(used)}%` : '--%';
  resetEl.textContent = state.fiveHour.resetTime || '未取得';
  sevenDayUsedEl.textContent = Number.isFinite(sevenDayUsed)
    ? `${Math.round(sevenDayUsed)}%`
    : '--%';
  sevenDayResetEl.textContent = state.sevenDay.resetTime || '未取得';
  updatedEl.textContent = formatUpdatedAt(state.updatedAt);
  modelEl.textContent = state.model;
  barEl.style.width = `${normalizedUsed}%`;
  sevenDayBarEl.style.width = `${normalizedSevenDayUsed}%`;
}

function renderSetupStatus(status) {
  setupStatusEl.textContent = status.installed ? '設定済み' : '未設定';
  setupButtonEl.textContent = status.installed ? '再設定' : 'セットアップ';
  setupButtonEl.disabled = false;
}

async function refreshSetupStatus() {
  try {
    renderSetupStatus(await window.cctimer.getSetupStatus());
  } catch {
    setupStatusEl.textContent = '確認不可';
    setupButtonEl.disabled = false;
  }
}

setupButtonEl.addEventListener('click', async () => {
  setupButtonEl.disabled = true;
  setupStatusEl.textContent = '処理中';

  try {
    renderSetupStatus(await window.cctimer.installStatusline());
  } catch {
    setupStatusEl.textContent = '失敗';
    setupButtonEl.disabled = false;
  }
});

window.cctimer.getState().then(render);
window.cctimer.onStateUpdate(render);
refreshSetupStatus();
