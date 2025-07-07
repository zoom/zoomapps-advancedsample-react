const WebSocket = require('ws')
const { generateSignature } = require('./helper')
const { CLIENT_ID, CLIENT_SECRET, ZOOM_SECRET_TOKEN } = require('../config/credentials')
const { activeConnections, videoWriteStreams, meetingData } = require('../config/state')
const { handleUrlValidation } = require('./handlers')
const { processAudioData } = require('./audioHandler')
const { processVideoData } = require('./videoHandler')
const { processTranscriptData } = require('./transcriptHandler')
const { handleRtmsStopped } = require('./rtmsHandlers')

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
 * Handles RTMS start event by connecting to signaling WebSocket
 */
function handleRtmsStarted({ meeting_uuid, rtms_stream_id, server_urls }) {
  console.log('RTMS started for meeting:', meeting_uuid)

  const ws = new WebSocket(server_urls)

  if (!activeConnections.has(meeting_uuid)) {
    activeConnections.set(meeting_uuid, {})
  }
  activeConnections.get(meeting_uuid).signaling = ws

  ws.on('open', () => {
    console.log('Connected to signaling server for meeting:', meeting_uuid)

    const handshake = {
      msg_type: 1, // SIGNALING_HAND_SHAKE_REQ
      protocol_version: 1,
      meeting_uuid: meeting_uuid,
      rtms_stream_id: rtms_stream_id,
      sequence: Math.floor(Math.random() * 1e9),
      signature: generateSignature(meeting_uuid, rtms_stream_id, CLIENT_ID, CLIENT_SECRET),
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

    // Handle signaling messages
    switch (msg.msg_type) {
      case 2: // SIGNALING_HAND_SHAKE_RESP
        if (msg.status_code === 0 && msg.media_server?.server_urls?.all) {
          connectToMediaWebSocket(msg.media_server.server_urls.all, meeting_uuid, rtms_stream_id, ws)
        }
        break

      case 12: // KEEP_ALIVE_REQ
        ws.send(
          JSON.stringify({
            msg_type: 13, // KEEP_ALIVE_RESP
            timestamp: msg.timestamp,
          })
        )
        console.log('Responded to signaling KEEP_ALIVE_REQ')
        break
    }
  })

  ws.on('error', (err) => console.error('Signaling WebSocket error:', err))
  ws.on('close', () => {
    console.log('Signaling WebSocket closed')
    const conn = activeConnections.get(meeting_uuid)
    if (conn) delete conn.signaling
  })
}

/**
 * Handles messages from media WebSocket
 */
function handleMediaMessage(msg, streamId, signalingSocket, mediaSocket, meetingUUID) {
  switch (msg.msg_type) {
    case 4: // DATA_HAND_SHAKE_RESP
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
      processAudioData(msg, meetingData)
      break

    case 15: // MEDIA_DATA_VIDEO
      processVideoData(msg, meetingUUID, videoWriteStreams, meetingData)
      break

    case 17: // MEDIA_DATA_TRANSCRIPT
      processTranscriptData(msg, meetingUUID)
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

module.exports = {
  rtms: rtmsHandler,
}
