// Where: Electron main process. What: create the macOS menu bar timer. Why: show Claude Code's 5-hour reset countdown outside the terminal.

const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { statePath } = require('./paths');
const { formatRemaining, isFutureReset } = require('./statusline-state');
const { getSetupStatus, installStatusline } = require('./statusline-setup');

let tray;
let window;
let timerId;
let lastState = null;

function readState() {
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatResetTime(resetEpochSeconds) {
  if (!Number.isFinite(resetEpochSeconds)) return null;

  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(resetEpochSeconds * 1000));
}

function formatResetDateTime(resetEpochSeconds) {
  if (!Number.isFinite(resetEpochSeconds)) return null;

  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(resetEpochSeconds * 1000));
}

function buildViewModel() {
  const freshState = readState();
  if (freshState) lastState = freshState;
  const state = lastState;
  const nowMs = Date.now();

  const fiveHour = state?.five_hour || {};
  const sevenDay = state?.seven_day || {};
  const resetAt = isFutureReset(fiveHour.resets_at, nowMs) ? fiveHour.resets_at : null;
  const used = resetAt !== null && Number.isFinite(fiveHour.used_percentage) ? fiveHour.used_percentage : null;
  const sevenDayResetAt = isFutureReset(sevenDay.resets_at, nowMs) ? sevenDay.resets_at : null;
  const sevenDayUsed = sevenDayResetAt !== null && Number.isFinite(sevenDay.used_percentage)
    ? sevenDay.used_percentage
    : null;

  return {
    statePath,
    model: state?.model || 'Claude Code',
    updatedAt: state?.updated_at || null,
    fiveHour: {
      usedPercentage: used,
      resetsAt: resetAt,
      resetTime: formatResetTime(resetAt),
      remaining: formatRemaining(resetAt, nowMs)
    },
    sevenDay: {
      usedPercentage: sevenDayUsed,
      resetsAt: sevenDayResetAt,
      resetTime: formatResetDateTime(sevenDayResetAt)
    }
  };
}

function updateTrayTitle() {
  const viewModel = buildViewModel();
  tray.setTitle(`↻ ${viewModel.fiveHour.remaining}`, {
    fontType: 'monospacedDigit'
  });

  if (window && !window.isDestroyed()) {
    window.webContents.send('state:update', viewModel);
  }
}

function createTrayImage() {
  // The visible timer is the title; this empty image keeps the Tray item clickable.
  const image = nativeImage.createEmpty();
  image.setTemplateImage(true);
  return image;
}

function createWindow() {
  window = new BrowserWindow({
    width: 320,
    height: 410,
    show: false,
    resizable: false,
    fullscreenable: false,
    frame: false,
    transparent: true,
    vibrancy: 'menu',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile(path.join(__dirname, 'index.html'));
  window.on('blur', () => window.hide());
}

function positionWindow() {
  const trayBounds = tray.getBounds();
  const windowBounds = window.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y
  });

  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const y = Math.round(display.workArea.y + 28);

  window.setPosition(x, y, false);
}

function toggleWindow() {
  if (window.isVisible()) {
    window.hide();
    return;
  }

  positionWindow();
  window.show();
  window.focus();
  updateTrayTitle();
}

function createTray() {
  tray = new Tray(createTrayImage());
  tray.setToolTip('Claude Code rate limit timer');
  tray.on('click', toggleWindow);
  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
      { label: 'Show Timer', click: toggleWindow },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]);
    tray.popUpContextMenu(menu);
  });
}

app.whenReady().then(() => {
  if (app.dock) app.dock.hide();

  createTray();
  createWindow();
  updateTrayTitle();

  timerId = setInterval(updateTrayTitle, 1000);
});

app.on('before-quit', () => {
  if (timerId) clearInterval(timerId);
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

ipcMain.handle('state:get', () => buildViewModel());
ipcMain.handle('setup:get', () => getSetupStatus());
ipcMain.handle('setup:install', () => installStatusline());
