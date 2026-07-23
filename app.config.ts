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

export default ({ config }: ConfigContext): ExpoConfig => {
  const key = googleApiKey();

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
      buildNumber: '18',
      entitlements: {
        'com.apple.security.application-groups': ['group.com.philip.gustra'],
      },
      infoPlist: {
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
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
      },
      package: 'net.gustra.app',
      // Play Console versionCode; bumped by scripts/deploy-android-internal.sh (start 0 → first deploy is 1)
      versionCode: 0,
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
    plugins: [
      'expo-router',
      'expo-dev-client',
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
          // `light` = dark buttons on cream; no contrast scrim (house surface).
          style: 'light',
          enforceContrast: false,
        },
      ],
    ],
    extra: {
      googleApiKey: key,
      googlePlacesApiKey: key,
      eas: {
        projectId: 'b149ff2c-d2c0-4105-99eb-c9ba14608290',
      },
    },
    experiments: {
      typedRoutes: true,
      // Static web deploy lives at https://gustra.net/webversion/
      baseUrl: '/webversion',
    },
  } as ExpoConfig;
};
