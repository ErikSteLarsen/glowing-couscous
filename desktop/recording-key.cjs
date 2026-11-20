const MAX_KEY_LENGTH = 120

function sanitizeRecordingKey(key) {
  if (typeof key !== 'string' || key.length === 0 || key.length > MAX_KEY_LENGTH ||
      /[^a-zA-Z0-9_-]/.test(key)) {
    throw new Error('Recording key must contain 1 to 120 letters, digits, underscores or hyphens.')
  }
  return key
}

module.exports = { sanitizeRecordingKey }
