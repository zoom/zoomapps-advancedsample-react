const crypto = require('crypto')
const base64url = require('base64url')

// The Zoom App context header is an encrypted JSON string
// This function unpacks, decrypts, and parses the context from the header
function decryptZoomAppContext(
  context,
  secretKey = process.env.ZOOM_APP_CLIENT_SECRET
) {
  // Decode base64
  let buf = Buffer.from(context, 'base64')

  // Get iv length (1 byte)
  const ivLength = buf.readUInt8()
  buf = buf.subarray(1)

  // Get iv
  const iv = buf.subarray(0, ivLength)
  buf = buf.subarray(ivLength)

  // Get aad length (2 bytes)
  const aadLength = buf.readUInt16LE()
  buf = buf.subarray(2)

  // Get aad
  const aad = buf.subarray(0, aadLength)
  buf = buf.subarray(aadLength)

  // Get cipher length (4 bytes)
  const cipherLength = buf.readInt32LE()
  buf = buf.subarray(4)

  // Get cipherText
  const cipherText = buf.subarray(0, cipherLength)

  // Get tag
  const tag = buf.subarray(cipherLength)

  // AES/GCM decryption
  const decipher = crypto
    .createDecipheriv(
      'aes-256-gcm',
      // hash the secret key first
      crypto.createHash('sha256').update(secretKey).digest(),
      iv
    )
    .setAAD(aad)
    .setAuthTag(tag)
    .setAutoPadding(false)

  const decrypted =
    decipher.update(cipherText, 'hex', 'utf-8') + decipher.final('utf-8')

  // Return JS object
  return JSON.parse(decrypted)
}

const createRequestParamString = (params) => {
  const requestParams = new URLSearchParams()

  for (let param in params) {
    const value = params[param]
    requestParams.set(param, value)
  }

  return requestParams.toString()
}

const hmacBase64 = (str) =>
  crypto
    .createHmac('sha256', process.env.ZOOM_APP_OAUTH_STATE_SECRET)
    .update(str)
    .digest('base64')

const generateCodeVerifier = () => {
  return crypto.randomBytes(64).toString('hex')
}

const generateCodeChallenge = (codeVerifier) => {
  const base64Digest = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
  return base64url.fromBase64(base64Digest)
}

const generateState = () => {
  const ts = crypto.randomBytes(64).toString('hex')
  const hmac = hmacBase64(ts)
  return encodeURI([hmac, ts].join('.')).replace('+', '') // the replace is important because Auth0 encodes their returned state, eg with space instead of +
}

module.exports = {
  decryptZoomAppContext,
  createRequestParamString,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
}
