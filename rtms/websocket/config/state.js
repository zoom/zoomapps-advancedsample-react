/**
 * Store active WebSocket connections keyed by meeting UUID
 */
const activeConnections = new Map()

// Keep a simple map to reuse write streams for video
const videoWriteStreams = new Map()

const meetingData = {
  audio: [],
  video: [],
  videoWithTimestamps: [], // Store video chunks with timing info
}

module.exports = {
  activeConnections,
  videoWriteStreams,
  meetingData,
}
