const fs = require('fs')
const path = require('path')
const { saveRawVideo } = require('./utils')

/**
 * Process video data from media WebSocket
 */
function processVideoData(msg, meetingUUID, videoWriteStreams, meetingData) {
  if (msg.content && msg.content.data) {
    const chunk = Buffer.from(msg.content.data, 'base64')
    const timestamp = Date.now() // Capture current timestamp
    console.log('Received video data', chunk)

    // Extract user info if available, otherwise use default
    const userName = msg.content.user_name || msg.content.userName || 'unknown-user'

    // Save video data using streaming approach
    saveRawVideo(chunk, userName, timestamp, meetingUUID, videoWriteStreams)

    // Save frame to frontend folder for real-time display
    const frontendVideoDir = path.join(__dirname, '../../app/frontend-data/video')
    if (!fs.existsSync(frontendVideoDir)) {
      fs.mkdirSync(frontendVideoDir, { recursive: true })
    }

    // Save the latest frame as a base64 string for the frontend to display
    const base64Frame = chunk.toString('base64')
    fs.writeFileSync(path.join(frontendVideoDir, 'current-frame.txt'), base64Frame)

    // Keep old approach as backup
    meetingData.video.push(chunk)
    meetingData.videoWithTimestamps.push({ chunk, timestamp })
  }
}

module.exports = {
  processVideoData,
}
