// Where: shared statusline state helpers. What: parse, persist, and display Claude Code rate limits. Why: avoid diverging logic between scripts.

const fs = require('node:fs');
const path = require('node:path');
const { statePath } = require('./paths');

function formatRemaining(resetEpochSeconds, nowMs = Date.now()) {
  if (!isFutureReset(resetEpochSeconds, nowMs)) return '--:--:--';

  const remainingSeconds = Math.ceil(resetEpochSeconds - nowMs / 1000);
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function isFutureReset(resetEpochSeconds, nowMs = Date.now()) {
  return Number.isFinite(resetEpochSeconds) && resetEpochSeconds > nowMs / 1000;
}

function buildState(data) {
  const fiveHour = data.rate_limits?.five_hour;
  const sevenDay = data.rate_limits?.seven_day;

  return {
    updated_at: new Date().toISOString(),
    model: data.model?.display_name || data.model?.id || null,
    session_id: data.session_id || null,
    five_hour: {
      used_percentage: Number.isFinite(fiveHour?.used_percentage) ? fiveHour.used_percentage : null,
      resets_at: Number.isFinite(fiveHour?.resets_at) ? fiveHour.resets_at : null
    },
    seven_day: {
      used_percentage: Number.isFinite(sevenDay?.used_percentage) ? sevenDay.used_percentage : null,
      resets_at: Number.isFinite(sevenDay?.resets_at) ? sevenDay.resets_at : null
    }
  };
}

function writeState(state, targetPath = statePath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function buildStatusLine(state) {
  const model = state.model ? `[${state.model}]` : '[Claude]';
  const used = state.five_hour.used_percentage;
  const reset = state.five_hour.resets_at;

  if (used == null || !isFutureReset(reset)) return model;

  return `${model} 5h ${Math.round(used)}% reset ${formatRemaining(reset)}`;
}

function saveFromInput(input) {
  const data = JSON.parse(input);
  const state = buildState(data);
  writeState(state);

  return {
    state,
    line: buildStatusLine(state)
  };
}

module.exports = {
  buildState,
  buildStatusLine,
  formatRemaining,
  isFutureReset,
  saveFromInput,
  writeState
};
