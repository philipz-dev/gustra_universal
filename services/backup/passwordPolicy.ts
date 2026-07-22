/** Rules for creating a Gustra backup password. */
export const BACKUP_PASSWORD_MIN_LENGTH = 7;

const HAS_LETTER = /\p{L}/u;
const HAS_DIGIT = /\p{N}/u;
/** Any non-letter, non-digit character counts as a symbol. */
const HAS_SYMBOL = /[^\p{L}\p{N}]/u;

export function isValidBackupPassword(password: string): boolean {
  if (password.length < BACKUP_PASSWORD_MIN_LENGTH) return false;
  return (
    HAS_LETTER.test(password) &&
    HAS_DIGIT.test(password) &&
    HAS_SYMBOL.test(password)
  );
}

export function backupPasswordError(password: string): string | null {
  if (!password) return 'Enter a backup password.';
  if (password.length < BACKUP_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${BACKUP_PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!HAS_LETTER.test(password)) {
    return 'Password must include at least one letter.';
  }
  if (!HAS_DIGIT.test(password)) {
    return 'Password must include at least one number.';
  }
  if (!HAS_SYMBOL.test(password)) {
    return 'Password must include at least one symbol.';
  }
  return null;
}

export const BACKUP_PASSWORD_HINT =
  'Min. 7 characters, with at least one letter, number, and symbol.';
