const fs = require('fs')
const path = require('path')
const { convertAudioDataToWav } = require('../../utils/audio')
const { convertVideoDataToMp4 } = require('../../utils/video')
const { sanitizeFileName, convertH264ToMp4 } = require('./utils')
const { activeConnections, videoWriteStreams, meetingData } = require('../config/state')

/**
 * Handles RTMS stop event
 */
async function handleRtmsStopped(payload) {
  const meetingUUID = payload.meeting_uuid
  const audioBuffer = Buffer.concat(meetingData.audio)

  console.log('RTMS stopped for meeting:', meetingUUID)

  // Close all video write streams for this meeting
  const safeMeetingUuid = sanitizeFileName(meetingUUID)
  const videoDir = path.join(__dirname, '../app/data/video', safeMeetingUuid)

  // Close write streams
  for (const [filePath, stream] of videoWriteStreams.entries()) {
    if (filePath.includes(safeMeetingUuid)) {
      stream.end()
      videoWriteStreams.delete(filePath)
    }
  }

  // Convert individual H.264 files to MP4
  if (fs.existsSync(videoDir)) {
    const h264Files = fs.readdirSync(videoDir).filter((file) => file.endsWith('.h264'))

    for (const h264File of h264Files) {
      const inputPath = path.join(videoDir, h264File)
      const outputPath = path.join(videoDir, h264File.replace('.h264', '.mp4'))

      console.log(`Converting ${h264File} to MP4...`)
      await convertH264ToMp4(inputPath, outputPath)
    }
  }

  // Process audio data
  if (meetingData.audio.length) {
    await convertAudioDataToWav(audioBuffer, payload)
    meetingData.audio = []
  }

  // Process video data
  if (meetingData.video.length) {
    const fullVideoBuffer = Buffer.concat(meetingData.video)
    const timestampFormatted = new Date().toISOString().replace(/[:.]/g, '-')
    await convertVideoDataToMp4(fullVideoBuffer, payload, timestampFormatted, meetingData.videoWithTimestamps)
    meetingData.video = []
    meetingData.videoWithTimestamps = []
  }

  // Clean up WebSocket connections
  const connections = activeConnections.get(meetingUUID)
  if (connections) {
    Object.values(connections).forEach((socket) => {
      if (socket && typeof socket.close === 'function') {
        socket.close()
      }
    })
    activeConnections.delete(meetingUUID)
    console.log(`Closed all WebSocket connections for meeting ${meetingUUID}`)
  }
}

module.exports = {
  handleRtmsStopped,
}
