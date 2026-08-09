// Where: shared setup logic. What: install a Claude Code statusline wrapper. Why: capture rate limits without replacing an existing statusline.

const fs = require('node:fs');
const path = require('node:path');
const {
  appDataDir,
  claudeSettingsPath,
  runtimeRoot,
  setupConfigPath,
  sourceRoot,
  wrapperPath
} = require('./paths');

const RUNTIME_FILES = [
  'scripts/claude-statusline.js',
  'scripts/statusline-wrapper.js',
  'src/paths.js',
  'src/statusline-setup.js',
  'src/statusline-state.js'
];

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function getNodeCommand() {
  return process.env.CCTIMER_NODE_PATH || 'node';
}

function getWrapperCommand() {
  return `${shellQuote(getNodeCommand())} ${shellQuote(wrapperPath)}`;
}

function isCctimerWrapperCommand(command) {
  return typeof command === 'string' &&
    command.includes('statusline-wrapper.js') &&
    command.includes('cctimer');
}

function normalizeOriginalCommand(command) {
  if (!command || isCctimerWrapperCommand(command)) return null;
  return command;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Unable to read JSON from ${filePath}: ${error.message}`);
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

function installRuntimeFiles() {
  for (const relativePath of RUNTIME_FILES) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(runtimeRoot, relativePath);

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (sourcePath !== targetPath) fs.copyFileSync(sourcePath, targetPath);
  }
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
    originalCommand: normalizeOriginalCommand(config.original_command),
    settingsPath: claudeSettingsPath,
    configPath: setupConfigPath
  };
}

function installStatusline() {
  const settings = readJson(claudeSettingsPath, {});
  const existingStatusLine = settings.statusLine || {};

  if (typeof existingStatusLine !== 'object' || Array.isArray(existingStatusLine)) {
    throw new Error('Unable to configure automatically because statusLine in settings.json is not an object.');
  }

  if (existingStatusLine.type && existingStatusLine.type !== 'command') {
    throw new Error('Unable to configure automatically because the existing statusLine.type is not command.');
  }

  const wrapperCommand = getWrapperCommand();
  const existingCommand = existingStatusLine.command || null;
  const currentConfig = readJson(setupConfigPath, {});
  const alreadyInstalled = existingCommand === wrapperCommand;
  const originalCommand = alreadyInstalled || isCctimerWrapperCommand(existingCommand)
    ? normalizeOriginalCommand(currentConfig.original_command)
    : existingCommand;

  fs.mkdirSync(appDataDir, { recursive: true });
  installRuntimeFiles();
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
  isCctimerWrapperCommand,
  installStatusline
};
