const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('launcher', {
  check: () => ipcRenderer.invoke('launcher:check'),
  update: () => ipcRenderer.invoke('launcher:update'),
  play: () => ipcRenderer.invoke('launcher:play'),
  openData: () => ipcRenderer.invoke('launcher:open-data'),
  showError: (message) => ipcRenderer.invoke('launcher:show-error', message),
  onStatus: (callback) => ipcRenderer.on('launcher:status', (_, status) => callback(status))
})
