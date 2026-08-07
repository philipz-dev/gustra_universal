import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import { GoogleAPIConfig } from '@/constants/GoogleAPIConfig';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { incrementGoogleApi } from '@/services/google/GoogleApiTracker';
import {
  assertGoogleApiAllowed,
  isGoogleApiQuotaExceededError,
} from '@/services/google/GoogleApiQuota';
import { buildMapHtml } from '@/services/map/mapHtml';
import type { LatLng } from '@/services/places';

export type GoogleMapMarker = {
  id: string;
  coordinate: LatLng;
  title: string;
  /** Pin fill color (default forest green). */
  color?: string;
  isSelected?: boolean;
};

export type GoogleMapsViewHandle = {
  animateTo: (center: LatLng, zoom?: number) => void;
  fitToMarkers: (padding?: number) => void;
  /** Reload the WebView and re-apply markers/fit (used on tab focus / retry). */
  refresh: () => void;
  /** True when the map is currently in an error state (white map). */
  hasError: () => boolean;
  /** Reload only when the WebView is stale (no pong within timeout). */
  reloadIfStale: () => Promise<void>;
};

type GoogleMapsViewProps = {
  initialCenter: LatLng;
  initialZoom?: number;
  markers: GoogleMapMarker[];
  showsUserLocation?: boolean;
  userLocation?: LatLng | null;
  /**
   * Fit camera to markers (+ optional user) once when the map becomes ready
   * (and when markers first appear). Does not re-fit on later marker updates
   * so pan/zoom survives navigation.
   */
  fitToMarkers?: boolean;
  /** Extra coordinate included in fit bounds (e.g. user). */
  fitIncludeCoordinate?: LatLng | null;
  /** Bottom map padding in CSS px (tab bar clearance). */
  mapPaddingBottom?: number;
  onReady?: () => void;
  onIdle?: (center: LatLng, radiusMeters: number, zoom: number) => void;
  onMarkerPress?: (id: string) => void;
  onMapPress?: () => void;
};

/**
 * Google Maps JavaScript API in a WebView.
 * `baseUrl` is required — without it Google rejects the key (about:blank).
 */
export const GoogleMapsView = forwardRef<
  GoogleMapsViewHandle,
  GoogleMapsViewProps
