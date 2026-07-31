import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Reads the Google API key from local `.env` only
 * (`EXPO_PUBLIC_GOOGLE_API_KEY`). Never commit the real key.
 */
function googleApiKey(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ||
    ''
  );
}

function geminiApiKey(): string {
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() || '';
}

function sentryOrg(): string {
  return process.env.SENTRY_ORG?.trim() || '';
}

function sentryProject(): string {
  return process.env.SENTRY_PROJECT?.trim() || 'gustra';
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const key = googleApiKey();
  const geminiKey = geminiApiKey();
  const sentryOrganization = sentryOrg();


  // `newArchEnabled` is valid Expo config; ExpoConfig typings lag behind SDK 57.
  return {
    ...config,
    name: 'Gustra',
    slug: 'gustra',
    // Same marketing version as the Swift App Store app; iOS build continues that sequence.
    version: '1.0',
    orientation: 'default',
    icon: './assets/images/icon.png',
    scheme: 'gustra',
    userInterfaceStyle: 'light',
    backgroundColor: '#F5EEDD',
    newArchEnabled: true,
    updates: {
      enabled: false,
      checkAutomatically: 'NEVER',
      fallbackToCacheTimeout: 0,
    },
    ios: {
      supportsTablet: true,
      // Must match the existing App Store Connect / Swift app.
      bundleIdentifier: 'com.philip.gustra',
      buildNumber: '40',
      // Keep in sync with android.versionCode — deploy-store.sh bumps both together.
      entitlements: {
        'com.apple.security.application-groups': ['group.com.philip.gustra'],
      },
      infoPlist: {
        CFBundleAllowMixedLocalizations: true,
        NSCameraUsageDescription:
          'Gustra uses the camera to take photos for your profile and restaurant reviews.',
        NSPhotoLibraryUsageDescription:
          'Gustra uses your photo library to import photos for your profile and restaurant reviews.',
        NSPhotoLibraryAddUsageDescription:
          'Gustra saves review photos to your photo library when you choose Save to Photos.',
        NSLocationWhenInUseUsageDescription:
          'Gustra uses your location to find nearby restaurants.',
        LSApplicationQueriesSchemes: ['comgooglemaps', 'waze', 'tel'],
        // Required when CFBundleDocumentTypes is set (ASC warning 90737).
        LSSupportsOpeningDocumentsInPlace: true,
        // Files → On My iPhone → Gustra (Swift parity).
        UIFileSharingEnabled: true,
        // Standard HTTPS only — skips export-compliance prompt in App Store Connect.
        ITSAppUsesNonExemptEncryption: false,
        CFBundleDocumentTypes: [
          {
            CFBundleTypeName: 'Gustra Share Package',
            CFBundleTypeRole: 'Viewer',
            LSHandlerRank: 'Owner',
            LSItemContentTypes: ['com.philip.gustra.share'],
          },
        ],
        UTExportedTypeDeclarations: [
          {
            UTTypeIdentifier: 'com.philip.gustra.share',
            UTTypeDescription: 'Gustra Share Package',
            // public.data only — conforming to public.json makes WhatsApp /
            // Quick Look treat the file as blank JSON and rename to .json.
            UTTypeConformsTo: ['public.data'],
            UTTypeTagSpecification: {
              'public.filename-extension': ['gustrashare'],
              'public.mime-type': ['application/x-gustrashare'],
            },
          },
        ],
      },
      config: {
        googleMapsApiKey: key,
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#F5EEDD',
        // Foreground keeps the mark inside the Android adaptive safe zone
        // (~66% center); full-bleed art gets cropped on launchers.
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      package: 'net.gustra.app',
      // Keep in sync with ios.buildNumber — deploy-store.sh bumps both together.
      versionCode: 40,
      // Material / gesture navigation — cream surfaces bleed under system bars.
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: true,
      // Keep focused fields visible with our scroll-into-view + tab-bar hide.
      softwareKeyboardLayoutMode: 'resize',
      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
      intentFilters: [
        {
          action: 'VIEW',
          category: ['BROWSABLE', 'DEFAULT'],
          data: [
            {
              scheme: 'gustra',
              host: 'import-share',
            },
          ],
        },
        {
          action: 'VIEW',
          category: ['BROWSABLE', 'DEFAULT'],
          data: [
            {
              scheme: 'content',
              mimeType: 'application/x-gustrashare',
            },
            {
              scheme: 'file',
              pathPattern: '.*\\\\.gustrashare',
            },
            {
              scheme: 'content',
              pathPattern: '.*\\\\.gustrashare',
            },
            // Legacy shares that WhatsApp/Mail rewrote as .json
            {
              scheme: 'content',
              mimeType: 'application/json',
              pathPattern: '.*\\\\.json',
            },
          ],
        },
      ],
      config: {
        googleMaps: {
          apiKey: key,
        },
      },
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    locales: {
      de: './locales/de.json',
      es: './locales/es.json',
      fr: './locales/fr.json',
      it: './locales/it.json',
      nl: './locales/nl.json',
    },
    plugins: [
      'expo-router',
      'expo-dev-client',
      'expo-web-browser',
      [
        'expo-localization',
        {
          supportedLocales: {
            ios: ['de', 'en', 'es', 'fr', 'it', 'nl'],
            android: ['de', 'en', 'es', 'fr', 'it', 'nl'],
          },
        },
      ],
      [
        'expo-screen-orientation',
        {
          initialOrientation: 'PORTRAIT_UP',
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#F5EEDD',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Gustra uses your photo library to import photos for your profile and restaurant reviews.',
          cameraPermission:
            'Gustra uses the camera to take photos for your profile and restaurant reviews.',
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission:
            'Gustra uses your photo library to import photos for your profile and restaurant reviews.',
          savePhotosPermission:
            'Gustra saves review photos to your photo library when you choose Save to Photos.',
          isAccessMediaLocationEnabled: false,
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Gustra uses your location to find nearby restaurants.',
        },
      ],
      [
        'react-native-maps',
        {
          iosGoogleMapsApiKey: key,
          androidGoogleMapsApiKey: key,
        },
      ],
      [
        'expo-sharing',
        {
          ios: {
            enabled: true,
            appGroupId: 'group.com.philip.gustra',
            // Same App ID family as the Swift Share Extension.
            extensionBundleIdentifier: 'com.philip.gustra.shareextension',
            // Swift parity: only offer Gustra for .gustrashare / data / file URLs.
            activationRule:
              'SUBQUERY(extensionItems, $extensionItem, SUBQUERY($extensionItem.attachments, $attachment, ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "com.philip.gustra.share" OR ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.data" OR ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.file-url").@count >= 1).@count >= 1',
          },
        },
      ],
      './plugins/withGustraShareExtensionPatch.js',
      '@react-native-community/datetimepicker',
      'expo-mail-composer',
      [
        'expo-ocr-kit',
        {
          cameraPermission:
            'Gustra uses the camera to take photos for your profile and restaurant reviews.',
        },
      ],
      'expo-system-ui',
      [
        'expo-navigation-bar',
        {
          // Plugin + Kotlin: style "dark" → windowLightNavigationBar=true → dark icons.
          // (Docs NavigationBarStyle wording is inverted vs the implementation.)
          // setStyle only applies when enforceContrast is false (Expo SDK 57).
          style: 'dark',
          enforceContrast: false,
        },
      ],
      // Source maps / native symbols on EAS & local release builds.
      // Set SENTRY_ORG + SENTRY_PROJECT + SENTRY_AUTH_TOKEN (never commit token).
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          organization: sentryOrganization || 'gustra',
          project: sentryProject(),
          note: 'Use SENTRY_AUTH_TOKEN env to authenticate with Sentry.',
        },
      ],
    ],
    extra: {
      googleApiKey: key,
      googlePlacesApiKey: key,
      geminiApiKey: geminiKey,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || '',
      eas: {
        projectId: 'b149ff2c-d2c0-4105-99eb-c9ba14608290',
      },
    },
    experiments: {
      typedRoutes: true,
      // Web-only. Default `/demo` leaked into native dev-client as
      // `transform.baseUrl=/demo`. Set via GUSTRA_WEB_BASE_URL in deploy-web.
      ...(process.env.GUSTRA_WEB_BASE_URL?.trim()
        ? { baseUrl: process.env.GUSTRA_WEB_BASE_URL.trim() }
        : {}),
    },
  } as ExpoConfig;
};
