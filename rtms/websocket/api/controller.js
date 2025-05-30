const crypto = require('crypto')
const WebSocket = require('ws')
const { generateSignature } = require('./helper')
const { convertAudioDataToWav } = require('../../utils/audio')
const { convertTranscriptData } = require('../../utils/transcript')
const { convertVideoDataToMp4 } = require('../../utils/video')

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

/**
 * Store active WebSocket connections keyed by meeting UUID
 */
const activeConnections = new Map()

const meetingData = {
  audio: [],
  video: [],
}

/**
 * Express handler for Zoom RTMS webhook events
 */
function rtmsHandler(req, res) {
  console.log('RTMS Webhook received:', JSON.stringify(req.body, null, 2))
  const { event, payload } = req.body

  switch (event) {
    case 'endpoint.url_validation':
      return handleUrlValidation(payload, res)

    case 'meeting.rtms_started':
      return handleRtmsStarted(payload)

    case 'meeting.rtms_stopped':
      return handleRtmsStopped(payload)

    default:
      return res.sendStatus(200)
  }
}

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

/**
 * Handles RTMS start event by connecting to signaling WebSocket
 */
function handleRtmsStarted({ meeting_uuid, rtms_stream_id, server_urls }) {
  console.log('RTMS started for meeting:', meeting_uuid)
  connectToSignalingWebSocket(meeting_uuid, rtms_stream_id, server_urls)
}

/**
 * Handles RTMS stop event
 */
async function handleRtmsStopped(payload) {
  const meetingUUID = payload.meeting_uuid
  const audioBuffer = Buffer.concat(meetingData.audio) // Combine all the audio data into one buffer

  console.log('RTMS stopped for meeting:', meetingUUID)

  if (meetingData.audio.length) {
    await convertAudioDataToWav(audioBuffer, payload)
    meetingData.audio = []
  }

  if (meetingData.video.length) {
    const fullVideoBuffer = Buffer.concat(meetingData.video)
    const timestampFormatted = new Date().toISOString().replace(/[:.]/g, '-')
    await convertVideoDataToMp4(fullVideoBuffer, payload, timestampFormatted)
    meetingData.video = []
  }

  const connections = activeConnections.get(meetingUUID)
  if (!connections) return

  Object.values(connections).forEach((socket) => {
    if (socket && typeof socket.close === 'function') {
      socket.close()
    }
  })

  // cleaning up all WebSocket connections
  activeConnections.delete(meetingUUID)
  console.log(`Closed all WebSocket connections for meeting ${meetingUUID}`)
}

/**
 * Connects to Zoom signaling WebSocket server
 */
function connectToSignalingWebSocket(meetingUUID, streamId, serverUrl) {
  const ws = new WebSocket(serverUrl)

  if (!activeConnections.has(meetingUUID)) {
    activeConnections.set(meetingUUID, {})
  }
  activeConnections.get(meetingUUID).signaling = ws

  ws.on('open', () => {
    console.log('Connected to signaling server for meeting:', meetingUUID)

    const handshake = {
      msg_type: 1, // SIGNALING_HAND_SHAKE_REQ
      protocol_version: 1,
      meeting_uuid: meetingUUID,
      rtms_stream_id: streamId,
      sequence: Math.floor(Math.random() * 1e9),
      signature: generateSignature(meetingUUID, streamId, CLIENT_ID, CLIENT_SECRET),
    }

    ws.send(JSON.stringify(handshake))
    console.log('Sent signaling handshake')
  })

  ws.on('message', (data) => {
    const raw = data.toString()
    console.log('Signaling message received:', raw)

    let msg
    try {
      msg = JSON.parse(raw)
    } catch {
      console.warn('Failed to parse signaling message:', raw)
      return
    }

    handleSignalingMessage(msg, meetingUUID, streamId, ws)
  })

  ws.on('error', (err) => console.error('Signaling WebSocket error:', err))
  ws.on('close', () => {
    console.log('Signaling WebSocket closed')
    const conn = activeConnections.get(meetingUUID)
    if (conn) delete conn.signaling
  })
}

