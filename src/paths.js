// Where: shared Node paths. What: define cctimer and Claude Code file locations. Why: keep setup, wrapper, and app behavior aligned.

const os = require('node:os');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const appDataDir = process.env.CCTIMER_APP_DATA_DIR || path.join(os.homedir(), 'Library', 'Application Support', 'cctimer');

module.exports = {
  appDataDir,
  statePath: process.env.CCTIMER_STATE_PATH || path.join(appDataDir, 'rate-limit.json'),
  setupConfigPath: process.env.CCTIMER_SETUP_CONFIG_PATH || path.join(appDataDir, 'statusline-config.json'),
  claudeSettingsPath: process.env.CCTIMER_CLAUDE_SETTINGS_PATH || path.join(os.homedir(), '.claude', 'settings.json'),
  statuslineScriptPath: path.join(repoRoot, 'scripts', 'claude-statusline.js'),
  wrapperPath: path.join(repoRoot, 'scripts', 'statusline-wrapper.js')
};
