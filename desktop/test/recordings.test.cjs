const assert = require('node:assert/strict')
const { mkdtemp, readdir, rm, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { createRecordingStore } = require('../recordings.cjs')

test('reopens the last complete recording and ignores temporary files', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tempo-ride-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const store = createRecordingStore(directory)

  await Promise.all([
    store.save('Ride', '{"elapsed":10}'),
    store.save('Ride', '{"elapsed":20}'),
    store.save('ride', '{"elapsed":5}')
  ])
  assert.equal((await readdir(directory)).length, 2)
  await writeFile(path.join(directory, 'interrupted.tmp'), '{"elapsed":')
  await assert.rejects(store.save('Ride', '{'), SyntaxError)
  await assert.rejects(store.save('Ride', '"' + 'é'.repeat(10 * 1024 * 1024) + '"'), /20 MiB/)

  const reopened = createRecordingStore(directory)
  const recordings = await reopened.list()
  assert.deepEqual(recordings.map(({ key, json }) => [key, json]).sort(), [
    ['Ride', '{"elapsed":20}'], ['ride', '{"elapsed":5}']
  ])
  assert.ok(recordings.every(({ savedAt }) => new Date(savedAt).toISOString() === savedAt))
  await reopened.delete('Ride')
  await reopened.delete('Ride')
  assert.deepEqual((await reopened.list()).map(({ key }) => key), ['ride'])
})
