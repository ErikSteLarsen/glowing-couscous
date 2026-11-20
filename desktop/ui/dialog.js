const title = document.querySelector('#title')
const status = document.querySelector('#status')
const devices = document.querySelector('#devices')
const pin = document.querySelector('#pin')
const pinLabel = document.querySelector('label')
const cancel = document.querySelector('#cancel')
const submit = document.querySelector('#submit')
let mode

function updateSubmit() {
  submit.disabled = (mode === 'devices' && !devices.value) ||
    (mode === 'providePin' && !pin.value.trim())
}

window.tempoDialog.onUpdate((state) => {
  const initial = mode === undefined
  mode = state.mode
  devices.hidden = mode !== 'devices'
  pin.hidden = pinLabel.hidden = mode !== 'providePin'

  if (mode === 'devices') {
    title.textContent = 'Connect a Bluetooth device'
    const message = state.devices.length ? 'Select a device to connect.' : 'Searching for nearby devices…'
    if (status.textContent !== message) status.textContent = message
    submit.textContent = 'Connect'

    const selectedId = devices.value
    devices.replaceChildren(...state.devices.map(({ deviceId, deviceName }) =>
      new Option(deviceName || 'Unnamed Bluetooth device', deviceId)))
    devices.value = selectedId
  } else {
    title.textContent = 'Pair Bluetooth device'
    status.textContent = {
      confirm: 'Allow this Bluetooth device to pair?',
      confirmPin: `Confirm that the device displays PIN ${state.pin}.`,
      providePin: 'Enter the PIN for your Bluetooth device.'
    }[mode]
    submit.textContent = 'Pair'
  }

  updateSubmit()
  if (initial) (mode === 'providePin' ? pin : cancel).focus()
})

devices.addEventListener('change', updateSubmit)
pin.addEventListener('input', updateSubmit)
cancel.addEventListener('click', () => window.tempoDialog.submit(''))
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.tempoDialog.submit('')
})
document.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault()
  if (submit.disabled) return
  const value = { devices: devices.value, providePin: pin.value }[mode] ?? 'confirm'
  window.tempoDialog.submit(value)
})

window.tempoDialog.ready()
