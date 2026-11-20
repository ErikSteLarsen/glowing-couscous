const { BrowserWindow, dialog } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const DIALOG_FILE = path.join(__dirname, 'ui', 'dialog.html')
const DIALOG_URL = pathToFileURL(DIALOG_FILE).href

function openBluetoothDialog(parent, state, onResult) {
  const modal = new BrowserWindow({
    parent,
    modal: true,
    show: false,
    width: 440,
    height: 400,
    autoHideMenuBar: true,
    backgroundColor: '#0B0F15',
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

function wireBluetooth(window, isTrusted) {
  const contents = window.webContents
  let selection
  let pairing

  function cancelPrompts() {
    selection?.modal.cancel()
    pairing?.cancel()
  }

  contents.on('did-start-navigation', ({ isMainFrame, isSameDocument }) => {
    if (isMainFrame && !isSameDocument) cancelPrompts()
  })
  contents.on('render-process-gone', cancelPrompts)
  window.on('close', cancelPrompts)

  contents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault()
    if (!isTrusted(contents.getURL())) {
      callback('')
      return
    }

    if (!selection) {
      const modal = openBluetoothDialog(window, { mode: 'devices', devices }, (value) => {
        const selected = selection
        selection = undefined
        selected.callback(selected.devices.some(({ deviceId }) => deviceId === value) ? value : '')
      })
      selection = { modal, devices, callback }
      return
    }

    selection.devices = devices
    selection.callback = callback
    selection.modal.update({ mode: 'devices', devices })
  })

  contents.session.setBluetoothPairingHandler((details, callback) => {
    const frame = details.frame
    const modes = ['confirm', 'confirmPin', 'providePin']
    if (window.isDestroyed() || frame !== contents.mainFrame ||
        !isTrusted(frame?.url) || !modes.includes(details.pairingKind) || pairing) {
      callback({ confirmed: false })
      return
    }

    const { pairingKind: mode, pin } = details
    pairing = openBluetoothDialog(window, { mode, pin }, (value) => {
      pairing = undefined
      if (mode === 'providePin') {
        const enteredPin = value.trim()
        callback(enteredPin && Buffer.byteLength(enteredPin) <= 16
          ? { confirmed: true, pin: enteredPin }
          : { confirmed: false })
      } else {
        callback({ confirmed: value === 'confirm' })
      }
    })
  })
}

module.exports = { wireBluetooth }
