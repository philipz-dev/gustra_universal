/**
 * Jest mock for `@noble/hashes/sha2.js` (ESM-only package).
 * SHA-256 key derivation via node's native crypto.
 */
const { createHash } = require('node:crypto');

function sha256(data) {
  return new Uint8Array(createHash('sha256').update(Buffer.from(data)).digest());
}

module.exports = { sha256 };
