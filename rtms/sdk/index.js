const rtms = require('@zoom/rtms').default

rtms.onWebhookEvent(async ({ event, payload }) => {
  console.log('Incoming webhook', event)

  if (event === 'meeting.rtms_started') {
    const client = new rtms.Client()

    client.onAudioData((data, timestamp, metadata) => {
      console.log('onAudioData received with data:', data)
    })

    client.onVideoData((data, timestamp, metadata) => {
      console.log('onVideoData received:', data)
    })

    client.onTranscriptData((data, timestamp, metadata, user) => {
      console.log('onTranscriptData received:', data)
    })

    client.join(payload)
  } else if (event === 'meeting.rtms_stopped') {
    console.log('meeting.rtms_stopped')
  }
})
