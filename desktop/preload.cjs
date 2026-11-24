const { contextBridge, ipcRenderer } = require('electron')

if (process.isMainFrame) {
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    const prefix = '--tempo-desktop-version='
    contextBridge.exposeInMainWorld('tempoDesktop', {
      isDesktop: true,
      version: process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length),
      saveRecording: (key, json) => ipcRenderer.invoke('recording:save', key, json),
      listRecordings: () => ipcRenderer.invoke('recording:list'),
      deleteRecording: (key) => ipcRenderer.invoke('recording:delete', key),
      youtube: {
        open: () => ipcRenderer.invoke('youtube:open'),
        onVideo: (callback) => {
          if (typeof callback !== 'function') throw new TypeError('onVideo needs a callback.')
          const listener = (_event, video) => callback({ url: String(video.url), startSec: Number(video.startSec) })
          ipcRenderer.on('youtube:video', listener)
          return () => { ipcRenderer.removeListener('youtube:video', listener) }
        }
      }
    })
  } else if (location.protocol === 'file:' && location.pathname.endsWith('/start.html')) {
    contextBridge.exposeInMainWorld('tempoSetup', {
      getSetup: () => ipcRenderer.invoke('setup:get'),
      openSite: (url) => ipcRenderer.invoke('setup:open-site', url)
    })
  }
}
