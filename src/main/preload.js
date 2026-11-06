const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.sendSync('load'),
  save: (json) => ipcRenderer.send('save', json),
  backup: (tag) => ipcRenderer.send('backup', tag),
  export: (json) => ipcRenderer.invoke('export', json),
  import: () => ipcRenderer.invoke('import'),
  openFolder: () => ipcRenderer.send('openFolder')
});
