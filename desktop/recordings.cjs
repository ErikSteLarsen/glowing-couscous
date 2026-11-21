const { randomUUID } = require('node:crypto')
const { mkdir, open, readdir, rename, rm, writeFile } = require('node:fs/promises')
const path = require('node:path')
const { isRecordingKey, sanitizeRecordingKey } = require('./recording-key.cjs')

const MAX_BYTES = 20 * 1024 * 1024
const RECORDING_FILE = /^([0-9a-f]{2,240})\.json$/

// Hex preserves case on case-insensitive filesystems and avoids reserved names.
const toHex = (value) => Buffer.from(value).toString('hex')

function checkOrigin(origin) {
  const url = typeof origin === 'string' ? URL.parse(origin) : null
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
    throw new Error('Recording origin must be an http(s) origin.')
  }
  return origin
}

/**
 * Ride checkpoints on disk, one folder per web origin, so a page only sees the
 * backups it wrote: `<directory>/origins/<hex origin>/<hex key>.json`.
 */
function createRecordingStore(directory) {
  let pending = Promise.resolve()

  function enqueue(operation) {
    const result = pending.then(operation)
    pending = result.catch(() => {})
    return result
  }

  const originDirectory = (origin) => path.join(directory, 'origins', toHex(checkOrigin(origin)))
  const recordingPath = (origin, key) =>
    path.join(originDirectory(origin), toHex(sanitizeRecordingKey(key)) + '.json')

  return {
    async save(origin, key, json) {
      const destination = recordingPath(origin, key)
      if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_BYTES) {
        throw new Error('Recording JSON must be a string of at most 20 MiB.')
      }
      JSON.parse(json)

      await enqueue(async () => {
        const folder = path.dirname(destination)
        await mkdir(folder, { recursive: true, mode: 0o700 })
        const temporary = path.join(folder, `${randomUUID()}.tmp`)
        try {
          await writeFile(temporary, json, { flag: 'wx', mode: 0o600, flush: true })
          await rename(temporary, destination)
        } finally {
          await rm(temporary, { force: true })
        }
      })
    },

    list(origin) {
      const folder = originDirectory(origin)
      return enqueue(async () => {
        await mkdir(folder, { recursive: true, mode: 0o700 })
        const recordings = []
        for (const entry of await readdir(folder, { withFileTypes: true })) {
          const match = RECORDING_FILE.exec(entry.name)
          if (!entry.isFile() || !match || match[1].length % 2 !== 0) continue
          const key = Buffer.from(match[1], 'hex').toString('utf8')
          if (!isRecordingKey(key)) continue

          const file = await open(path.join(folder, entry.name))
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

    async delete(origin, key) {
      const destination = recordingPath(origin, key)
      await enqueue(() => rm(destination, { force: true }))
    },

    /**
     * Moves backups written before origin scoping (loose `<hex key>.json` files)
     * to `origin`'s folder, or to `legacy/`, which no origin lists, when the
     * origin is unknown. Files are moved, never deleted or overwritten.
     */
    migrateLegacy(origin) {
      const target = origin ? originDirectory(origin) : path.join(directory, 'legacy')
      return enqueue(async () => {
        let entries
        try {
          entries = await readdir(directory, { withFileTypes: true })
        } catch (error) {
          if (error.code === 'ENOENT') return 0
          throw error
        }
        const files = entries.filter((entry) => entry.isFile() && RECORDING_FILE.test(entry.name))
        if (files.length === 0) return 0
        const legacy = path.join(directory, 'legacy')
        let moved = 0
        for (const { name } of files) {
          for (const folder of new Set([target, legacy])) {
            await mkdir(folder, { recursive: true, mode: 0o700 })
            if ((await readdir(folder)).includes(name)) continue
            await rename(path.join(directory, name), path.join(folder, name))
            moved += 1
            break
          }
        }
        return moved
      })
    }
  }
}

module.exports = { createRecordingStore }
