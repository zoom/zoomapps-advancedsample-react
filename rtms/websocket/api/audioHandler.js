const fs = require('fs')
const path = require('path')

/**
 * Process audio data from media WebSocket
 */
function processAudioData(msg, meetingData) {
  if (msg.content && msg.content.data) {
    // Decode base64 audio data
    const audioData = Buffer.from(msg.content.data, 'base64')
    console.log('Received audio data', audioData)

    const frontendAudioDir = path.join(__dirname, '../frontend-data/audio')

    if (!fs.existsSync(frontendAudioDir)) {
      fs.mkdirSync(frontendAudioDir, { recursive: true })
    }
    const frontendRawFile = path.join(frontendAudioDir, 'audio.raw')

    fs.appendFileSync(frontendRawFile, audioData)

    meetingData.audio.push(audioData)
  }
}

module.exports = {
  processAudioData,
}
