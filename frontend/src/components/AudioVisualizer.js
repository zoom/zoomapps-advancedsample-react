import React, { useEffect, useRef, useState } from 'react'

const SAMPLE_RATE = 16000 // match your audio source
const CHANNELS = 1
const POLL_INTERVAL = 100 // ms - reduced for smoother animation
const RAW_URL = `${process.env.PUBLIC_URL}/data/audio/audio.raw`

function parsePCM(buffer) {
  // 16-bit signed PCM, little endian
  const samples = new Int16Array(buffer)
  // Normalize to [-1, 1]
  return Array.from(samples).map((s) => s / 32768)
}

const AudioVisualizer = () => {
  const canvasRef = useRef(null)
  const [audioData, setAudioData] = useState([])
  const lastLengthRef = useRef(0)
  const previousDataRef = useRef([])
  const smoothDataRef = useRef([])

  // Poll raw audio file
  useEffect(() => {
    let polling = true
    async function poll() {
      while (polling) {
        try {
          const res = await fetch(RAW_URL + '?t=' + Date.now())
          if (res.ok) {
            const buf = await res.arrayBuffer()
            if (buf.byteLength > lastLengthRef.current) {
              // Only process new data
              const newBuf = buf.slice(lastLengthRef.current)
              const samples = parsePCM(newBuf)
              setAudioData(samples)
              lastLengthRef.current = buf.byteLength
              // Debug: print first 20 values as string
              console.log('Polled audio buffer:', samples.slice(0, 20).join(', '))
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, POLL_INTERVAL))
      }
    }
    poll()
    return () => {
      polling = false
    }
  }, [])

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    function resize() {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let anim
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const points = 128
      const amplitude = 1.5

      // Check if we have meaningful audio data - be more strict
      const hasAudioData = audioData.length > 0

      if (!hasAudioData) {
        // Draw simple flat line when no audio data
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(0, canvas.height / 2)
        ctx.lineTo(canvas.width, canvas.height / 2)

        // Use same gradient as waveform for consistency
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
        gradient.addColorStop(0, '#00c3ff')
        gradient.addColorStop(0.5, '#3a7bd5')
        gradient.addColorStop(1, '#ff4ecd')
        ctx.strokeStyle = gradient
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()

        // Reset smooth data when no audio
        smoothDataRef.current = []
        previousDataRef.current = []
      } else {
        // Use the latest audioData for waveform
        const data = audioData
        // Downsample to points
        const step = Math.max(1, Math.floor(data.length / points))
        const newSamples = Array(points)
          .fill(0)
          .map((_, i) => data[i * step] || 0)

        // Smooth interpolation between frames
        if (smoothDataRef.current.length === 0) {
          smoothDataRef.current = [...newSamples]
        } else {
          // Interpolate between previous and current data
          const lerpFactor = 0.15 // Adjust for smoother/faster transitions
          for (let i = 0; i < points; i++) {
            const current = smoothDataRef.current[i] || 0
            const target = newSamples[i] || 0
            smoothDataRef.current[i] = current + (target - current) * lerpFactor
          }
        }

        const samples = smoothDataRef.current

        // Draw top waveform
        ctx.save()
        ctx.beginPath()
        for (let i = 0; i < points; i++) {
          const x = (i / (points - 1)) * canvas.width
          const y = canvas.height / 2 - samples[i] * amplitude * canvas.height
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
        gradient.addColorStop(0, '#00c3ff')
        gradient.addColorStop(0.5, '#3a7bd5')
        gradient.addColorStop(1, '#ff4ecd')
        ctx.strokeStyle = gradient
        ctx.lineWidth = 4
        ctx.shadowColor = '#00c3ff'
        ctx.shadowBlur = 8
        ctx.stroke()
        ctx.restore()

        // Draw mirrored waveform
        ctx.save()
        ctx.beginPath()
        for (let i = 0; i < points; i++) {
          const x = (i / (points - 1)) * canvas.width
          const y = canvas.height / 2 + samples[i] * amplitude * canvas.height
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = gradient
        ctx.lineWidth = 4
        ctx.shadowColor = '#ff4ecd'
        ctx.shadowBlur = 8
        ctx.stroke()
        ctx.restore()
      }

      anim = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      window.removeEventListener('resize', resize)
      if (anim) cancelAnimationFrame(anim)
    }
  }, [audioData])

  return (
    <div className='audio-visualizer' style={{ width: '100%', height: '100%', padding: 0, margin: 0 }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          borderRadius: '8px',
          padding: 0,
          margin: 0,
        }}
      />
    </div>
  )
}

export default AudioVisualizer
