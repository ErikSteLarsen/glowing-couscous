/** How long the ride page has to confirm it took a video. */
const ACK_TIMEOUT_MS = 1500

/**
 * Hands a video from a `tempo-ride://video` link to the trusted Wattonaut page as `youtube:video`
 * (`{ url, startSec, id }`). Resolves true once that page confirms with `youtube:video-ack`, and
 * false when no ride takes it. A newer video supersedes one still waiting.
 */
function createVideoHandOff({ getTempoWindow, isTrusted, ackTimeoutMs = ACK_TIMEOUT_MS }) {
  let lastId = 0
  let pending = null

  return {
    send(video) {
      pending?.settle(false)
      const tempo = getTempoWindow()
      if (!tempo || tempo.isDestroyed() || !isTrusted(tempo.webContents.getURL())) return Promise.resolve(false)

      const id = ++lastId
      return new Promise((resolve) => {
        const settle = (took) => {
          clearTimeout(timer)
          if (pending?.id === id) pending = null
          resolve(took)
        }
        const timer = setTimeout(() => settle(false), ackTimeoutMs)
        pending = { id, settle }
        tempo.webContents.send('youtube:video', { ...video, id })
      })
    },
    ack(id) {
      if (pending?.id === id) pending.settle(true)
    }
  }
}

module.exports = { createVideoHandOff }
