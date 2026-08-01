/**
 * Jest mock for `@noble/ciphers/aes.js` (ESM-only package).
 * Uses node's native AES-256-GCM so the combined layout produced by
 * `services/backup/crypto.ts` (nonce || ciphertext || tag) stays testable
 * without transpiling the ESM-only noble sources.
 */
const { createCipheriv, createDecipheriv } = require('node:crypto');

function gcm(key, nonce) {
  return {
    encrypt(plaintext) {
      const cipher = createCipheriv('aes-256-gcm', key, nonce);
      const ciphertext = Buffer.concat([
        cipher.update(Buffer.from(plaintext)),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      return new Uint8Array(Buffer.concat([ciphertext, tag]));
    },
    decrypt(sealed) {
      const buffer = Buffer.from(sealed);
      const ciphertext = buffer.subarray(0, buffer.length - 16);
      const tag = buffer.subarray(buffer.length - 16);
      const decipher = createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return new Uint8Array(plaintext);
    },
  };
}

module.exports = { gcm };
