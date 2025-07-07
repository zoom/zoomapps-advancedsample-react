const { promisify } = require('util')
const { exec } = require('child_process')
const execAsync = promisify(exec)
const fs = require('fs')
const path = require('path')

function sanitizeFileName(name) {
  return name.replace(/[<>:"\/\\|?*=\s]/g, '_')
}

/**
 * Convert individual H.264 file to MP4
 */
async function convertH264ToMp4(inputFile, outputFile) {
  // Use FFmpeg's automatic stream analysis with proper H.264 handling
  const command = `ffmpeg -y -f h264 -i "${inputFile}" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -vsync cfr -r 9 -movflags +faststart "${outputFile}"`
  try {
    await execAsync(command)
    console.log(`✅ MP4 file saved: ${outputFile}`)
    // Delete the original H.264 file on success
    fs.unlinkSync(inputFile)
  } catch (err) {}
}

/**
 * Save raw video data to user-specific H.264 files
 */
function saveRawVideo(buffer, userName, timestamp, meetingUuid, videoWriteStreams) {
  const safeUserName = userName ? sanitizeFileName(userName) : 'default-view'
  const safeMeetingUuid = sanitizeFileName(meetingUuid)
  const outputDir = path.join(__dirname, '../app/data/video', safeMeetingUuid)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const filePath = path.join(outputDir, `${safeUserName}.h264`)

  let writeStream = videoWriteStreams.get(filePath)
  if (!writeStream) {
    writeStream = fs.createWriteStream(filePath, { flags: 'a' }) // append mode
    videoWriteStreams.set(filePath, writeStream)
  }

  writeStream.write(buffer)
  console.log(`🎥 Video chunk written to ${filePath}`)
}

module.exports = {
  sanitizeFileName,
  convertH264ToMp4,
  saveRawVideo,
}
