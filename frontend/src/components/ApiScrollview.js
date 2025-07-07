import { React, useEffect, useState } from 'react'
import { apis, invokeZoomAppsSdk } from '../apis'
import './ApiScrollview.css'

function ApiScrollview({ onStartRTMS, onStopRTMS, onGetRTMSStatus, onPauseRTMS, onResumeRTMS }) {
  const [apiSearchText, setApiSearchText] = useState('')
  const [loadingButtons, setLoadingButtons] = useState({})

  const searchHandler = (e) => {
    let lowerCase = e.target.value.toLowerCase()
    setApiSearchText(lowerCase)
  }

  const handleButtonClick = async (buttonName, onClick) => {
    setLoadingButtons((prev) => ({ ...prev, [buttonName]: true }))
    try {
      await onClick()
    } finally {
      setTimeout(() => {
        setLoadingButtons((prev) => ({ ...prev, [buttonName]: false }))
      }, 500) // Small delay to show completion
    }
  }

  const filteredApis = apis?.filter((api) => {
    if (apiSearchText === '') {
      return api
    } else {
      return api.name.toLowerCase().includes(apiSearchText)
    }
  })

  return (
    <div className='api-scrollview'>
      {/* <input 
        className="material-input"
        placeholder='Search for an API...' 
        onChange={searchHandler} 
        id='api-scrollview-input' 
      /> */}

      <div className='api-buttons-grid'>
        <button
          className={`material-button api-button btn-start ${loadingButtons.start ? 'loading' : ''}`}
          onClick={() => handleButtonClick('start', onStartRTMS)}
          disabled={loadingButtons.start}
        >
          <i className='fas fa-play'></i>
          Start
        </button>

        <button
          className={`material-button api-button btn-stop ${loadingButtons.stop ? 'loading' : ''}`}
          onClick={() => handleButtonClick('stop', onStopRTMS)}
          disabled={loadingButtons.stop}
        >
          <i className='fas fa-stop'></i>
          Stop
        </button>
        {/* 
        <button
          className={`material-button api-button btn-status ${loadingButtons.status ? 'loading' : ''}`}
          onClick={() => handleButtonClick('status', onGetRTMSStatus)}
          disabled={loadingButtons.status}
        >
          <i className='fas fa-info-circle'></i>
          Get RTMS Status
        </button>

        <button
          className={`material-button api-button btn-pause ${loadingButtons.pause ? 'loading' : ''}`}
          onClick={() => handleButtonClick('pause', onPauseRTMS)}
          disabled={loadingButtons.pause}
        >
          <i className='fas fa-pause'></i>
          Pause RTMS
        </button>

        <button
          className={`material-button api-button btn-resume ${loadingButtons.resume ? 'loading' : ''}`}
          onClick={() => handleButtonClick('resume', onResumeRTMS)}
          disabled={loadingButtons.resume}
        >
          <i className='fas fa-play-circle'></i>
          Resume RTMS
        </button> */}

        {/* {filteredApis?.map((api) => (
          <button 
            onClick={invokeZoomAppsSdk(api)} 
            className='material-button api-button primary' 
            key={api.buttonName || api.name}
          >
            <i className="fas fa-cog"></i>
            {api.buttonName || api.name}
          </button>
        ))} */}
      </div>
    </div>
  )
}

export default ApiScrollview
