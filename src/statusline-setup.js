// Where: shared setup logic. What: install a Claude Code statusline wrapper. Why: capture rate limits without replacing an existing statusline.

const fs = require('node:fs');
const path = require('node:path');
const {
  appDataDir,
  claudeSettingsPath,
  setupConfigPath,
  wrapperPath
} = require('./paths');

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function getNodeCommand() {
  return process.env.CCTIMER_NODE_PATH || 'node';
}

function getWrapperCommand() {
  return `${shellQuote(getNodeCommand())} ${shellQuote(wrapperPath)}`;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`${filePath} の JSON を読めません: ${error.message}`);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) return null;

  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const backupPath = `${filePath}.cctimer-backup-${stamp}`;
  fs.copyFileSync(filePath, backupPath);

  return backupPath;
}

function getSetupStatus() {
  const settings = readJson(claudeSettingsPath, {});
  const command = settings.statusLine?.command || null;
  const wrapperCommand = getWrapperCommand();
  const config = readJson(setupConfigPath, {});

  return {
    installed: command === wrapperCommand,
    command,
    wrapperCommand,
    originalCommand: config.original_command || null,
    settingsPath: claudeSettingsPath,
    configPath: setupConfigPath
  };
}

function installStatusline() {
  const settings = readJson(claudeSettingsPath, {});
  const existingStatusLine = settings.statusLine || {};

  if (typeof existingStatusLine !== 'object' || Array.isArray(existingStatusLine)) {
    throw new Error('settings.json の statusLine が object ではないため、自動設定できません。');
  }

  if (existingStatusLine.type && existingStatusLine.type !== 'command') {
    throw new Error('既存の statusLine.type が command ではないため、自動設定できません。');
  }

  const wrapperCommand = getWrapperCommand();
  const existingCommand = existingStatusLine.command || null;
  const currentConfig = readJson(setupConfigPath, {});
  const alreadyInstalled = existingCommand === wrapperCommand;
  const originalCommand = alreadyInstalled
    ? currentConfig.original_command || null
    : existingCommand;

  fs.mkdirSync(appDataDir, { recursive: true });
  writeJson(setupConfigPath, {
    installed_at: new Date().toISOString(),
    original_command: originalCommand,
    wrapper_command: wrapperCommand
  });

  if (!alreadyInstalled) {
    const backupPath = backupFile(claudeSettingsPath);
    settings.statusLine = {
      ...existingStatusLine,
      type: 'command',
      command: wrapperCommand
    };
    writeJson(claudeSettingsPath, settings);

    return {
      ...getSetupStatus(),
      changed: true,
      backupPath
    };
  }

  return {
    ...getSetupStatus(),
    changed: false,
    backupPath: null
  };
}

module.exports = {
  getSetupStatus,
  getWrapperCommand,
  installStatusline
};
