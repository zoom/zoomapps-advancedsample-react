const rtms = require('@zoom/rtms').default
const { convertAudioDataToWav } = require('../utils/audio.js')
const { convertTranscriptData } = require('../utils/transcript.js')
const { convertVideoDataToMp4 } = require('../utils/video.js')

const meetingData = {
  audio: [],
  video: [],
}

rtms.onWebhookEvent(async ({ event, payload }) => {
  console.log('Incoming webhook', event)

  if (event === 'meeting.rtms_started') {
    const client = new rtms.Client()

    client.onAudioData((data, timestamp, metadata) => {
      console.log('onAudioData received at time:', timestamp)
      console.log('onAudioData received with metadata:', metadata)
      console.log('onAudioData received with data:', data)
      meetingData.audio.push(data) // Collect raw audio data
    })

    client.onVideoData((data, timestamp, metadata) => {
      console.log('onVideoData received at time:', timestamp)
      console.log('onVideoData received with metadata:', metadata)
      console.log('onVideoData received:', data)
      meetingData.video.push(data)
    })

    client.onTranscriptData((data, timestamp, metadata, user) => {
      console.log('onTranscriptData received at time:', timestamp)
      console.log('onTranscriptData received with metadata:', metadata)
      console.log('onTranscriptData received:', data)

      const convertedData = data.toString('utf-8')
      convertTranscriptData(user.userName, timestamp, convertedData, payload.meeting_uuid)
    })

    client.join(payload)
  } else if (event === 'meeting.rtms_stopped') {
    if (meetingData.audio.length) {
      const audioBuffer = Buffer.concat(meetingData.audio) // Combine all the audio data into one buffer
      await convertAudioDataToWav(audioBuffer, payload)
      meetingData.audio = []
    }

    if (meetingData.video.length) {
      const videoBuffer = Buffer.concat(meetingData.video) // Combine all the video data into one buffer
      const timestampFormatted = new Date().toISOString().replace(/[:.]/g, '-')
      await convertVideoDataToMp4(videoBuffer, payload, timestampFormatted)
      meetingData.video = []
    }
  }
})
