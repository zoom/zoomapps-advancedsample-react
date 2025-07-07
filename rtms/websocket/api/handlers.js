const crypto = require('crypto')
const { ZOOM_SECRET_TOKEN } = require('../config/credentials')

/**
 * Handles Zoom's URL validation challenge
 */
function handleUrlValidation(payload, res) {
  if (!payload?.plainToken) return res.sendStatus(400)

  const encryptedToken = crypto.createHmac('sha256', ZOOM_SECRET_TOKEN).update(payload.plainToken).digest('hex')

  console.log('Responding to Zoom URL validation challenge')
  return res.json({
    plainToken: payload.plainToken,
    encryptedToken,
  })
}

module.exports = {
  handleUrlValidation,
}
