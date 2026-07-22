import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';

/**
 * Swift `BackupService.deriveKey` — SHA256(UTF-8(password)), no salt/KDF.
 * File layout matches CryptoKit `AES.GCM.SealedBox.combined`:
 * nonce (12) || ciphertext || tag (16).
 */
export function deriveBackupKey(password: string): Uint8Array {
  return sha256(new TextEncoder().encode(password));
}

export function encryptBackupJson(
  jsonUtf8: string,
  password: string,
): Uint8Array {
  const key = deriveBackupKey(password);
  const nonce = randomBytes(12);
  const plaintext = new TextEncoder().encode(jsonUtf8);
  const sealed = gcm(key, nonce).encrypt(plaintext); // ciphertext || tag
  const combined = new Uint8Array(nonce.length + sealed.length);
  combined.set(nonce, 0);
  combined.set(sealed, nonce.length);
  return combined;
}

export function decryptBackupJson(
  combined: Uint8Array,
  password: string,
): string {
  if (combined.length < 12 + 16) {
    throw new Error('Incorrect backup password.');
  }
  const key = deriveBackupKey(password);
  const nonce = combined.slice(0, 12);
  const sealed = combined.slice(12);
  try {
    const plaintext = gcm(key, nonce).decrypt(sealed);
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error('Incorrect backup password.');
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
