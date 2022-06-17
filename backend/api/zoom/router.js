const { Router } = require('express')
const router = Router()
const controller = require('./controller')
const { getUser, refreshToken, setZoomAuthHeader } = require('./middleware')
router.use(
  '/api',
  getUser,
  refreshToken,
  setZoomAuthHeader,
  controller.proxy
)
module.exports = router