>(function GoogleMapsView(
  {
    initialCenter,
    initialZoom = 14,
    markers,
    showsUserLocation = false,
    userLocation = null,
    fitToMarkers = false,
    fitIncludeCoordinate = null,
    mapPaddingBottom = 0,
    onReady,
    onIdle,
    onMarkerPress,
    onMapPress,
  },
  ref,
) {
  const { t } = useAppTranslation();
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  /** One-shot auto-fit so returning from a review does not reset the camera. */
  const didAutoFitRef = useRef(false);
  /** Set after a manual reload so the fresh WebView re-applies markers/fit. */
  const refreshedRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pongResolverRef = useRef<((alive: boolean) => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const fitRef = useRef({
    fitToMarkers,
    fitIncludeCoordinate,
    mapPaddingBottom,
  });
  fitRef.current = { fitToMarkers, fitIncludeCoordinate, mapPaddingBottom };

  const html = useMemo(
    () =>
      buildMapHtml({
        apiKey: GoogleAPIConfig.apiKey,
        center: initialCenter,
        zoom: initialZoom,
        forestGreen: GustraColors.forestGreen,
        mapPaddingBottom,
      }),
    // Initial camera / padding only — later moves go through imperative API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (pongTimerRef.current) clearTimeout(pongTimerRef.current);
    };
  }, []);

  const inject = (js: string) => {
    try {
      // Android loads injectJavaScript as a javascript: URL — bare `#` truncates
      // the script (hex pin colors like #388C57 never reached the map).
      webRef.current?.injectJavaScript(`${js.replace(/#/g, '\\u0023')}; true;`);
    } catch {
      // WebView may be unmounted mid-update — ignore.
    }
  };

  const applyFit = () => {
    if (!readyRef.current || !fitRef.current.fitToMarkers) return;
    const include = fitRef.current.fitIncludeCoordinate;
    const points = markersRef.current.map((m) => ({
      lat: m.coordinate.latitude,
      lng: m.coordinate.longitude,
    }));
    if (include) {
      points.push({ lat: include.latitude, lng: include.longitude });
    }
    if (points.length === 0) return;
    inject(
      `window.__gustraFitBounds(${JSON.stringify(points)}, ${JSON.stringify(fitRef.current.mapPaddingBottom)})`,
    );
    didAutoFitRef.current = true;
  };

  const applyFitOnce = () => {
    if (didAutoFitRef.current) return;
    if (!fitRef.current.fitToMarkers) {
      // Caller restored camera via initialCenter/zoom — don't auto-fit later.
      didAutoFitRef.current = true;
      return;
    }
    applyFit();
  };

  /**
   * Full reload of the WebView. Clears the error state and resets the
   * one-shot auto-fit so a fresh WebView re-fits the markers. Used by the
   * retry timer, the error overlay's "Opnieuw laden" button, and the map
   * screen's focus refresh.
   */
  const reloadWebView = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (pongTimerRef.current) clearTimeout(pongTimerRef.current);
    readyRef.current = false;
    didAutoFitRef.current = false;
    refreshedRef.current = true;
    setError(null);
    // Reloading may silently fail if the WebView is still initializing;
    // guard against a permanently white map by retrying a few times.
    retryTimerRef.current = setTimeout(() => {
      try {
        webRef.current?.reload();
      } catch {
        // WebView may be unmounted — ignore.
      }
    }, 0);
  }, []);

  /**
   * Ping the WebView to verify the map runtime is still alive. Resolves true
   * when the map replies within the timeout. A silent WebView (reloaded but
   * never ready again) never answers — that is the "white map" case.
   */
  const ping = useCallback((): Promise<boolean> => {
    if (pongTimerRef.current) clearTimeout(pongTimerRef.current);
    return new Promise((resolve) => {
      pongResolverRef.current = resolve;
      pongTimerRef.current = setTimeout(() => {
        pongResolverRef.current = null;
        resolve(false);
      }, 1500);
      try {
        webRef.current?.injectJavaScript(
          'window.__gustraPing && window.__gustraPing(); true;',
        );
      } catch {
        if (pongTimerRef.current) clearTimeout(pongTimerRef.current);
        pongResolverRef.current = null;
        resolve(false);
      }
    });
  }, []);

  useImperativeHandle(ref, () => ({
    animateTo(center, zoom = 15) {
      inject(
        `window.__gustraAnimate(${center.latitude}, ${center.longitude}, ${zoom})`,
      );
    },
    fitToMarkers(padding = 64) {
      const points = markersRef.current.map((m) => ({
        lat: m.coordinate.latitude,
        lng: m.coordinate.longitude,
      }));
      const include = fitRef.current.fitIncludeCoordinate;
      if (include) {
        points.push({ lat: include.latitude, lng: include.longitude });
      }
      inject(
        `window.__gustraFitBounds(${JSON.stringify(points)}, ${JSON.stringify(padding)})`,
      );
      didAutoFitRef.current = true;
    },
    refresh() {
      reloadWebView();
    },
    hasError() {
      return error != null;
    },
    /** Reload only when the WebView is stale (no pong within timeout). */
    async reloadIfStale() {
      const alive = await ping();
      if (!alive) reloadWebView();
    },
  }));

  useEffect(() => {
    if (!readyRef.current) return;
    inject(`window.__gustraSetMarkers(${JSON.stringify(markers)})`);
    applyFitOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (!showsUserLocation || !userLocation) {
      inject('window.__gustraSetUser(null)');
      return;
    }
    inject(
      `window.__gustraSetUser(${JSON.stringify({
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      })})`,
    );
    applyFitOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showsUserLocation, userLocation]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as {
        type: string;
        id?: string;
        lat?: number;
        lng?: number;
        radius?: number;
        zoom?: number;
        message?: string;
      };
      if (payload.type === 'pong') {
        if (pongTimerRef.current) clearTimeout(pongTimerRef.current);
        pongTimerRef.current = null;
        pongResolverRef.current?.(true);
        pongResolverRef.current = null;
        return;
      }
      if (payload.type === 'error') {
        setError(
          payload.message ??
            t('map.loadFailedBody') ??
            'Google Maps failed to load. Enable Maps JavaScript API for this key.',
        );
        return;
      }
      if (payload.type === 'ready') {
        readyRef.current = true;
        setError(null);
        void (async () => {
          try {
            await assertGoogleApiAllowed('maps');
          } catch (error) {
            if (isGoogleApiQuotaExceededError(error)) {
              setError(error.message);
              return;
            }
            throw error;
          }
          void incrementGoogleApi('maps');
          // A fresh WebView (after reload) needs the markers re-applied; the
          // ready callback may otherwise run before the markers effect.
          if (refreshedRef.current || markersRef.current.length > 0) {
            inject(
              `window.__gustraSetMarkers(${JSON.stringify(markersRef.current)})`,
            );
          }
          if (showsUserLocation && userLocation) {
            inject(
              `window.__gustraSetUser(${JSON.stringify({
                lat: userLocation.latitude,
                lng: userLocation.longitude,
              })})`,
            );
          }
          applyFitOnce();
          onReady?.();
        })();
        return;
      }
      if (payload.type === 'idle' && payload.lat != null && payload.lng != null) {
        onIdle?.(
          { latitude: payload.lat, longitude: payload.lng },
          payload.radius ?? 2000,
          typeof payload.zoom === 'number' ? payload.zoom : initialZoom,
        );
        return;
      }
      if (payload.type === 'marker' && payload.id) {
        onMarkerPress?.(payload.id);
        return;
      }
      if (payload.type === 'mapTap') {
        onMapPress?.();
      }
    } catch {
      // Ignore malformed bridge messages.
    }
  };

  return (
    <View style={styles.fill}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost/' }}
        style={styles.fill}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        onError={() =>
          setError(t('map.loadFailedBody'))
        }
      />
      {error ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>{t('map.loadFailedTitle')}</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('map.reload')}
            onPress={reloadWebView}
            style={({ pressed }) => [
              styles.errorButton,
              pressed && styles.errorButtonPressed,
            ]}>
            <Text style={styles.errorButtonLabel}>{t('map.reload')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(245, 238, 221, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  errorTitle: {
    ...bodyTextStyle,
    fontSize: 17,
    fontWeight: '700',
    color: GustraColors.ink,
    textAlign: 'center',
  },
  errorBody: {
    ...bodyTextStyle,
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.65)',
    textAlign: 'center',
  },
  errorButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: GustraColors.forestGreen,
  },
  errorButtonPressed: {
    opacity: 0.85,
  },
  errorButtonLabel: {
    ...bodyTextStyle,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
