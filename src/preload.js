// Where: Electron preload. What: expose a narrow state API to the renderer. Why: keep Node access out of the web UI.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cctimer', {
  getState: () => ipcRenderer.invoke('state:get'),
  getSetupStatus: () => ipcRenderer.invoke('setup:get'),
  installStatusline: () => ipcRenderer.invoke('setup:install'),
  onStateUpdate: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('state:update', listener);

    return () => ipcRenderer.removeListener('state:update', listener);
  }
});
