const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tracker', {
  loadProgress: () => ipcRenderer.invoke('progress:load'),
  saveProgress: (data) => ipcRenderer.invoke('progress:save', data),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (data) => ipcRenderer.invoke('settings:save', data),
  fetchManifest: (url) => ipcRenderer.invoke('manifest:fetch', url),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
})
