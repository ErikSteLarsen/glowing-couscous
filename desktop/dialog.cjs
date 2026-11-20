const { BrowserWindow } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const DIALOG_FILE = path.join(__dirname, 'ui', 'dialog.html')
const DIALOG_URL = pathToFileURL(DIALOG_FILE).href

function openDesktopDialog(parent, state, onResult) {
  const modal = new BrowserWindow({
    parent,
    modal: true,
    show: false,
    width: 440,
    height: state.mode === 'devices' ? 470 : 320,
    autoHideMenuBar: true,
    backgroundColor: '#0e1010',
    webPreferences: {
      preload: path.join(__dirname, 'dialog-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: false
    }
  })
  const contents = modal.webContents
  let ready = false
  let finished = false

  function finish(value) {
    if (finished) return
    finished = true
    if (!modal.isDestroyed()) modal.destroy()
    onResult(value)
  }

  function isDialogPage(event) {
    return event.senderFrame === contents.mainFrame && event.senderFrame?.url === DIALOG_URL
  }

  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-frame-navigate', (event) => event.preventDefault())
  contents.on('will-redirect', (event) => event.preventDefault())
  contents.on('render-process-gone', () => finish(''))
  contents.ipc.on('dialog:ready', (event) => {
    if (!isDialogPage(event)) return
    ready = true
    contents.send('dialog:update', state)
    modal.show()
  })
  contents.ipc.on('dialog:submit', (event, value) => {
    if (isDialogPage(event) && typeof value === 'string') finish(value)
  })
  modal.once('closed', () => finish(''))
  modal.loadFile(DIALOG_FILE).catch(() => finish(''))

  return {
    update(nextState) {
      state = nextState
      if (ready && !finished) contents.send('dialog:update', state)
    },
    cancel: () => finish('')
  }
}

module.exports = { openDesktopDialog }
