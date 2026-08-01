import {
  deriveBackupKey,
  encryptBackupJson,
  decryptBackupJson,
  bytesToBase64,
  base64ToBytes,
} from '@/services/backup/crypto';

describe('backup crypto', () => {
  it('derives a stable 32-byte key from a password', () => {
    const a = deriveBackupKey('hunter2');
    const b = deriveBackupKey('hunter2');
    const c = deriveBackupKey('different');
    expect(a.length).toBe(32);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('round-trips JSON through encrypt + decrypt', () => {
    const payload = JSON.stringify({
      schemaVersion: 1,
      reviews: [{ id: 'r1', note: 'café' }],
      restaurants: [],
    });
    const sealed = encryptBackupJson(payload, 'correct horse');
    expect(sealed.length).toBeGreaterThan(payload.length + 12); // nonce + tag

    const opened = decryptBackupJson(sealed, 'correct horse');
    expect(opened).toBe(payload);
  });

  it('uses a fresh nonce per encryption (different ciphertext)', () => {
    const payload = 'same content';
    const a = encryptBackupJson(payload, 'pw');
    const b = encryptBackupJson(payload, 'pw');
    expect(a).not.toEqual(b);
  });

  it('rejects the wrong password', () => {
    const sealed = encryptBackupJson('secret data', 'right');
    expect(() => decryptBackupJson(sealed, 'wrong')).toThrow(
      'Incorrect backup password.',
    );
  });

  it('rejects a truncated payload', () => {
    expect(() => decryptBackupJson(new Uint8Array(4), 'pw')).toThrow(
      'Incorrect backup password.',
    );
  });

  it('round-trips base64 conversions', () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 255, 42]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});
