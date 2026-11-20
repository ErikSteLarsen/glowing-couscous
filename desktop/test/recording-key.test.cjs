const assert = require('node:assert/strict')
const test = require('node:test')
const { sanitizeRecordingKey } = require('../recording-key.cjs')

test('preserves allowed recording keys byte for byte', () => {
  for (const key of ['session_ABC-123', 'CON', 'x'.repeat(120)]) {
    assert.equal(sanitizeRecordingKey(key), key)
  }
})

test('rejects unsafe keys without changing them into another valid key', () => {
  for (const key of ['', '../ride', 'dir/ride', 'dir\\ride', 'ride.json', 'ride\n', 'ride\0',
    'ride space', 'é', 'x'.repeat(121), undefined, 42]) {
    assert.throws(() => sanitizeRecordingKey(key), /Recording key/)
  }
})
