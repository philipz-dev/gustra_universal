import { useTranslation } from 'react-i18next';

/** Consistent `t` / i18n access for app UI. */
export function useAppTranslation() {
  return useTranslation();
}
