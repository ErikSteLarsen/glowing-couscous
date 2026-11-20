const { openDesktopDialog } = require('./dialog.cjs')

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
      const modal = openDesktopDialog(window, { mode: 'devices', devices }, (value) => {
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
    pairing = openDesktopDialog(window, { mode, pin }, (value) => {
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
