const MAX_KEY_LENGTH = 120

function isRecordingKey(key) {
  return typeof key === 'string' && key.length > 0 && key.length <= MAX_KEY_LENGTH &&
    (!/[^a-zA-Z0-9_-]/.test(key) || /^tempo:ride:v1:[1-9][0-9]*(?![\s\S])/.test(key))
}

function sanitizeRecordingKey(key) {
  if (!isRecordingKey(key)) {
    throw new Error('Recording key must be a Tempo ride checkpoint key or contain 1 to 120 letters, digits, underscores or hyphens.')
  }
  return key
}

module.exports = { isRecordingKey, sanitizeRecordingKey }
