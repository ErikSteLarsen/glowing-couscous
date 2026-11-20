const { randomUUID } = require('node:crypto')
const { mkdir, open, readdir, rename, rm, writeFile } = require('node:fs/promises')
const path = require('node:path')
const { sanitizeRecordingKey } = require('./recording-key.cjs')

const MAX_BYTES = 20 * 1024 * 1024
const RECORDING_FILE = /^([0-9a-f]{2,240})\.json$/

function createRecordingStore(directory) {
  let pending = Promise.resolve()

  function enqueue(operation) {
    const result = pending.then(operation)
    pending = result.catch(() => {})
    return result
  }

  function recordingPath(key) {
    // Hex preserves case on case-insensitive filesystems and avoids reserved names.
    return path.join(directory, Buffer.from(sanitizeRecordingKey(key)).toString('hex') + '.json')
  }

  return {
    async save(key, json) {
      const destination = recordingPath(key)
      if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_BYTES) {
        throw new Error('Recording JSON must be a string of at most 20 MiB.')
      }
      JSON.parse(json)

      await enqueue(async () => {
        await mkdir(directory, { recursive: true, mode: 0o700 })
        const temporary = path.join(directory, `${randomUUID()}.tmp`)
        try {
          await writeFile(temporary, json, { flag: 'wx', mode: 0o600, flush: true })
          await rename(temporary, destination)
        } finally {
          await rm(temporary, { force: true })
        }
      })
    },

    list() {
      return enqueue(async () => {
        await mkdir(directory, { recursive: true, mode: 0o700 })
        const recordings = []
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const match = RECORDING_FILE.exec(entry.name)
          if (!entry.isFile() || !match || match[1].length % 2 !== 0) continue
          const key = Buffer.from(match[1], 'hex').toString('utf8')
          if (/[^a-zA-Z0-9_-]/.test(key)) continue

          const file = await open(path.join(directory, entry.name))
          try {
            const info = await file.stat()
            if (info.size > MAX_BYTES) continue
            recordings.push({
              key,
              savedAt: info.mtime.toISOString(),
              json: await file.readFile('utf8')
            })
          } finally {
            await file.close()
          }
        }
        return recordings
      })
    },

    async delete(key) {
      const destination = recordingPath(key)
      await enqueue(() => rm(destination, { force: true }))
    }
  }
}

module.exports = { createRecordingStore }
