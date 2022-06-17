const redis = require('redis')
const encrypt = require('./encrypt')
const util = require('util')
/**
 * The auth token exchange happens before the Zoom App is launched. Therefore,
 * we need a place to store the tokens so we can later use them when a session
 * is established.
 *
 * We're using Redis here, but this could be replaced by a cache or other means
 * of persistence.
 */

const db = redis.createClient({
  url: process.env.REDIS_URL,
})

const getAsync = util.promisify(db.get).bind(db)
const setAsync = util.promisify(db.set).bind(db)
const delAsync = util.promisify(db.del).bind(db)

db.on('error', console.error)

module.exports = {
  getUser: async function (zoomUserId) {
    const user = await getAsync(zoomUserId)
    if (!user) {
      console.log(
        'User not found.  This is normal if the user has added via In-Client (or if you have restarted Docker without closing and reloading the app)'
      )
      return Promise.reject('User not found')
    }
    return JSON.parse(encrypt.beforeDeserialization(user))
  },

  upsertUser: function (zoomUserId, accessToken, refreshToken, expired_at) {
    const isValidUser = Boolean(
      typeof zoomUserId === 'string' &&
        typeof accessToken === 'string' &&
        typeof refreshToken === 'string' &&
        typeof expired_at === 'number'
    )

    if (!isValidUser) {
      return Promise.reject('Invalid user input')
    }

    return setAsync(
      zoomUserId,
      encrypt.afterSerialization(
        JSON.stringify({ accessToken, refreshToken, expired_at })
      )
    )
  },

  updateUser: async function (zoomUserId, data) {
    const userData = await getAsync(zoomUserId)
    const existingUser = JSON.parse(encrypt.beforeDeserialization(userData))
    const updatedUser = { ...existingUser, ...data }

    return setAsync(
      zoomUserId,
      encrypt.afterSerialization(JSON.stringify(updatedUser))
    )
  },

  logoutUser: async function (zoomUserId) {
    const reply = await getAsync(zoomUserId)
    const decrypted = JSON.parse(encrypt.beforeDeserialization(reply))
    delete decrypted.thirdPartyAccessToken
    return setAsync(
      zoomUserId,
      encrypt.afterSerialization(JSON.stringify(decrypted))
    )
  },

  deleteUser: (zoomUserId) => delAsync(zoomUserId),

  storeInvite: (invitationID, tabState) => {
    const dbKey = `invite:${invitationID}`
    return setAsync(dbKey, tabState)
  },

  getInvite: (invitationID) => {
    const dbKey = `invite:${invitationID}`
    return getAsync(dbKey)
  },
}
