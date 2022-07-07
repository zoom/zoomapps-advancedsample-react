const axios = require('axios')
const { createProxyMiddleware } = require('http-proxy-middleware')
const zoomApi = require('../../util/zoom-api')
const zoomHelpers = require('../../util/zoom-helpers')
const store = require('../../util/store')

module.exports = {
  // BEGIN 3RD PARTY OAUTH LOGIN HANDLER ==============================================
  // Invoked when user begins login to third party flow
  // Creates and saves state
  // Redirects to Zoom for authentication
  // (We need to authenticate to Zoom first to request a deeplink from Zoom API that links back to Zoom client)
  async begin(req, res) {
    console.log(
      'BEGIN 3RD PARTY OAUTH LOGIN HANDLER ==============================================',
      '\n'
    )
    // 1. Generate and save a random state value for this browser session to verify when code comes back from Zoom
    const zoomRequestState = zoomHelpers.generateState()
    req.session.zoomRequestState = zoomRequestState
    console.log(
      '1. Begin 3rd party oauth log in - generate state for zoom auth and save:',
      req.session.zoomRequestState,
      '\n'
    )

    // 2. Create a redirect url, eg: https://zoom.us/oauth/authorize?client_id=XYZ&response_type=code&redirect_uri=https%3A%2F%2Fmydomain.com%2Fapi%2Fzoomapp%2Fauth&state=abc...
    // 2a. Set domain (with protocol prefix)
    const zoomDomain = process.env.ZOOM_HOST // https://zoom.us

    // 2b. Set path
    const zoomAuthPath = '/oauth/authorize'

    // 2c. Create the request params
    const params = {
      redirect_uri: `${process.env.PUBLIC_URL}/api/auth0/redirect`, // eg the 'Third Party Auth Redirect', below.  This route is usually known to your 3rd party authenticator
      response_type: 'code',
      client_id: process.env.ZOOM_APP_CLIENT_ID,
      state: req.session.zoomRequestState,
    }

    const zoomAuthRequestParams = zoomHelpers.createRequestParamString(params)

    // 2d. Concatenate for the redirect url
    const redirectUrl = zoomDomain + zoomAuthPath + '?' + zoomAuthRequestParams
    console.log('2. Redirect url to authenticate to Zoom:', redirectUrl, '\n')

    // 3. Redirect to url - the user can authenticate and authorize the app scopes securely on zoom.us
    console.log('3. Redirecting to redirect url', '\n')
    res.redirect(redirectUrl)
  },

  // ZOOM OAUTH REDIRECT HANDLER ==============================================
  // Handles the redirect from Zoom following user authenticaation to Zoom; request will include auth code and our (saved) state from Zoom
  // Gets and saves Zoom access token and user/id so we can save them, then in the next step (deeplinkToClient, below) invoke the Zoom API and get a deeplink
  // Redirects to third party for authentication
  async zoomAuth(req, res, next) {
    console.log(
      'ZOOM OAUTH REDIRECT HANDLER ==============================================',
      '\n'
    )
    // For security, forget this state value on 1st attempt
    const sessionZoomState = req.session.zoomRequestState
    req.session.zoomRequestState = null

    console.log(
      '1. Handling redirect from zoom.us with code and state following authentication to Zoom',
      '\n'
    )
    // 1. Validate code and state
    // 1a. Check for auth code from zoom following authenication
    if (!req.query.code) {
      const error = new Error('No auth code was provided')
      error.status = 400
      return next(error)
    }

    console.log('1a. code param exists:', req.query.code)

    // 1b. Validate state passed following zoom.us login is correct
    if (req.query.state !== sessionZoomState) {
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
        req.query.code,
        `${process.env.PUBLIC_URL}/api/auth0/redirect`
      )
      const zoomAccessToken = tokenResponse.data.access_token
      console.log(
        '2a. Use code to get Zoom access token - response data: ',
        tokenResponse.data,
        '\n'
      )

      // 2b. Get Zoom user info from Zoom API
      const userResponse = await zoomApi.getZoomUser(zoomAccessToken)
      const zoomUserId = userResponse.data.id

      console.log(
        '2b. Use access token to get Zoom user - response data: ',
        userResponse.data,
        '\n'
      )

      // 2c. Persist user data on this session, to quickly look up user
      req.session.user = zoomUserId

      // 2d.  In the redis store - we'll access the store again when the user visits from the Zoom App (keyed from user id in x-zoom-app-context header)
      await store.upsertUser(
        zoomUserId,
        tokenResponse.data.access_token,
        tokenResponse.data.refresh_token,
        Date.now() + tokenResponse.data.expires_in * 1000
      )

      // 3. Formulate url to redirect now to 3rd party oauth provider
      console.log(
        '3. Formulate url to redirect now to 3rd party oauth provider',
        '\n'
      )

      // 3a. Generate and save a state for the 3rd party to return following authentication
      const thirdPartyRequestState = zoomHelpers.generateState()
      req.session.thirdPartyRequestState = thirdPartyRequestState
      console.log('3a. state generated and saved:', thirdPartyRequestState)

      // 3b. Generate and save a code verifier to send the 3rd party to validate before they issue token
      const codeVerifier = zoomHelpers.generateCodeVerifier()
      req.session.codeVerifier = codeVerifier
      console.log('3b. Code verifier generated and saved:', codeVerifier)

      // 3c. Generate a code challenge to send with this
      const codeChallenge = zoomHelpers.generateCodeChallenge(codeVerifier)
      console.log('3c. Code challenge generated and saved:', codeChallenge)

      // 3d. Set domain
      const myAuth0TestDomain = process.env.AUTH0_ISSUER_BASE_URL
      console.log('3d. Domain:', myAuth0TestDomain)

      // 3e. Set path
      const auth0AuthPath = '/authorize'
      console.log('3e. Path:', auth0AuthPath)

      // 3f. Set params
      const params = {
        response_type: 'code',
        client_id: process.env.AUTH0_CLIENT_ID,
        scope: 'openid profile email',
        state: req.session.thirdPartyRequestState,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        redirect_uri: `${process.env.PUBLIC_URL}/api/auth0/auth`,
      }

      console.log('3f. Params for request:', params)
      const auth0AuthRequestParams = zoomHelpers.createRequestParamString(
        params
      )

      // 3g. Concatenate above
      const redirectUrl =
        myAuth0TestDomain + auth0AuthPath + '?' + auth0AuthRequestParams
      console.log('3f. Redirect url/ completed: ', redirectUrl, '\n')

      // 4. Redirect to url - the user can authenticate and authorize the app scopes securely on Auth0
      console.log('4. Redirecting to redirect url', '\n')
      res.redirect(redirectUrl)
    } catch (error) {
      console.log('Error getting Zoom info or creds:', error)

      // For security reasons, destroy this session
      req.session.destroy()
      return next(error)
    }
  },

  // AUTH0 REDIRECT HANDLER ==============================================
  // This route handles the redirect after the user has authorized the third party app
  // Requests will include the (saved) state we sent, and the authorization code
  // Validates the state parameter and saves the access token
  // Uses already-saved zoom access token to call zoom API for deeplink back to client
  async auth0Auth(req, res, next) {
    console.log(
      'AUTH0 REDIRECT HANDLER ==============================================',
      '\n'
    )
    console.log(
      '1. Handling redirect from Auth0 with code and state following authentication to Auth0 app',
      '\n'
    )
    const codeVerifier = req.session.codeVerifier
    const thirdPartyRequestState = req.session.thirdPartyRequestState
    const sessionUser = req.session.user

    // For security reasons, destory this session
    req.session.destroy()

    // 1 Validate code and state
    // 1a. Check for auth code from Auth0 following authenication there
    if (!req.query.code) {
      const error = new Error('No auth code was provided')
      error.status = 400
      return next(error)
    }

    console.log('1a. code param exists:', req.query.code, '\n')

    // 1b. Validate the state parameter\
    if (req.query.state !== thirdPartyRequestState) {
      const error = new Error('Invalid state parameter')
      error.status = 400

      return next(error)
    }

    console.log(
      '1b. state param is correct/matches ours:',
      req.query.state,
      '\n'
    )

    // 2 Exchange Auth0 code for Auth0 API access token
    // 2a. Formulate http request options/axios
    const options = {
      method: 'POST',
      url: `${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`,
      headers: { 'content-type': 'application/json' },
      data: {
        grant_type: 'authorization_code',
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        code_verifier: codeVerifier,
        code: req.query.code,
        redirect_uri: `${process.env.PUBLIC_URL}/api/auth0/auth`,
        audience: `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/`,
        scope: 'openid profile email',
      },
    }

    console.log('2. Make request to swap code for access token', '\n')
    console.log('2a. Options for request: ', options, '\n')

    try {
      // 2b. Make the request
      const auth0AccessToken = await axios
        .request(options)
        .then((res) => {
          console.log('auth0 access token success: ', res.data)
          return res.data
        })
        .catch((err) => {
          console.error(err)
          throw new Error('auth0 access token request failed')
        })

      console.log('2b. Auth0 response data/ token: ', auth0AccessToken, '\n')
      // 3. Save the access token
      // this will be used again when user visits the /proxy route
      // thirdPartyAccessToken is retrieved from store in requiresThirdPartyAuth middleware
      await store.updateUser(sessionUser, {
        thirdPartyAccessToken: auth0AccessToken.access_token,
      })

      console.log('3. Save the access token in store: ', store, '\n')

      // 4. Finally, redirect the user back to the Zoom client
      console.log('4. Redirecting back to Zoom client', '\n')
      // 4a. Get accessToken saved in Zoom Oauth redirect handler 2e above
      const user = await store.getUser(sessionUser)
      const zoomAccessToken = user.accessToken

      console.log(
        '4a. Retrieve user from store to get Zoom access token:',
        user,
        '\n'
      )

      // 4b. Generate a deep link to open Zoom App in client
      const deepLinkResponse = await zoomApi.getDeeplink(zoomAccessToken)
      const deeplink = deepLinkResponse.data.deeplink

      console.log(
        '4b. Generated deeplink from Zoom API using access token: ',
        deeplink,
        '\n'
      )
      console.log('4c. Redirecting to Zoom client via deeplink . . .', '\n')

      // 4c. Redirect to deep link to open Zoom client with the (reloaded) app - now the 3rd party user data displays
      res.redirect(deeplink)
    } catch (error) {
      next(error)
    }
  },

  // AUTH0 API PROXY ==============================================
  // Takes client requests and forwards to Auth0 Management API after adding user creds
  async proxy(req, res, next) {
    console.log(
      'AUTH0 API PROXY ==============================================',
      '\n'
    )
    console.log(
      'Adding user third party access token to request:',
      req.thirdPartyAccessToken,
      '\n'
    )
    const proxyOptions = {
      target: process.env.AUTH0_ISSUER_BASE_URL,
      changeOrigin: true,
      pathRewrite: {
        '^/api/auth0/proxy': '',
      },
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${req.thirdPartyAccessToken}`,
      },
    }

    createProxyMiddleware(proxyOptions)(req, res, next)
  },

  // LOGOUT HANDLER ==============================================
  // Simply deletes the user's Auth0 creds from our store (will requre the user login again next visit)
  async logout(req, res, next) {
    console.log(
      'LOGOUT HANDLER ==============================================',
      '\n'
    )
    try {
      console.log('Removing user data from store', '\n')
      await store.logoutUser(req.session.user)
      res.json({ status: 'ok' })
    } catch (error) {
      console.error(error)
      next(error)
    }
  },
}
