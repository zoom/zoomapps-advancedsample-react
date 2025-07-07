/* globals zoomSdk */
import { useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useState, useRef } from 'react'
import { apis } from './apis'
import { Authorization } from './components/Authorization'
import ApiScrollview from './components/ApiScrollview'
import ReactPlayer from 'react-player'
import AudioVisualizer from './components/AudioVisualizer'
import './App.css'

let once = 0 // to prevent increasing number of event listeners being added

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [runningContext, setRunningContext] = useState(null)
  const [connected, setConnected] = useState(false)
  const [counter, setCounter] = useState(0)
  const [preMeeting, setPreMeeting] = useState(true) // start with pre-meeting code
  const [userContextStatus, setUserContextStatus] = useState('')
  const [rmtsMessage, setRtmsMessage] = useState('')
  const [messageUpdating, setMessageUpdating] = useState(false)
  const [messageVisible, setMessageVisible] = useState(true)
  const [transcriptContent, setTranscriptContent] = useState('')
  const [showConvertedData, setShowConvertedData] = useState(false)
  const [isFading, setIsFading] = useState(false)
  const [audioExists, setAudioExists] = useState(false)
  const [showVisualizer, setShowVisualizer] = useState(true)
  const [showVideoFeed, setShowVideoFeed] = useState(false)
  const [currentFrame, setCurrentFrame] = useState('')
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false)
  const [videoExists, setVideoExists] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [lastFrameTime, setLastFrameTime] = useState(null)
  const [fps, setFps] = useState(0)
  const lastFrameRef = useRef('')
  const frameCountRef = useRef(0) // Add ref for frame counting

  // Initialize video stats
  useEffect(() => {
    const resetStats = () => {
      setFrameCount(0)
      setFps(0)
      setLastFrameTime(null)
      lastFrameRef.current = ''
      frameCountRef.current = 0
      setCurrentFrame('')
    }

    resetStats()
    return () => resetStats() // Reset on unmount too
  }, [])

  // Add effect to poll for real-time frames
  useEffect(() => {
    const fetchCurrentFrame = async () => {
      try {
        const response = await fetch(`${process.env.PUBLIC_URL}/data/video/current-frame.txt`)
        if (response.ok) {
          const base64Frame = await response.text()
          // Only update if frame is different from the last frame
          if (base64Frame && base64Frame !== lastFrameRef.current) {
            lastFrameRef.current = base64Frame
            setCurrentFrame(base64Frame)

            // Update frame count and FPS
            frameCountRef.current += 1
            setFrameCount(frameCountRef.current)

            const now = Date.now()
            if (lastFrameTime) {
              const timeDiff = now - lastFrameTime
              const newFps = Math.round(1000 / timeDiff)
              setFps(newFps)
            }
            setLastFrameTime(now)
          }
        }
      } catch (error) {
        console.error('Error fetching video frame:', error)
      }
    }

    // Poll every 1000ms regardless of video feed visibility
    const interval = setInterval(fetchCurrentFrame, 1000)
    return () => clearInterval(interval)
  }, [lastFrameTime])

  // Reset stats when switching views
  useEffect(() => {
    if (showVideoFeed) {
      setFrameCount(0)
      setFps(0)
      setLastFrameTime(null)
      lastFrameRef.current = ''
      frameCountRef.current = 0
    }
  }, [showVideoFeed])

  // Clear message handler
  const handleClearMessage = useCallback(() => {
    setMessageVisible(false)
  }, [])

  // Poll for transcript updates
  useEffect(() => {
    const fetchTranscript = async () => {
      try {
        const response = await fetch(
          `${process.env.PUBLIC_URL}/data/transcript/${showConvertedData ? 'transcript.txt' : 'raw.txt'}`
        )
        if (response.ok) {
          const text = await response.text()
          setTranscriptContent(text)
        }
      } catch (error) {
        console.error('Error fetching transcript:', error)
      }
    }

    // Initial fetch
    fetchTranscript()

    // Set up polling every 2 seconds
    const interval = setInterval(fetchTranscript, 1000)

    return () => clearInterval(interval)
  }, [showConvertedData])

  // Reset message visibility when a new message arrives
  useEffect(() => {
    if (rmtsMessage) {
      setMessageVisible(true)
    }
  }, [rmtsMessage])

  // Animation effect for message updates
  useEffect(() => {
    if (rmtsMessage) {
      setMessageUpdating(true)
      const timer = setTimeout(() => {
        setMessageUpdating(false)
      }, 300) // Match animation duration

      return () => clearTimeout(timer)
    }
  }, [rmtsMessage])

  // Check if audio file exists
  useEffect(() => {
    const checkAudioFile = async () => {
      try {
        const response = await fetch(`${process.env.PUBLIC_URL}/data/audio/audio.wav`)
        console.log('response:', response)
        const contentType = response.headers.get('Content-Type')
        const isAudio = contentType && contentType.startsWith('audio')
        setAudioExists(response.ok && isAudio)
      } catch (error) {
        setAudioExists(false)
      }
    }

    // Initial check
    checkAudioFile()

    // Check every 2 seconds
    const interval = setInterval(checkAudioFile, 2000)

    return () => clearInterval(interval)
  }, [])

  // Add effect to check for video file
  useEffect(() => {
    const checkVideoFile = async () => {
      try {
        const response = await fetch(`${process.env.PUBLIC_URL}/data/video/video.mp4`)
        setVideoExists(response.ok)
      } catch (error) {
        setVideoExists(false)
      }
    }

    // Check every 2 seconds
    const interval = setInterval(checkVideoFile, 2000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    async function configureSdk() {
      // to account for the 2 hour timeout for config
      const configTimer = setTimeout(() => {
        setCounter(counter + 1)
      }, 120 * 60 * 1000)

      try {
        // Configure the JS SDK, required to call JS APIs in the Zoom App
        // These items must be selected in the Features -> Zoom App SDK -> Add APIs tool in Marketplace
        const configResponse = await zoomSdk.config({
          capabilities: [
            // apis demoed in the buttons
            ...apis.map((api) => api.name), // IMPORTANT

            // demo events
            'onSendAppInvitation',
            'onShareApp',
            'onActiveSpeakerChange',
            'onMeeting',

            // connect api and event
            'connect',
            'onConnect',
            'postMessage',
            'onMessage',

            // in-client api and event
            'authorize',
            'onAuthorized',
            'promptAuthorize',
            'getUserContext',
            'onMyUserContextChange',
            'sendAppInvitationToAllParticipants',
            'sendAppInvitation',

            // RTMS
            'startRTMS',
            'stopRTMS',
            'getRTMSStatus',
            'onRTMSStatusChange',
            'pauseRTMS',
            'resumeRTMS',
          ],
          version: '0.16.0',
        })
        console.log('App configured', configResponse)
        // The config method returns the running context of the Zoom App
        setRunningContext(configResponse.runningContext)
        setUserContextStatus(configResponse.auth.status)
        zoomSdk.onSendAppInvitation((data) => {
          console.log(data)
        })
        zoomSdk.onShareApp((data) => {
          console.log(data)
        })
      } catch (error) {
        console.log(error)
        setError('There was an error configuring the JS SDK')
      }
      return () => {
        clearTimeout(configTimer)
      }
    }
    configureSdk()
  }, [counter])

  // PRE-MEETING
  let on_message_handler_client = useCallback(
    (message) => {
      let content = message.payload.payload
      if (content === 'connected' && preMeeting === true) {
        console.log('Meeting instance exists.')
        zoomSdk.removeEventListener('onMessage', on_message_handler_client)
        console.log("Letting meeting instance know client's current state.")
        sendMessage(window.location.hash, 'client')
        setPreMeeting(false) // client instance is finished with pre-meeting
      }
    },
    [preMeeting]
  )

  // PRE-MEETING
  useEffect(() => {
    if (runningContext === 'inMainClient' && preMeeting === true) {
      zoomSdk.addEventListener('onMessage', on_message_handler_client)
    }
  }, [on_message_handler_client, preMeeting, runningContext])

  // useEffect(() => {
  //   if (!runningContext) return

  //   const handleStatusChange = (status) => {
  //     console.log('onRTMSStatusChange status changed:', status)
  //     setRtmsMessage(`RTMS status changed: ${JSON.stringify(status)}`)
  //   }

  //   zoomSdk.onRTMSStatusChange(handleStatusChange)

  //   return () => {
  //     zoomSdk.removeEventListener('onRTMSStatusChange', handleStatusChange)
  //   }
  // }, [runningContext])

  async function sendMessage(msg, sender) {
    console.log('Message sent from ' + sender + ' with data: ' + JSON.stringify(msg))
    console.log('Calling postmessage...', msg)
    await zoomSdk.postMessage({
      payload: msg,
    })
  }

  const receiveMessage = useCallback(
    (receiver, reason = '') => {
      let on_message_handler = (message) => {
        let content = message.payload.payload
        console.log('Message received ' + receiver + ' ' + reason + ': ' + content)
        navigate({ pathname: content })
      }
      if (once === 0) {
        zoomSdk.addEventListener('onMessage', on_message_handler)
        once = 1
      }
    },
    [navigate]
  )

  useEffect(() => {
    async function connectInstances() {
      // only can call connect when in-meeting
      if (runningContext === 'inMeeting') {
        zoomSdk.addEventListener('onConnect', (event) => {
          console.log('Connected')
          setConnected(true)

          // PRE-MEETING
          // first message to send after connecting instances is for the meeting
          // instance to catch up with the client instance
          if (preMeeting === true) {
            console.log('Letting client know meeting instance exists.')
            sendMessage('connected', 'meeting')
            console.log("Adding message listener for client's current state.")
            let on_message_handler_mtg = (message) => {
              console.log('Message from client received. Meeting instance updating its state:', message.payload.payload)
              window.location.replace(message.payload.payload)
              zoomSdk.removeEventListener('onMessage', on_message_handler_mtg)
              setPreMeeting(false) // meeting instance is finished with pre-meeting
            }
            zoomSdk.addEventListener('onMessage', on_message_handler_mtg)
          }
        })

        await zoomSdk.connect()
        console.log('Connecting...')
      }
    }

    if (connected === false) {
      console.log(runningContext, location.pathname)
      connectInstances()
    }
  }, [connected, location.pathname, preMeeting, runningContext])

  // POST-MEETING
  useEffect(() => {
    async function communicateTabChange() {
      // only proceed with post-meeting after pre-meeting is done
      // just one-way communication from in-meeting to client
      if (runningContext === 'inMeeting' && connected && preMeeting === false) {
        sendMessage(location.pathname, runningContext)
      } else if (runningContext === 'inMainClient' && preMeeting === false) {
        receiveMessage(runningContext, 'for tab change')
      }
    }
    communicateTabChange()
  }, [connected, location, preMeeting, receiveMessage, runningContext])

  if (error) {
    console.log(error)
    return (
      <div className='App'>
        <h1>{error.message}</h1>
      </div>
    )
  }

  // Modified RTMS handlers to ensure message visibility
  const handleStartRTMS = async () => {
    try {
      const res = await zoomSdk.callZoomApi('startRTMS')
      console.log('startRTMS succcess:', res)
      setRtmsMessage(`startRTMS success response: ${res.message}`)
      setMessageVisible(true)
    } catch (error) {
      console.log('startRTMS failue:', error)
      setRtmsMessage(`startRTMS error response: ${error}`)
      setMessageVisible(true)
    }
  }

  const handleStopRTMS = async () => {
    try {
      const res = await zoomSdk.callZoomApi('stopRTMS')
      console.log('stopRTMS success:', res)
      setRtmsMessage(`stopRTMS success response: ${res.message}`)
      setMessageVisible(true)
    } catch (error) {
      console.log('stopRTMS failue:', error)
      setRtmsMessage(`stopRTMS error response: ${error}`)
      setMessageVisible(true)
    }
  }

  const handleGetRTMSStatus = async () => {
    try {
      const res = await zoomSdk.callZoomApi('getRTMSStatus')
      console.log('getRTMSStatus succcess:', res)
      setRtmsMessage(`getRTMSStatus success response: ${res}`)
      setMessageVisible(true)
    } catch (error) {
      console.log('getRTMSStatus failue:', error)
      setRtmsMessage(`getRTMSStatus error response: ${error}`)
      setMessageVisible(true)
    }
  }

  const handlePauseRTMS = async () => {
    try {
      const res = await zoomSdk.callZoomApi('pauseRTMS')
      console.log('pauseRTMS succcess:', res)
      setRtmsMessage(`pauseRTMS success response: ${res}`)
      setMessageVisible(true)
    } catch (error) {
      console.log('pauseRTMS failue:', error)
      setRtmsMessage(`pauseRTMS error response: ${error}`)
      setMessageVisible(true)
    }
  }

  const handleResumeRTMS = async () => {
    try {
      const res = await zoomSdk.callZoomApi('resumeRTMS')
      console.log('resumeRTMS succcess:', res)
      setRtmsMessage(`resumeRTMS success response: ${res}`)
      setMessageVisible(true)
    } catch (error) {
      console.log('resumeRTMS failue:', error)
      setRtmsMessage(`resumeRTMS error response: ${error}`)
      setMessageVisible(true)
    }
  }

  const handleToggleData = () => {
    setIsFading(true)
    setTimeout(() => {
      setShowConvertedData(!showConvertedData)
      setTimeout(() => {
        setIsFading(false)
      }, 50)
    }, 150)
  }

  return (
    <div className='App'>
      <div className='app-header'>
        <div className='header-content'>
          <div className='logo-title-container'>
            <img src={`${process.env.PUBLIC_URL}/logo-circle.svg`} alt='Zoom Logo' className='header-logo' />
            <div className='title-container'>
              <h1 className='app-title'>Visualization of RTMS content</h1>
              <p className='subtitle'>Realtime Media Stream Control Center</p>
            </div>
          </div>
        </div>
      </div>

      <div className='dashboard-container'>
        {/* Top Section: Status Left, Controls Center */}
        <div className='top-section'>
          {/* Left Section - System Status */}
          <div className='left-section'>
            <div className='status-section'>
              <h2 className='section-title'>
                <i className='fas fa-chart-line'></i>
                System Status
              </h2>
              <div className='status-row'>
                <div className='status-item'>
                  <div className='status-label'>
                    <i className='fas fa-shield-alt'></i>
                    AUTH STATUS
                  </div>
                  <div
                    className={`status-indicator ${
                      userContextStatus === 'authorized'
                        ? 'online'
                        : userContextStatus === 'unauthorized'
                        ? 'offline'
                        : 'connecting'
                    }`}
                  >
                    {userContextStatus || 'Unknown'}
                  </div>
                </div>

                <div className='status-item'>
                  <div className='status-label'>
                    <i className='fas fa-desktop'></i>
                    CONTEXT
                  </div>
                  <div className='status-value'>
                    {runningContext || <span className='loading'>Configuring...</span>}
                  </div>
                </div>

                <div className='status-item'>
                  <div className='status-label'>
                    <i className='fas fa-user-circle'></i>
                    USER
                  </div>
                  <div className='status-value'>{user ? `${user.first_name} ${user.last_name}` : 'Zoom User'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Center Section - Compact Controls */}
          <div className='center-section'>
            {/* Message Display or Placeholder */}
            {rmtsMessage && messageVisible ? (
              <div
                className={`message-display ${
                  rmtsMessage.includes('success')
                    ? rmtsMessage.includes('stopRTMS')
                      ? 'stopped'
                      : 'success'
                    : rmtsMessage.includes('error')
                    ? 'error'
                    : ''
                } ${messageUpdating ? 'updating' : ''}`}
              >
                <button className='close-button' aria-label='Dismiss message' onClick={handleClearMessage}>
                  <i className='fas fa-times'></i>×
                </button>
                <strong>RTMS Status:</strong>
                <br />
                {rmtsMessage}
              </div>
            ) : (
              <div className='message-placeholder'>Message display area - Status updates will appear here</div>
            )}

            <div className='rtms-panel'>
              <div className='panel-header'>
                <h2 className='section-title'>
                  <i className='fas fa-video'></i>
                  RTMS Controls
                </h2>
              </div>

              <ApiScrollview
                onStartRTMS={handleStartRTMS}
                onStopRTMS={handleStopRTMS}
                onGetRTMSStatus={handleGetRTMSStatus}
                onPauseRTMS={handlePauseRTMS}
                onResumeRTMS={handleResumeRTMS}
              />
            </div>
          </div>
        </div>

        {/* Bottom Section - Reserved for Future UI */}
        <div className='bottom-section'>
          <div className='cards-row'>
            <div className='media-card'>
              <div className='card-header'>
                <i className='fas fa-volume-up'></i>
                <h3>Audio</h3>
                <button
                  className={`toggle-button ${!showVisualizer ? 'active' : ''}`}
                  onClick={() => setShowVisualizer(!showVisualizer)}
                >
                  {!showVisualizer ? 'Wave' : 'Player'}
                </button>
              </div>
              <div className='card-content'>
                <div className='audio-player'>
                  {console.log('audioExists:', audioExists, 'showVisualizer:', showVisualizer)}
                  {showVisualizer ? (
                    <AudioVisualizer />
                  ) : audioExists === false ? (
                    <div className='audio-placeholder'>
                      <i className='fas fa-spinner fa-spin'></i>
                      <p>Waiting for audio data...</p>
                    </div>
                  ) : audioExists === true ? (
                    <div className='player-wrapper'>
                      <ReactPlayer
                        url={`${process.env.PUBLIC_URL}/data/audio/audio.wav`}
                        controls
                        width='100%'
                        height='50px'
                        config={{
                          file: {
                            attributes: {
                              controlsList: 'nodownload',
                              style: {
                                width: '100%',
                                height: '50px',
                                backgroundColor: 'transparent',
                                borderRadius: '8px',
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className='media-card'>
              <div className='card-header'>
                <i className='fas fa-video'></i>
                <h3>Video</h3>
                {videoExists && (
                  <button
                    className={`toggle-button ${showVideoFeed ? 'active' : ''}`}
                    onClick={() => setShowVideoFeed(!showVideoFeed)}
                  >
                    {showVideoFeed ? 'Feed' : 'MP4'}
                  </button>
                )}
              </div>
              <div className='card-content'>
                {!showVideoFeed ? (
                  <div className='video-feed'>
                    {currentFrame ? (
                      <>
                        <img
                          src={`data:image/jpeg;base64,${currentFrame}`}
                          alt='Live video feed'
                          key={frameCount} // Force re-render for animation
                        />
                        <div className='video-stats-overlay'>
                          <span>
                            <div className='indicator'></div>
                            Live Feed
                          </span>
                          <span>Frames: {frameCount}</span>
                        </div>
                      </>
                    ) : (
                      <div className='video-placeholder'>
                        <i className='fas fa-film'></i>
                        <p>Waiting for video feed...</p>
                      </div>
                    )}
                  </div>
                ) : videoExists ? (
                  <div className='video-recording'>
                    <ReactPlayer
                      url={`${process.env.PUBLIC_URL}/data/video/video.mp4`}
                      controls={true}
                      width='100%'
                      height='100%'
                      playing={false}
                    />
                  </div>
                ) : (
                  <div className='video-placeholder'>
                    <i className='fas fa-film'></i>
                    <p>No recorded video available</p>
                  </div>
                )}
              </div>
            </div>

            <div className='media-card'>
              <div className='card-header'>
                <i className='fas fa-file-alt'></i>
                <h3>Transcript</h3>
                <button className={`toggle-button ${showConvertedData ? 'active' : ''}`} onClick={handleToggleData}>
                  {showConvertedData ? 'Raw' : 'Converted '}
                </button>
              </div>
              <div className='card-content'>
                <div className='transcript-content'>
                  {transcriptContent ? (
                    <div className={`transcript-text ${isFading ? 'fade-out' : 'fade-in'}`}>
                      {transcriptContent.split('\n').map((line, index) => (
                        <div key={index} className='transcript-line' style={{ marginBottom: '10px' }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className='transcript-placeholder'>
                      <i className='fas fa-microphone-alt'></i>
                      <p>Waiting for transcript data...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* <Authorization
        handleError={setError}
        handleUserContextStatus={setUserContextStatus}
        handleUser={setUser}
        user={user}
        userContextStatus={userContextStatus}
      /> */}
    </div>
  )
}

export default App
