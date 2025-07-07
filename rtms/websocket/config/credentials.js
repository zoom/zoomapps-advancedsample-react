/**
 * App build flow credentials from https://marketplace.zoom.us/
 * Add them to .env file
 */

// OAuth Client ID
const CLIENT_ID = process.env.ZM_RTMS_CLIENT
// OAuth Client Secret
const CLIENT_SECRET = process.env.ZM_RTMS_SECRET
// OAuth Client Secret
const ZOOM_SECRET_TOKEN = process.env.ZM_RTMS_SECRET

module.exports = {
  CLIENT_ID,
  CLIENT_SECRET,
  ZOOM_SECRET_TOKEN,
}
