const title = document.querySelector('#title')
const origin = document.querySelector('#origin')
const status = document.querySelector('#status')
const picker = document.querySelector('#picker')
const signalNote = document.querySelector('#signal-note')
const devices = document.querySelector('#devices')
const pin = document.querySelector('#pin')
const pinLabel = document.querySelector('label[for="pin"]')
const cancel = document.querySelector('#cancel')
const submit = document.querySelector('#submit')
const deviceRows = new Map()
let mode

function selectedDevice() {
  return devices.querySelector('input:checked')
}

function updateSubmit() {
  submit.disabled = (mode === 'devices' && !selectedDevice()) ||
    (mode === 'providePin' && !pin.value.trim())
}

function deviceType(name) {
  if (/cadence|\brpm\b|\bcsc\b/i.test(name)) return 'Likely cadence sensor'
  if (/heart|\bhrm?\b|polar h[0179]|tickr|verity|wahoo trackr|\bcoospo\s*h\d/i.test(name)) {
    return 'Likely heart-rate sensor'
  }
  if (/trainer|kickr|tacx|neo\b|direto|suito|drivo|zwift hub|\bcore\b|wattbike|\bsaris\b/i.test(name)) {
    return 'Likely trainer'
  }
  return 'Bluetooth device'
}

function updateDevices(list) {
  const deviceIds = new Set(list.map(({ deviceId }) => deviceId))
  let restoreFocus = false
  for (const [id, row] of deviceRows) {
    if (deviceIds.has(id)) continue
    if (document.activeElement === row.radio) restoreFocus = true
    row.label.remove()
    deviceRows.delete(id)
  }

  for (const { deviceId, deviceName } of list) {
    if (!deviceRows.has(deviceId)) {
      const label = document.createElement('label')
      label.className = 'device-row'
      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = 'device'
      radio.value = deviceId
      const description = document.createElement('span')
      const name = document.createElement('strong')
      const type = document.createElement('span')
      type.className = 'hint'
      description.append(name, type)
      label.append(radio, description)
      devices.append(label)
      deviceRows.set(deviceId, { label, radio, name, type })
    }
    const { name, type } = deviceRows.get(deviceId)
    const displayName = deviceName?.trim() || 'Unnamed Bluetooth device'
    const hint = deviceType(displayName)
    if (name.textContent !== displayName) name.textContent = displayName
    if (type.textContent !== hint) type.textContent = hint
  }

  if (restoreFocus) (selectedDevice() ?? devices.querySelector('input') ?? cancel).focus()
}

window.wattonautDialog.onUpdate((state) => {
  const initial = mode === undefined
  mode = state.mode
  picker.hidden = mode !== 'devices'
  origin.hidden = mode !== 'trust'
  pin.hidden = pinLabel.hidden = mode !== 'providePin'

  if (mode === 'devices') {
    title.textContent = 'Connect a Bluetooth device'
    const message = state.devices.length
      ? 'Choose a device to connect.'
      : 'Searching for nearby devices. Wake your trainer or sensor to make it discoverable.'
    if (status.textContent !== message) status.textContent = message
    signalNote.hidden = state.devices.length === 0
    updateDevices(state.devices)
    submit.textContent = 'Connect'
  } else if (mode === 'trust') {
    title.textContent = 'Trust this Wattonaut site?'
    origin.textContent = state.origin
    status.textContent = 'This site can ask to connect to Bluetooth devices and access your local ride backups. Continue if you recognize the address.'
    submit.textContent = 'Trust and open'
  } else {
    title.textContent = 'Pair Bluetooth device'
    status.textContent = {
      confirm: 'Allow this Bluetooth device to pair?',
      confirmPin: `Confirm that the device displays PIN ${state.pin}.`,
      providePin: 'Enter the PIN for your Bluetooth device.'
    }[mode]
    submit.textContent = 'Pair'
  }

  document.title = title.textContent
  updateSubmit()
  if (initial) (mode === 'providePin' ? pin : cancel).focus()
})

devices.addEventListener('change', updateSubmit)
pin.addEventListener('input', updateSubmit)
cancel.addEventListener('click', () => window.wattonautDialog.submit(''))
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.wattonautDialog.submit('')
})
document.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault()
  if (submit.disabled) return
  const value = { devices: selectedDevice()?.value, providePin: pin.value }[mode] ?? 'confirm'
  window.wattonautDialog.submit(value)
})

window.wattonautDialog.ready()
