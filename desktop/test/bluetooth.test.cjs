const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const test = require('node:test')
const { wireBluetooth } = require('../bluetooth.cjs')

test('cancels the active picker once and declines late scan updates during navigation', () => {
  const contents = Object.assign(new EventEmitter(), {
    getURL: () => 'https://tempo.example/athlete/ride/42',
    session: { setBluetoothPairingHandler() {} }
  })
  const window = Object.assign(new EventEmitter(), { webContents: contents })
  const prompts = []
  wireBluetooth(window, () => true, (_window, _state, finish) => {
    const prompt = { finish, update() {}, cancel: () => finish('') }
    prompts.push(prompt)
    return prompt
  })
  const results = []
  const scan = (tag) => contents.emit('select-bluetooth-device',
    { preventDefault() {} }, [{ deviceId: 'trainer' }], (id) => results.push([tag, id]))
  scan('start')
  scan('update')
  assert.equal(prompts.length, 1)

  contents.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false })
  scan('after-cancel')
  assert.equal(prompts.length, 1)
  prompts[0].finish('trainer')
  assert.deepEqual(results, [['update', ''], ['after-cancel', '']])

  contents.emit('did-stop-loading')
  scan('next')
  prompts[1].finish('trainer')
  assert.deepEqual(results.at(-1), ['next', 'trainer'])
})
