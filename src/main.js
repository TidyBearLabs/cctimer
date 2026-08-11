// Where: Electron main process. What: create the macOS menu bar timer. Why: show Claude Code's 5-hour reset countdown outside the terminal.

const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { appDataDir, statePath } = require('./paths');
const { formatRemaining, isFutureReset } = require('./statusline-state');
const { getSetupStatus, installStatusline } = require('./statusline-setup');

// The popover is simple enough to render in software and does not need a GPU process.
app.disableHardwareAcceleration();

let tray;
let window;
let timerId;
const notificationTimers = new Map();
const scheduledNotifications = new Map();
const notifiedNotifications = new Set();
let lastState = null;
const maxNotificationDelayMs = 2_147_483_647;
const resetTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});
const resetDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});
const notificationSchedules = [
  {
    id: 'five-hour-warning',
    stateKey: 'five_hour',
    offsetMs: 30 * 60 * 1000,
    title: 'Claude Code 5h timer resets soon',
    body: 'The 5h rate limit cycle resets in 30 minutes.'
  },
  {
    id: 'five-hour-reset',
    stateKey: 'five_hour',
    offsetMs: 0,
    title: 'Claude Code 5h timer reset',
    body: 'The 5h rate limit cycle has reset.'
  },
  {
    id: 'seven-day-warning',
    stateKey: 'seven_day',
    offsetMs: 60 * 60 * 1000,
    title: 'Claude Code 7d timer resets soon',
    body: 'The 7d rate limit cycle resets in 1 hour.'
  },
  {
    id: 'seven-day-reset',
    stateKey: 'seven_day',
    offsetMs: 0,
    title: 'Claude Code 7d timer reset',
    body: 'The 7d rate limit cycle has reset.'
  }
];
const startupNotificationPromptPath = path.join(
  appDataDir,
  `notification-permission-prompt-${app.isPackaged ? 'packaged' : 'development'}.json`
);

