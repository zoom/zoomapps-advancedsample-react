const { Router } = require('express')
const router = Router()
const controller = require('./controller')
const middleware = require('../../middleware')
router
  .get('/login', controller.begin) // Called with openUrl in zoom app
  .get('/redirect', controller.zoomAuth) // Handles redirect from Zoom following authentication there with auth code etc from zoom.us & redirects to Auth0
  .get('/auth', controller.auth0Auth) // Handles third party app auth code from the Auth0
  .get('/proxy/*', middleware.requiresThirdPartyAuth, controller.proxy) // calls Auth0 app's Management API, adding user creds
  .get('/logout', controller.logout) // Logout of Auth0 (deletes user access tokens in store)

module.exports = router
