const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onStateUpdate: (cb) => ipcRenderer.on('state-update', (_e, s) => cb(s)),
  onLogEntry: (cb) => ipcRenderer.on('log-entry', (_e, e) => cb(e)),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
})
