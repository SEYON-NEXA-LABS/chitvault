const { contextBridge, ipcRenderer } = require('electron')

// Expose safe APIs to the renderer (Next.js app)
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  // Open external URLs in browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
})
