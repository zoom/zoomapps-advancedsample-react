const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

/**
 * Converts audio data buffer to a WAV file.
 *
 * @param {Buffer} buffer - The audio data buffer to be converted.
 * @param {Object} payload - The payload containing metadata.
 * @param {string} payload.meeting_uuid - The UUID of the meeting.
 * @returns {Promise<void>} A promise that resolves when the conversion is complete.
 */
async function convertAudioDataToWav(buffer, payload) {
  console.log('==> Converting data to Wav file...')
  const audioDir = path.join(__dirname, '../app', 'data/audio') // Save to app/data/audio
  const frontendAudioDir = path.join(__dirname, '../app/frontend-data/audio')

  // Get a safe meeting ID with a date prefix
  const meetingUUID = payload.meeting_uuid || 'unknown_meeting'
  const safeMeetingUUID = meetingUUID.replace(/[^a-zA-Z0-9]/g, '_')

  // Timestamp with date and time
  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, '-') // e.g., 2025-05-15T13-42-21-123Z
  const fileName = `${timestamp}_${safeMeetingUUID}`

  // Create both directories if they don't exist
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true })
  }
  if (!fs.existsSync(frontendAudioDir)) {
    fs.mkdirSync(frontendAudioDir, { recursive: true })
  }

  const rawFile = path.join(audioDir, `${fileName}.raw`)
  const outputFile = path.join(audioDir, `${fileName}.wav`)
  const frontendOutputFile = path.join(frontendAudioDir, 'audio.wav')

  fs.writeFileSync(rawFile, buffer)
  await convertRawToWav(rawFile, outputFile, frontendOutputFile)
}

/**
 * Converts a raw audio file to a WAV file using ffmpeg.
 *
 * @param {string} inputFile - The path to the input raw audio file.
 * @param {string} outputFile - The path to the output WAV file.
 * @param {string} frontendOutputFile - The path to the frontend WAV file.
 * @returns {Promise<void>} A promise that resolves when the conversion is complete.
 */
async function convertRawToWav(inputFile, outputFile, frontendOutputFile) {
  const command = `ffmpeg -y -f s16le -ar 16000 -ac 1 -i "${inputFile}" "${outputFile}"`
  const frontendCommand = `ffmpeg -y -f s16le -ar 16000 -ac 1 -i "${inputFile}" "${frontendOutputFile}"`
  try {
    await execAsync(command)
    console.log(`WAV file saved: ${outputFile}`)
    await execAsync(frontendCommand)
    console.log(`Frontend WAV file saved: ${frontendOutputFile}`)
  } catch (err) {
    console.error(`ffmpeg conversion failed for ${inputFile}`, err)
  } finally {
    fs.unlinkSync(inputFile) // Always remove the raw file
  }
}

module.exports = { convertAudioDataToWav }
