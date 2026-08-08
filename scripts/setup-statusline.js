#!/usr/bin/env node
// Where: setup CLI. What: install the Claude Code statusline wrapper. Why: provide the same one-step setup as the app UI.

const { installStatusline } = require('../src/statusline-setup');

try {
  const result = installStatusline();
  console.log(result.changed ? 'cctimer statusline wrapper installed.' : 'cctimer statusline wrapper already installed.');
  console.log(`settings: ${result.settingsPath}`);
  console.log(`config: ${result.configPath}`);
  if (result.backupPath) console.log(`backup: ${result.backupPath}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
