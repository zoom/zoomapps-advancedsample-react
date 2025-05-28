const fs = require('fs')
const path = require('path')
let sessionStartTime = null

/**
 * Sanitizes a filename by replacing non-alphanumeric characters with underscores.
 *
 * @param {string} name - The original filename to be sanitized.
 * @returns {string} The sanitized filename.
 */
function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '_')
}

/**
 * Checks if a given timestamp is likely an absolute Unix timestamp.
 *
 * @param {number} ts - The timestamp to check.
 * @returns {boolean} True if the timestamp is likely an absolute Unix timestamp, false otherwise.
 */
function isLikelyAbsoluteTimestamp(ts) {
  // Anything in year 2000+ is likely a real timestamp
  return ts > 1_000_000_000_000 // e.g., 2001-09-09T01:46:40.000Z
}

/**
 * Converts transcript data into a formatted string and appends it to a transcript file.
 *
 * @param {string} userName - The username associated with the transcript entry.
 * @param {number} timestamp - The timestamp of the entry, either as an absolute Unix timestamp or an offset in milliseconds.
 * @param {string} data - The transcript text to be recorded.
 * @param {string} meetingUUID - The unique identifier of the meeting.
 * @returns {void} This function does not return a value.
 */
function convertTranscriptData(userName, timestamp, data, meetingUUID) {
  console.log('Writing transcript line...')
  // Ensure transcript folder exists
  const dataFolder = path.join(__dirname, '../app/data/transcript')

  if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true })
  }

  // Build file path
  const safeMeetingId = sanitizeFileName(meetingUUID)
  const today = new Date().toISOString().split('T')[0]
  const fileName = `${today}_${safeMeetingId}.txt`
  const txtFilePath = path.join(dataFolder, fileName)

  // Determine correct timestamp
  let actualTime

  if (isLikelyAbsoluteTimestamp(timestamp)) {
    // Case: already an absolute timestamp
    actualTime = new Date(timestamp)
  } else {
    // Case: it's an offset
    if (!sessionStartTime) {
      sessionStartTime = Date.now()
      console.log(`sessionStartTime not set — using now: ${sessionStartTime}`)
    }
    actualTime = new Date(sessionStartTime + timestamp)
  }
  const readableTime = actualTime.toISOString()
  const txtLine = `[${readableTime}] ${userName}: ${data}\n`
  fs.appendFileSync(txtFilePath, txtLine)
}

module.exports = { convertTranscriptData }
