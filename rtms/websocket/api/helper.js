const crypto = require('crypto')

/**
 * Creates HMAC signature required for WebSocket handshakes
 */
function generateSignature(meetingUuid, streamId, clientId, clientSecret) {
  const message = `${clientId},${meetingUuid},${streamId}`
  return crypto.createHmac('sha256', clientSecret).update(message).digest('hex')
}

module.exports = {
  generateSignature,
}
