const { contextBridge, ipcRenderer } = require('electron')

if (process.isMainFrame && location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('tempoDialog', {
    onUpdate: (listener) => {
      ipcRenderer.on('dialog:update', (_event, state) => listener(state))
    },
    ready: () => ipcRenderer.send('dialog:ready'),
    submit: (value) => ipcRenderer.send('dialog:submit', value)
  })
}