function readState() {
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function refreshStateFromDisk() {
  const freshState = readState();
  if (!freshState) return false;

  lastState = freshState;
  return true;
}

function watchStateFile() {
  // Poll file metadata, then read JSON only when Claude Code updates the file.
  fs.watchFile(statePath, { interval: 5000 }, (current, previous) => {
    if (current.mtimeMs === previous.mtimeMs && current.size === previous.size) return;
    if (!refreshStateFromDisk()) return;

    scheduleCurrentNotifications();
    updateTrayTitle();
  });
}

function formatResetTime(resetEpochSeconds) {
  if (!Number.isFinite(resetEpochSeconds)) return null;

  return resetTimeFormatter.format(new Date(resetEpochSeconds * 1000));
}

function formatResetDateTime(resetEpochSeconds) {
  if (!Number.isFinite(resetEpochSeconds)) return null;

  return resetDateTimeFormatter.format(new Date(resetEpochSeconds * 1000));
}

function buildViewModel() {
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

function clearNotificationTimer(scheduleId) {
  const timerIdToClear = notificationTimers.get(scheduleId);
  if (timerIdToClear) clearTimeout(timerIdToClear);

  notificationTimers.delete(scheduleId);
  scheduledNotifications.delete(scheduleId);
}

function showScheduledNotification(schedule, resetAt) {
  const notificationKey = `${schedule.id}:${resetAt}`;
  if (notifiedNotifications.has(notificationKey) || !Notification.isSupported()) return;

  notifiedNotifications.add(notificationKey);
  const notification = new Notification({
    title: schedule.title,
    body: schedule.body
  });

  notification.show();
}

function notifyIfScheduleIsCurrent(schedule, resetAt) {
  refreshStateFromDisk();

  notificationTimers.delete(schedule.id);
  scheduledNotifications.delete(schedule.id);

  // The timeout may fire after Claude Code has already reported a newer cycle.
  if (lastState?.[schedule.stateKey]?.resets_at !== resetAt) {
    scheduleCurrentNotifications();
    return;
  }

  showScheduledNotification(schedule, resetAt);
  updateTrayTitle();
}

function scheduleNotification(schedule, resetAt) {
  const notificationKey = `${schedule.id}:${resetAt}`;
  // Keep an existing timer until its callback runs, including at the exact reset time.
  if (scheduledNotifications.get(schedule.id) === resetAt) return;

  if (!isFutureReset(resetAt) || notifiedNotifications.has(notificationKey)) {
    clearNotificationTimer(schedule.id);
    return;
  }

  clearNotificationTimer(schedule.id);
  scheduledNotifications.set(schedule.id, resetAt);

  // If the app starts inside the warning window, show that warning immediately.
  const notificationAtMs = resetAt * 1000 - schedule.offsetMs;
  const delayMs = Math.min(
    Math.max(0, Math.ceil(notificationAtMs - Date.now())),
    maxNotificationDelayMs
  );
  const scheduledTimerId = setTimeout(
    () => notifyIfScheduleIsCurrent(schedule, resetAt),
    delayMs
  );
  notificationTimers.set(schedule.id, scheduledTimerId);
}

function scheduleNotifications(resetTimes) {
  for (const schedule of notificationSchedules) {
    scheduleNotification(schedule, resetTimes[schedule.stateKey]);
  }
}

function scheduleCurrentNotifications() {
  const viewModel = buildViewModel();
  scheduleNotifications({
    five_hour: viewModel.fiveHour.resetsAt,
    seven_day: viewModel.sevenDay.resetsAt
  });
}

function clearNotificationTimers() {
  for (const schedule of notificationSchedules) {
    clearNotificationTimer(schedule.id);
  }
}

function hasPromptedForStartupNotifications() {
  try {
    const promptState = JSON.parse(fs.readFileSync(startupNotificationPromptPath, 'utf8'));
    return promptState.prompted === true;
  } catch {
    return false;
  }
}

function markStartupNotificationPrompted() {
  fs.mkdirSync(path.dirname(startupNotificationPromptPath), { recursive: true });
  fs.writeFileSync(
    startupNotificationPromptPath,
    `${JSON.stringify({ prompted: true, prompted_at: new Date().toISOString() }, null, 2)}\n`,
    'utf8'
  );
}

function requestStartupNotificationPermission() {
  if (!Notification.isSupported() || hasPromptedForStartupNotifications()) return;

  try {
    // macOS shows the system permission dialog only when the app posts a notification.
    markStartupNotificationPrompted();
    const notification = new Notification({
      title: 'Enable cctimer notifications',
      body: 'Allow notifications to be notified when the 5h timer resets.'
    });
    notification.show();
  } catch {
    // Permission prompting is best-effort; the app can still run without notifications.
  }
}

function createTrayImage() {
  // The visible timer is the title; this empty image keeps the Tray item clickable.
  const image = nativeImage.createEmpty();
  image.setTemplateImage(true);
  return image;
}

function createWindow() {
  const createdWindow = new BrowserWindow({
    width: 320,
    height: 342,
    show: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  window = createdWindow;

  createdWindow.setAlwaysOnTop(true, 'pop-up-menu');
  createdWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true
  });
  createdWindow.on('blur', () => {
    if (!createdWindow.isDestroyed()) createdWindow.close();
  });
  createdWindow.on('closed', () => {
    if (window === createdWindow) window = null;
  });

  return createdWindow;
}

function positionWindow(targetWindow) {
  const trayBounds = tray.getBounds();
  const windowBounds = targetWindow.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y
  });

  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const y = Math.round(display.workArea.y + 28);

  targetWindow.setPosition(x, y, false);
}

function toggleWindow() {
  if (window && !window.isDestroyed()) {
    window.close();
    return;
  }

  const createdWindow = createWindow();
  createdWindow.loadFile(path.join(__dirname, 'index.html')).then(() => {
    if (createdWindow.isDestroyed()) return;

    positionWindow(createdWindow);
    createdWindow.show();
    createdWindow.focus();
    updateTrayTitle();
  }).catch(() => {
    if (!createdWindow.isDestroyed()) createdWindow.close();
  });
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
  refreshStateFromDisk();
  watchStateFile();
  requestStartupNotificationPermission();
  scheduleCurrentNotifications();
  updateTrayTitle();

  timerId = setInterval(updateTrayTitle, 1000);
});

app.on('before-quit', () => {
  if (timerId) clearInterval(timerId);
  fs.unwatchFile(statePath);
  clearNotificationTimers();
});

// Keep the tray app running when its on-demand popover is closed.
app.on('window-all-closed', () => {});

ipcMain.handle('state:get', () => buildViewModel());
ipcMain.handle('setup:get', () => getSetupStatus());
ipcMain.handle('setup:install', () => installStatusline());
