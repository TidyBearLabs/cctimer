// Where: Electron renderer. What: render the timer popover. Why: make the menu bar state inspectable without opening Claude Code.

const remainingEl = document.querySelector('[data-remaining]');
const usedEl = document.querySelector('[data-used]');
const resetEl = document.querySelector('[data-reset]');
const sevenDayUsedEl = document.querySelector('[data-seven-day-used]');
const sevenDayResetEl = document.querySelector('[data-seven-day-reset]');
const updatedEl = document.querySelector('[data-updated]');
const barEl = document.querySelector('[data-bar]');
const sevenDayBarEl = document.querySelector('[data-seven-day-bar]');
const setupStatusEl = document.querySelector('[data-setup-status]');
const setupButtonEl = document.querySelector('[data-setup-button]');

function formatUpdatedAt(value) {
  if (!value) return 'Unavailable';

  const updatedAtMs = new Date(value).getTime();
  if (!Number.isFinite(updatedAtMs)) return 'Unavailable';

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - updatedAtMs) / 1000));
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes < 1) return 'Less than a minute ago';
  if (elapsedMinutes < 60) return `${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`;
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
  resetEl.textContent = state.fiveHour.resetTime || 'Unavailable';
  sevenDayUsedEl.textContent = Number.isFinite(sevenDayUsed)
    ? `${Math.round(sevenDayUsed)}%`
    : '--%';
  sevenDayResetEl.textContent = state.sevenDay.resetTime || 'Unavailable';
  updatedEl.textContent = formatUpdatedAt(state.updatedAt);
  barEl.style.width = `${normalizedUsed}%`;
  sevenDayBarEl.style.width = `${normalizedSevenDayUsed}%`;
}

function renderSetupStatus(status) {
  setupStatusEl.textContent = status.installed ? 'Configured' : 'Not configured';
  setupButtonEl.textContent = status.installed ? 'Configure again' : 'Setup';
  setupButtonEl.disabled = false;
}

async function refreshSetupStatus() {
  try {
    renderSetupStatus(await window.cctimer.getSetupStatus());
  } catch {
    setupStatusEl.textContent = 'Unavailable';
    setupButtonEl.disabled = false;
  }
}

setupButtonEl.addEventListener('click', async () => {
  setupButtonEl.disabled = true;
  setupStatusEl.textContent = 'Configuring';

  try {
    renderSetupStatus(await window.cctimer.installStatusline());
  } catch {
    setupStatusEl.textContent = 'Failed';
    setupButtonEl.disabled = false;
  }
});

window.cctimer.getState().then(render);
window.cctimer.onStateUpdate(render);
refreshSetupStatus();