/**
 * Handles messages from signaling WebSocket
 */
function handleSignalingMessage(msg, meetingUUID, streamId, signalingSocket) {
  switch (msg.msg_type) {
    case 2: // SIGNALING_HAND_SHAKE_RESP
      // status_code 0 = OK
      if (msg.status_code === 0 && msg.media_server?.server_urls?.all) {
        connectToMediaWebSocket(msg.media_server.server_urls.all, meetingUUID, streamId, signalingSocket)
      }
      break

    case 12: // KEEP_ALIVE_REQ
      signalingSocket.send(
        JSON.stringify({
          msg_type: 13, // KEEP_ALIVE_RESP
          timestamp: msg.timestamp,
        })
      )
      console.log('Responded to signaling KEEP_ALIVE_REQ')
      break
  }
}

/**
 * Connects to Zoom media WebSocket server (audio, video, etc)
 */
function connectToMediaWebSocket(mediaUrl, meetingUUID, streamId, signalingSocket) {
  const ws = new WebSocket(mediaUrl, { rejectUnauthorized: false })

  if (activeConnections.has(meetingUUID)) {
    activeConnections.get(meetingUUID).media = ws
  }

  ws.on('open', () => {
    const handshake = {
      msg_type: 3, // DATA_HAND_SHAKE_REQ
      protocol_version: 1,
      meeting_uuid: meetingUUID,
      rtms_stream_id: streamId,
      signature: generateSignature(meetingUUID, streamId, CLIENT_ID, CLIENT_SECRET),
      media_type: 32, // 1 = Audio; 2 = Video, 8 = Transcript, 32 = All
      payload_encryption: false,
    }

    ws.send(JSON.stringify(handshake))
    console.log('Sent media handshake')
  })

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      console.log('Received Media JSON message type:', msg.msg_type)
      handleMediaMessage(msg, streamId, signalingSocket, ws, meetingUUID)
    } catch {
      console.log('Received binary media data (hex)')
    }
  })

  ws.on('error', (err) => console.error('Media WebSocket error:', err))
  ws.on('close', () => {
    console.log('Media WebSocket closed')
    const conn = activeConnections.get(meetingUUID)
    if (conn) delete conn.media
  })
}

/**
 * Handles messages from media WebSocket
 */
function handleMediaMessage(msg, streamId, signalingSocket, mediaSocket, meetingUUID) {
  switch (msg.msg_type) {
    case 4: // DATA_HAND_SHAKE_RESP
      // status_code 0 = OK
      if (msg.status_code === 0) {
        signalingSocket.send(
          JSON.stringify({
            msg_type: 7, // CLIENT_READY_ACK
            rtms_stream_id: streamId,
          })
        )
        console.log('Media handshake complete, sent CLIENT_READY_ACK')
      }
      break

    case 12: // KEEP_ALIVE_REQ
      mediaSocket.send(
        JSON.stringify({
          msg_type: 13, // KEEP_ALIVE_RESP
          timestamp: msg.timestamp,
        })
      )
      console.log('Responded to media KEEP_ALIVE_REQ')
      break

    case 14: // MEDIA_DATA_AUDIO
      if (msg.content && msg.content.data) {
        console.log('Received audio chunk')
        // Decode base64 audio data
        const audioData = Buffer.from(msg.content.data, 'base64')
        meetingData.audio.push(audioData)
      }
      break

    case 15: // MEDIA_DATA_VIDEO
      if (msg.content && msg.content.data) {
        console.log('Received video chunk')
        const chunk = Buffer.from(msg.content.data, 'base64')
        meetingData.video.push(chunk)
      }
      break

    case 17: // MEDIA_DATA_TRANSCRIPT
      if (msg.content && msg.content.data) {
        console.log('Received transcript data')
        const { user_name, data, timestamp } = msg.content
        convertTranscriptData(user_name, timestamp / 1000, data, meetingUUID)
      }
      break
  }
}

module.exports = {
  rtms: rtmsHandler,
}
