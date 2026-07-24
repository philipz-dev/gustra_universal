import { i18n } from '@/i18n';

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
  if (!password) return i18n.t('backup.enterPassword');
  if (password.length < BACKUP_PASSWORD_MIN_LENGTH) {
    return i18n.t('backup.passwordTooShort', {
      count: BACKUP_PASSWORD_MIN_LENGTH,
    });
  }
  if (!HAS_LETTER.test(password)) {
    return i18n.t('backup.passwordNeedsLetter');
  }
  if (!HAS_DIGIT.test(password)) {
    return i18n.t('backup.passwordNeedsNumber');
  }
  if (!HAS_SYMBOL.test(password)) {
    return i18n.t('backup.passwordNeedsSymbol');
  }
  return null;
}

/** Localized password policy hint for create-backup UI. */
export function backupPasswordHint(): string {
  return i18n.t('backup.passwordHint');
}
