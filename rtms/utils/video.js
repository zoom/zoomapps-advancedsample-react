const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const { exec } = require('child_process')
const execAsync = promisify(exec)

/**
 * Converts raw H.264 video buffer into .mp4 format using FFmpeg.
 *
 * @param {Buffer} buffer - The raw H.264 video data buffer.
 * @param {Object} payload - An object containing metadata about the video.
 * @param {string} payload.meeting_uuid - The unique identifier for the meeting.
 * @param {string} timestampFormatted - A formatted timestamp string used for naming the output file.
 * @returns {Promise<void>} A promise that resolves when the conversion is complete.
 */
async function convertVideoDataToMp4(buffer, payload, timestampFormatted) {
  console.log('Converting video data to MP4...')
  const videoDir = path.join(__dirname, '../app', 'data/video')
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true })
  }
  const meetingUUID = payload.meeting_uuid || 'unknown_meeting'
  const safeMeetingId = meetingUUID.replace(/[^a-zA-Z0-9]/g, '_')
  const fileName = `${timestampFormatted}_${safeMeetingId}`
  const rawFile = path.join(videoDir, `${fileName}.h264`)
  const outputFile = path.join(videoDir, `${fileName}.mp4`)
  fs.writeFileSync(rawFile, buffer)
  console.log(`Saved raw .h264: ${rawFile}`)
  await convertRawH264ToMp4(rawFile, outputFile)
}

/**
 * Converts a raw H.264 video file to MP4 format using FFmpeg.
 *
 * @param {string} inputFile - The path to the input raw H.264 file.
 * @param {string} outputFile - The path to the output MP4 file.
 * @returns {Promise<void>} A promise that resolves when the conversion is complete.
 */
async function convertRawH264ToMp4(inputFile, outputFile) {
  // Re-encode to ensure compatibility with partial streams
  const command = `ffmpeg -y -framerate 6 -i "${inputFile}" -c:v libx264 -preset fast -pix_fmt yuv420p "${outputFile}"`
  try {
    await execAsync(command)
    console.log(`MP4 file saved: ${outputFile}`)
    // Only delete raw file on success
    fs.unlinkSync(inputFile)
  } catch (err) {
    console.error(`FFmpeg conversion failed: ${err.message}`)
  }
}

module.exports = {
  convertVideoDataToMp4,
}
