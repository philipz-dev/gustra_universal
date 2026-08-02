/**
 * Jest config for Gustra (Expo SDK 57 / React Native 0.86).
 *
 * Only pure-logic modules are tested (ratings, drafts, passport stats,
 * time travel, backup crypto) — no React component rendering, so no
 * react-native preset is needed. The `@/` alias maps to the repo root.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Pure-logic tests never boot i18next/Expo — map i18n to a stub.
    '^@/i18n$': '<rootDir>/__mocks__/i18n.ts',
    // expo-localization ships Metro-compiled ESM; stub it out entirely.
    '^expo-localization$': '<rootDir>/__mocks__/expo-localization.ts',
    // expo-file-system/legacy needs native FileSystem; stub the subset used.
    '^expo-file-system/legacy$': '<rootDir>/__mocks__/expo-file-system-legacy.ts',
    // ESM-only noble packages → native node crypto equivalents.
    '^@noble/ciphers/aes\\.js$': '<rootDir>/__mocks__/noble-ciphers-aes.js',
    '^@noble/ciphers/utils\\.js$': '<rootDir>/__mocks__/noble-ciphers-utils.js',
    '^@noble/hashes/sha2\\.js$': '<rootDir>/__mocks__/noble-hashes-sha2.js',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'services/reviews/ratings.ts',
    'services/reviews/draftReview.ts',
    'services/backup/crypto.ts',
    'data/passportStats.ts',
    'data/timeMachine.ts',
    'context/AdvancedMenu.ts',
  ],
  clearMocks: true,
};
