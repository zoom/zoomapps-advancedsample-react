const { Router } = require('express')
const router = Router()
const controller = require('./controller')

router.post('/', controller.rtms)

module.exports = router
