import { buildMapHtml } from '@/services/map/mapHtml';

describe('buildMapHtml', () => {
  const base = {
    apiKey: 'test-key',
    center: { latitude: 51.2194, longitude: 4.4025 },
    zoom: 14,
    forestGreen: '#388C57',
    mapPaddingBottom: 0,
  };

  it('embeds the API key and init callback', () => {
    const html = buildMapHtml(base);
    expect(html).toContain('maps.googleapis.com/maps/api/js?key=test-key');
    expect(html).toContain('callback=initMap');
  });

  it('posts a ready message after the map is created', () => {
    const html = buildMapHtml(base);
    expect(html).toContain("post({ type: 'ready' })");
  });

  it('posts an error message when initMap throws', () => {
    const html = buildMapHtml(base);
    expect(html).toContain("post({ type: 'error', message:");
  });

  it('exposes the marker and fit-bounds bridges used to re-apply pins', () => {
    const html = buildMapHtml(base);
    expect(html).toContain('window.__gustraSetMarkers');
    expect(html).toContain('window.__gustraFitBounds');
    expect(html).toContain('window.__gustraSetUser');
  });

  it('posts an auth-failure error on gm_authFailure (white-map path)', () => {
    const html = buildMapHtml(base);
    expect(html).toContain('window.gm_authFailure = function ()');
    expect(html).toContain("type: 'error'");
  });

  it('exposes the ping/pong heartbeat used to detect a stale white map', () => {
    const html = buildMapHtml(base);
    expect(html).toContain('window.__gustraPing = function ()');
    expect(html).toContain("post({ type: 'pong' })");
  });
});
