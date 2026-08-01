/**
 * Jest mock for `@noble/ciphers/utils.js` (ESM-only package).
 * `randomBytes(12)` powers the fresh-per-encryption nonce in crypto.ts.
 */
const { randomBytes: nodeRandomBytes } = require('node:crypto');

function randomBytes(length) {
  return new Uint8Array(nodeRandomBytes(length));
}

module.exports = { randomBytes };
