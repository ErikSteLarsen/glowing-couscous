function wireBluetooth(window, isTrusted, openDesktopDialog = require('./dialog.cjs').openDesktopDialog) {
  const contents = window.webContents
  let selection
  let pairing
  let navigating = false
  let closing = false

  function cancelPrompts() {
    selection?.modal?.cancel()
    pairing?.cancel()
  }

  contents.on('did-start-navigation', ({ isMainFrame, isSameDocument }) => {
    if (!isMainFrame || isSameDocument) return
    navigating = true
    cancelPrompts()
  })
  contents.on('did-stop-loading', () => { navigating = false })
  contents.on('render-process-gone', () => {
    navigating = true
    cancelPrompts()
  })
  window.on('close', () => {
    closing = true
    cancelPrompts()
  })

  contents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault()
    if (closing || navigating || !isTrusted(contents.getURL())) {
      callback('')
      return
    }

    if (selection) {
      selection.devices = devices
      selection.callback = callback
      selection.modal?.update({ mode: 'devices', devices })
      return
    }

    const prompt = { devices, callback, modal: null }
    selection = prompt
    function finish(value) {
      if (selection !== prompt) return
      selection = undefined
      prompt.callback(prompt.devices.some(({ deviceId }) => deviceId === value) ? value : '')
    }
    try {
      prompt.modal = openDesktopDialog(window, { mode: 'devices', devices }, finish)
    } catch {
      finish('')
    }
  })

  contents.session.setBluetoothPairingHandler((details, callback) => {
    const frame = details.frame
    const modes = ['confirm', 'confirmPin', 'providePin']
    if (closing || navigating || window.isDestroyed() || frame !== contents.mainFrame ||
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
