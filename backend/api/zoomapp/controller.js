const { createProxyMiddleware } = require('http-proxy-middleware')
const zoomApi = require('../../util/zoom-api')
const zoomHelpers = require('../../util/zoom-helpers')
const store = require('../../util/store')

module.exports = {
  // In-client OAuth 1/2
  async inClientAuthorize(req, res, next) {
    console.log(
      'IN-CLIENT AUTHORIZE HANDLER ==========================================================',
      '\n'
    )

    try {
      console.log('1. Generate code verifier, code challenge and state')
      const codeVerifier = zoomHelpers.generateCodeVerifier()
      const codeChallenge = codeVerifier
      const zoomInClientState = zoomHelpers.generateState()

      console.log('2. Save code verifier and state to session')
      req.session.codeVerifier = codeVerifier
      req.session.state = zoomInClientState

      console.log('3. Return code challenge and state to frontend')
      return res.json({
        codeChallenge,
        state: zoomInClientState,
      })
    } catch (error) {
      return next(error)
    }
  },

  // In-Client OAuth 2/2
  async inClientOnAuthorized(req, res, next) {
    console.log(
      'IN-CLIENT ON AUTHORIZED TOKEN HANDLER ==========================================================',
      '\n'
    )

    const zoomAuthorizationCode = req.body.code
    const href = req.body.href
    const state = decodeURIComponent(req.body.state)
    const zoomInClientState = req.session.state
    const codeVerifier = req.session.codeVerifier

    console.log(
      '1. Verify code (from onAuthorized event in client) exists and state matches'
    )

    try {
      if (!zoomAuthorizationCode || state !== zoomInClientState) {
        throw new Error('State mismatch')
      }

      console.log('2. Getting Zoom access token and user', '\n')
      const tokenResponse = await zoomApi.getZoomAccessToken(
        zoomAuthorizationCode,
        href,
        codeVerifier
      )

      const zoomAccessToken = tokenResponse.data.access_token
      console.log(
        '2a. Use code to get Zoom access token - response data: ',
        tokenResponse.data,
        '\n'
      )

      console.log('2b. Get Zoom user from Zoom API with access token')
      const userResponse = await zoomApi.getZoomUser(zoomAccessToken)
      const zoomUserId = userResponse.data.id
      req.session.user = zoomUserId

      console.log(
        '2c. Use access token to get Zoom user - response data: ',
        userResponse.data,
        '\n'
      )

      console.log(
        '2d. Save the tokens in the store so we can look them up when the Zoom App is opened'
      )

      // 2c. Save the tokens in the store so we can look them up when the Zoom App is opened:
      // When the home url for the app is requested on app open in the Zoom client,
      // the user id (uid field) is in the decrypted x-zoom-app-context header of the GET request
      await store.upsertUser(
        zoomUserId,
        tokenResponse.data.access_token,
        tokenResponse.data.refresh_token,
        Date.now() + tokenResponse.data.expires_in * 1000
      )

      return res.json({ result: 'Success' })
    } catch (error) {
      return next(error)
    }
  },

  // INSTALL HANDLER ==========================================================
  // Main entry point for the web-based app install and Zoom user authorize flow
  // Kicks off the OAuth 2.0 based exchange with zoom.us
  install(req, res) {
    console.log(
      'INSTALL HANDLER ==========================================================',
      '\n'
    )
    // 1. Generate and save a random state value for this browser session
    req.session.state = zoomHelpers.generateState()
    console.log(
      '1. Begin add app - generated state for zoom auth and saved:',
      req.session.state,
      '\n'
    )

    // 2. Create a redirect url, eg: https://zoom.us/oauth/authorize?client_id=XYZ&response_type=code&redirect_uri=https%3A%2F%2Fmydomain.com%2Fapi%2Fzoomapp%2Fauth&state=abc...
    // 2a. Set domain (with protocol prefix)
    const domain = process.env.ZOOM_HOST // https://zoom.us

    // 2b. Set path
    const path = 'oauth/authorize'

    // 2c. Create the request params
    const params = {
      redirect_uri: process.env.ZOOM_APP_REDIRECT_URI,
      response_type: 'code',
      client_id: process.env.ZOOM_APP_CLIENT_ID,
      state: req.session.state, // save state on this cookie-based session, to verify on return
    }

    const authRequestParams = zoomHelpers.createRequestParamString(params)

    // 2d. Concatenate
    const redirectUrl = domain + '/' + path + '?' + authRequestParams
    console.log('2. Redirect url to authenticate to Zoom:', redirectUrl, '\n')

    // 3. Redirect to url - the user can authenticate and authorize the app scopes securely on zoom.us
    console.log('3. Redirecting to redirect url', '\n')
    res.redirect(redirectUrl)
  },

  // ZOOM OAUTH REDIRECT HANDLER ==============================================
  // This route is called after the user has authorized the Zoom App on the
  async auth(req, res, next) {
    console.log(
      'ZOOM OAUTH REDIRECT HANDLER  ==============================================',
      '\n'
    )
    console.log(
      '1. Handling redirect from zoom.us with code and state following authentication to Zoom',
      '\n'
    )
    // 1. Validate code and state
    const zoomAuthorizationCode = req.query.code
    const zoomAuthorizationState = req.query.state
    const zoomState = req.session.state

    // For security purposes, delete the browser session
    req.session.destroy()

    // 1a. Check for auth code as parameter on response from zoom.us
    if (!zoomAuthorizationCode) {
      const error = new Error('No authorization code was provided')
      error.status = 400
      return next(error)
    }

    console.log('1a. code param exists:', req.query.code, '\n')

    // 1b. Validate the state parameter is the same as the one we sent
    if (!zoomAuthorizationState || zoomAuthorizationState !== zoomState) {
      const error = new Error('Invalid state parameter')
      error.status = 400
      return next(error)
    }

    console.log(
      '1b. state param is correct/matches ours:',
      req.query.state,
      '\n'
    )

    try {
      console.log('2. Getting Zoom access token and user', '\n')
      // 2. Get and remember Zoom access token and Zoom user
      // 2a. Exchange Zoom authorization code for tokens
      const tokenResponse = await zoomApi.getZoomAccessToken(
        zoomAuthorizationCode
      )
      const zoomAccessToken = tokenResponse.data.access_token
      console.log(
        '2a. Use code to get Zoom access token - response data: ',
        tokenResponse.data,
        '\n'
      )
      // other fields on token response:
      // tokenResponse.data.refresh_token
      // tokenResponse.data.expires_in

      // 2b. Get Zoom user info from Zoom API
      const userResponse = await zoomApi.getZoomUser(zoomAccessToken)
      const zoomUserId = userResponse.data.id

      console.log(
        '2b. Use access token to get Zoom user - response data: ',
        userResponse.data,
        '\n'
      )

      console.log(
        '2c. Save the tokens in the store so we can look them up when the Zoom App is opened'
      )

      // 2c. Save the tokens in the store so we can look them up when the Zoom App is opened:
      // When the home url for the app is requested on app open in the Zoom client,
      // the user id (uid field) is in the decrypted x-zoom-app-context header of the GET request
      await store.upsertUser(
        zoomUserId,
        tokenResponse.data.access_token,
        tokenResponse.data.refresh_token,
        Date.now() + tokenResponse.data.expires_in * 1000
      )

      // 3. Get deeplink from Zoom API
      const deepLinkResponse = await zoomApi.getDeeplink(zoomAccessToken)
      const deeplink = deepLinkResponse.data.deeplink

      console.log(
        '3. Generated deeplink from Zoom API using access token: ',
        deeplink,
        '\n'
      )
      console.log('4. Redirecting to Zoom client via deeplink . . .', '\n')

      // 4. Redirect to deep link to return user to the Zoom client
      res.redirect(deeplink)
    } catch (error) {
      return next(error)
    }
  },

  // ZOOM APP HOME URL HANDLER ==================================================
  // This route is called when the app opens
  home(req, res, next) {
    console.log(
      'ZOOM APP HOME URL HANDLER ==================================================',
      '\n'
    )
    try {
      // 1. Decrypt the Zoom App context header
      if (!req.headers['x-zoom-app-context']) {
        throw new Error('x-zoom-app-context header is required')
      }

      const decryptedAppContext = zoomHelpers.decryptZoomAppContext(
        req.headers['x-zoom-app-context'],
        process.env.ZOOM_APP_CLIENT_SECRET
      )

      console.log('1. Decrypted Zoom App Context:', decryptedAppContext, '\n')
      console.log('2. Persisting user id and meetingUUIDa', '\n')

      // 2. Persist user id and meetingUUID
      req.session.user = decryptedAppContext.uid
      req.session.meetingUUID = decryptedAppContext.mid
    } catch (error) {
      return next(error)
    }

    // 3. Redirect to frontend
    console.log('3. Redirect to frontend', '\n')
    res.redirect('/api/zoomapp/proxy')
  },

  // FRONTEND PROXY ===========================================================
  proxy: createProxyMiddleware({
    target: process.env.ZOOM_APP_CLIENT_URL,
    changeOrigin: true,
    ws: true,
  }),
}
