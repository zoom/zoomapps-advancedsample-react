const { convertTranscriptData } = require('../../utils/transcript')

/**
 * Process transcript data from media WebSocket
 */
function processTranscriptData(msg, meetingUUID) {
  if (msg.content && msg.content.data) {
    console.log('Received transcript data', Buffer.from(msg.content.data, 'base64'))
    const { user_name, data, timestamp } = msg.content
    convertTranscriptData(user_name, timestamp / 1000, data, meetingUUID, Buffer.from(msg.content.data, 'base64'))
  }
}

module.exports = {
  processTranscriptData,
}
