require('dotenv').config()
const express = require('express')
const rtmsWebSocket = require('./api/router.js')

const app = express()

app.use(express.json())

app.use('/rtms', rtmsWebSocket)

const PORT = process.env.ZM_RTMS_PORT

app.listen(PORT, () => {
  console.log(`🚀 RTMS Server is running on port ${PORT}`)
})
