# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Data compatibility (mandatory)

All updates/builds must stay **backwards compatible** with on-device data from **every prior Gustra version** (AsyncStorage, `.gustra`, `.gustrashare`, Swift store). See `.cursor/rules/backwards-compatible-data.mdc`. Never ship breaking schema changes without a dual-read migration; never discard years of reviews.

# i18n (mandatory)

User-facing strings must be translated in **all** locales (`en`, `nl`, `fr`, `es`, `de`, `it`) in the same change — no English leftovers in other languages. See `.cursor/rules/i18n-all-languages.mdc`. Run `npm run i18n:check` after editing locales.
