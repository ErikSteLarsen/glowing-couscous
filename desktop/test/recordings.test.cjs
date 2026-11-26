const assert = require('node:assert/strict')
const { mkdtemp, readdir, readFile, rm, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { createRecordingStore } = require('../recordings.cjs')

const PROD = 'https://wattonaut.example'
const LOCAL = 'http://localhost:3000'
const hex = (value) => Buffer.from(value).toString('hex')

async function tempDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tempo-ride-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

test('reopens the last complete recording and ignores temporary files', async (t) => {
  const directory = await tempDirectory(t)
  const store = createRecordingStore(directory)

  await Promise.all([
    store.save(PROD, 'Ride', '{"elapsed":10}'),
    store.save(PROD, 'Ride', '{"elapsed":20}'),
    store.save(PROD, 'ride', '{"elapsed":5}')
  ])
  const folder = path.join(directory, 'origins', hex(PROD))
  assert.equal((await readdir(folder)).length, 2)
  await writeFile(path.join(folder, 'interrupted.tmp'), '{"elapsed":')
  await assert.rejects(store.save(PROD, 'Ride', '{'), SyntaxError)
  await assert.rejects(store.save(PROD, 'Ride', '"' + 'é'.repeat(10 * 1024 * 1024) + '"'), /20 MiB/)

  const reopened = createRecordingStore(directory)
  const recordings = await reopened.list(PROD)
  assert.deepEqual(recordings.map(({ key, json }) => [key, json]).sort(), [
    ['Ride', '{"elapsed":20}'], ['ride', '{"elapsed":5}']
  ])
  assert.ok(recordings.every(({ savedAt }) => new Date(savedAt).toISOString() === savedAt))
  await reopened.delete(PROD, 'Ride')
  await reopened.delete(PROD, 'Ride')
  assert.deepEqual((await reopened.list(PROD)).map(({ key }) => key), ['ride'])
})

test('keeps each origin\'s checkpoints separate', async (t) => {
  const store = createRecordingStore(await tempDirectory(t))
  const key = 'tempo:ride:v1:42'
  await store.save(LOCAL, key, '{"from":"local"}')
  await store.save(PROD, key, '{"from":"prod"}')
  await store.save(LOCAL, 'tempo:ride:v1:7', '{}')

  assert.deepEqual((await store.list(PROD)).map(({ key, json }) => [key, json]), [[key, '{"from":"prod"}']])
  assert.equal((await store.list(LOCAL)).length, 2)
  assert.deepEqual(await store.list('https://other.example'), [])

  await store.delete(PROD, 'tempo:ride:v1:7')
  assert.equal((await store.list(LOCAL)).length, 2)
  await store.delete(PROD, key)
  assert.deepEqual(await store.list(PROD), [])
  assert.deepEqual((await store.list(LOCAL)).map(({ key }) => key).sort(), ['tempo:ride:v1:42', 'tempo:ride:v1:7'])
})

test('rejects values that are not a bare http(s) origin', async (t) => {
  const store = createRecordingStore(await tempDirectory(t))
  for (const origin of [undefined, '', 'file://', `${PROD}/athlete`, 'tempo-ride://open', '../x']) {
    await assert.rejects(store.save(origin, 'Ride', '{}'), /origin/)
    assert.throws(() => store.list(origin), /origin/)
  }
})

test('moves legacy backups to the saved site only, without deleting files', async (t) => {
  const directory = await tempDirectory(t)
  const legacyName = hex('tempo:ride:v1:5') + '.json'
  await writeFile(path.join(directory, legacyName), '{"legacy":true}')
  await writeFile(path.join(directory, 'notes.txt'), 'keep')
  const store = createRecordingStore(directory)

  assert.equal(await store.migrateLegacy(LOCAL), 1)
  assert.deepEqual((await store.list(LOCAL)).map(({ json }) => json), ['{"legacy":true}'])
  assert.deepEqual(await store.list(PROD), [])
  assert.equal(await readFile(path.join(directory, 'notes.txt'), 'utf8'), 'keep')
  assert.equal(await store.migrateLegacy(LOCAL), 0)
})

test('parks legacy backups where no origin lists them when no site is saved', async (t) => {
  const directory = await tempDirectory(t)
  const name = hex('Ride') + '.json'
  await writeFile(path.join(directory, name), '{"a":1}')
  const store = createRecordingStore(directory)

  assert.equal(await store.migrateLegacy(undefined), 1)
  assert.equal(await readFile(path.join(directory, 'legacy', name), 'utf8'), '{"a":1}')
  assert.deepEqual(await store.list(PROD), [])
})

test('never overwrites a scoped backup during migration', async (t) => {
  const directory = await tempDirectory(t)
  const store = createRecordingStore(directory)
  await store.save(PROD, 'Ride', '{"new":true}')
  const name = hex('Ride') + '.json'
  await writeFile(path.join(directory, name), '{"old":true}')

  assert.equal(await store.migrateLegacy(PROD), 1)
  assert.deepEqual((await store.list(PROD)).map(({ json }) => json), ['{"new":true}'])
  assert.equal(await readFile(path.join(directory, 'legacy', name), 'utf8'), '{"old":true}')
})

test('migrating an empty or missing store is a no-op', async (t) => {
  const directory = await tempDirectory(t)
  assert.equal(await createRecordingStore(path.join(directory, 'missing')).migrateLegacy(PROD), 0)
  assert.equal(await createRecordingStore(directory).migrateLegacy(PROD), 0)
})
