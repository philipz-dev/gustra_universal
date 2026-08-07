import type { LatLng } from '@/services/places';

/**
 * Builds the Google Maps WebView HTML document.
 * Kept free of React Native imports so it can be unit-tested in Jest.
 */
export function buildMapHtml(options: {
  apiKey: string;
  center: LatLng;
  zoom: number;
  forestGreen: string;
  mapPaddingBottom: number;
}): string {
  const { apiKey, center, zoom, forestGreen, mapPaddingBottom } = options;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F5EEDD; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = null;
    var markerById = {};
    var userMarker = null;
    var FOREST = ${JSON.stringify(forestGreen)};
    var MAP_PADDING_BOTTOM = ${JSON.stringify(mapPaddingBottom)};

    function post(payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    window.gm_authFailure = function () {
      post({
        type: 'error',
        message: 'Google Maps authentication failed. In Google Cloud, enable “Maps JavaScript API” for this key (and allow HTTP referrers, or leave key unrestricted for development).',
      });
    };

    window.__gustraPing = function () {
      post({ type: 'pong' });
    };

    function visibleRadiusMeters() {
      if (!map || !map.getBounds()) return 2000;
      var c = map.getCenter();
      var ne = map.getBounds().getNorthEast();
      var R = 6371000;
      var toRad = function (d) { return d * Math.PI / 180; };
      var dLat = toRad(ne.lat() - c.lat());
      var dLng = toRad(ne.lng() - c.lng());
      var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
        Math.cos(toRad(c.lat()))*Math.cos(toRad(ne.lat()))*
        Math.sin(dLng/2)*Math.sin(dLng/2);
      var dist = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
      return Math.max(200, Math.min(dist, 50000));
    }

    function pinIcon(color, selected) {
      // Match Swift GMSMarker.markerImage(with:) — teardrop “flag” pin, not a circle.
      var scale = selected ? 1.55 : 1;
      var w = Math.round(28 * scale);
      var h = Math.round(40 * scale);
      var fill = (color || FOREST).replace(/"/g, '');
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 28 40">' +
        '<path fill="' + fill + '" stroke="#FFFFFF" stroke-width="1.75" ' +
        'd="M14 1.25C7.55 1.25 2.25 6.55 2.25 13c0 8.6 10.35 21.05 11.15 21.95a1.1 1.1 0 0 0 1.6 0C15.8 34.05 25.75 21.6 25.75 13c0-6.45-5.3-11.75-11.75-11.75z"/>' +
        '<circle fill="#FFFFFF" cx="14" cy="13" r="4.75"/>' +
        '</svg>';
      return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(w, h),
        anchor: new google.maps.Point(w / 2, h),
      };
    }

    window.__gustraAnimate = function (lat, lng, zoom) {
      if (!map) return;
      map.panTo({ lat: lat, lng: lng });
      if (typeof zoom === 'number') map.setZoom(zoom);
    };

    window.__gustraFitBounds = function (points, bottomPad) {
      if (!map || !points || !points.length) return;
      var pad = typeof bottomPad === 'number' ? bottomPad : MAP_PADDING_BOTTOM;
      if (points.length === 1) {
        map.panTo(points[0]);
        map.setZoom(13);
        return;
      }
      var bounds = new google.maps.LatLngBounds();
      points.forEach(function (p) { bounds.extend(p); });
      map.fitBounds(bounds, {
        top: 64,
        right: 48,
        bottom: Math.max(64, pad || 0) + 24,
        left: 48,
      });
    };

    window.__gustraSetMarkers = function (markers) {
      if (!map || !markers) return;
      var keep = {};
      var hasSelection = markers.some(function (m) { return m.isSelected; });
      markers.forEach(function (m) {
        keep[m.id] = true;
        var pos = { lat: m.coordinate.latitude, lng: m.coordinate.longitude };
        var existing = markerById[m.id];
        if (!existing) {
          existing = new google.maps.Marker({
            map: map,
            position: pos,
            title: m.title || '',
          });
          existing.addListener('click', function () {
            post({ type: 'marker', id: m.id });
          });
          markerById[m.id] = existing;
        } else {
          existing.setPosition(pos);
          existing.setTitle(m.title || '');
        }
        existing.setIcon(pinIcon(m.color, !!m.isSelected));
        existing.setOpacity(hasSelection && !m.isSelected ? 0.35 : 1);
        existing.setZIndex(m.isSelected ? 1000 : 0);
      });
      Object.keys(markerById).forEach(function (id) {
        if (!keep[id]) {
          markerById[id].setMap(null);
          delete markerById[id];
        }
      });
    };

    window.__gustraSetUser = function (coords) {
      if (!map) return;
      if (!coords) {
        if (userMarker) { userMarker.setMap(null); userMarker = null; }
        return;
      }
      var pos = { lat: coords.lat, lng: coords.lng };
      if (!userMarker) {
        userMarker = new google.maps.Marker({
          map: map,
          position: pos,
          zIndex: 2000,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          },
        });
      } else {
        userMarker.setPosition(pos);
      }
    };

    function initMap() {
      try {
        map = new google.maps.Map(document.getElementById('map'), {
          center: { lat: ${center.latitude}, lng: ${center.longitude} },
          zoom: ${zoom},
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
          padding: { top: 0, right: 0, bottom: MAP_PADDING_BOTTOM, left: 0 },
        });
        map.addListener('idle', function () {
          var c = map.getCenter();
          post({
            type: 'idle',
            lat: c.lat(),
            lng: c.lng(),
            zoom: map.getZoom(),
            radius: visibleRadiusMeters(),
          });
        });
        map.addListener('click', function () {
          post({ type: 'mapTap' });
        });
        post({ type: 'ready' });
      } catch (e) {
        post({ type: 'error', message: String(e && e.message ? e.message : e) });
      }
    }
  </script>
  <script async defer
    src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=initMap"
    onerror="window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'Failed to download Google Maps JavaScript API.'}))">
  </script>
</body>
</html>`;
}
