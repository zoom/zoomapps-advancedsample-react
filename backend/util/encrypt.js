const crypto = require('crypto')

module.exports = {
  afterSerialization(text) {
    const iv = crypto.randomBytes(16)
    const aes = crypto.createCipheriv(
      'aes-256-cbc',
      process.env.REDIS_ENCRYPTION_KEY,
      iv
    )
    let ciphertext = aes.update(text)
    ciphertext = Buffer.concat([iv, ciphertext, aes.final()])
    return ciphertext.toString('base64')
  },

  beforeDeserialization(ciphertext) {
    const ciphertextBytes = Buffer.from(ciphertext, 'base64')
    const iv = ciphertextBytes.subarray(0, 16)
    const data = ciphertextBytes.subarray(16)
    const aes = crypto.createDecipheriv(
      'aes-256-cbc',
      process.env.REDIS_ENCRYPTION_KEY,
      iv
    )
    let plaintextBytes = Buffer.from(aes.update(data))
    plaintextBytes = Buffer.concat([plaintextBytes, aes.final()])
    return plaintextBytes.toString()
  },
}
