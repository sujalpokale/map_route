import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Platform,
} from 'react-native';
import { Plus, Minus, Layers, Crosshair, Compass } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { GeoPoint, CandidateRoute, StopItem } from '@/types';

// Safe conditional import for react-native-webview
let NativeWebView: any = null;
if (Platform.OS !== 'web') {
  try {
    NativeWebView = require('react-native-webview').WebView;
  } catch (e) {
    NativeWebView = null;
  }
}

export interface MapViewAbstractionProps {
  origin?: GeoPoint | null;
  destination?: GeoPoint | null;
  waypoints?: GeoPoint[];
  stops?: StopItem[];
  activeRoute?: CandidateRoute | null;
  activeProgressPct?: number;
  currentLocation?: { latitude: number; longitude: number; heading?: number } | null;
  onMapPress?: (coords: { latitude: number; longitude: number }) => void;
  onRecenter?: () => void;
  style?: ViewStyle;
  showControls?: boolean;
  interactive?: boolean;
  focusedLocation?: { latitude: number; longitude: number; zoom?: number } | null;
}

export const MapViewAbstraction: React.FC<MapViewAbstractionProps> = ({
  origin,
  destination,
  waypoints = [],
  stops = [],
  activeRoute,
  activeProgressPct = 0,
  currentLocation,
  onMapPress,
  onRecenter,
  style,
  showControls = true,
  interactive = true,
  focusedLocation,
}) => {
  const webViewRef = useRef<any>(null);
  const isMapReadyRef = useRef<boolean>(false);
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite' | 'dark'>('standard');

  const centerLat = currentLocation?.latitude ?? origin?.lat ?? destination?.lat ?? 20.5937;
  const centerLng = currentLocation?.longitude ?? origin?.lng ?? destination?.lng ?? 78.9629;
  const initialZoom = currentLocation || origin || destination ? 14 : 5;

  // Build the static HTML template ONCE to prevent webview reloads when props change
  const staticHtml = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body {
      width: 100%;
      height: 100%;
      background: #202124;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
    }
    #map {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      background: #202124;
      touch-action: none;
    }
    .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
    
    /* Authentic Google Maps Marker Pins */
    .custom-marker {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
    }
    .marker-pin {
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
      border: 2px solid #FFFFFF;
    }
    .marker-pin.origin {
      background: #34A853;
    }
    .marker-pin.destination {
      background: #EA4335;
    }
    .marker-pin.stop {
      background: #1A73E8;
    }
    .marker-text {
      transform: rotate(45deg);
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 800;
      text-align: center;
      line-height: 1;
    }
    .marker-label {
      background: #303134;
      color: #E8EAED;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.2);
      margin-top: 4px;
      white-space: nowrap;
      box-shadow: 0 3px 8px rgba(0,0,0,0.6);
    }

    /* Google Maps Live GPS Blue Puck */
    .gps-puck-wrap {
      position: relative;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .gps-radar-wave {
      position: absolute;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(26, 115, 232, 0.25);
      border: 1.5px solid #1A73E8;
      animation: radar-pulse 2s infinite ease-out;
    }
    .gps-puck-core {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #1A73E8;
      border: 3px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }
    @keyframes radar-pulse {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    body.theme-dark .leaflet-tile-pane {
      filter: invert(90%) hue-rotate(180deg) brightness(95%) contrast(88%);
    }
    body.theme-standard .leaflet-tile-pane,
    body.theme-satellite .leaflet-tile-pane {
      filter: none;
    }
  </style>
</head>
<body class="theme-standard">
  <div id="map"></div>
  <script>
    var map;
    var currentTileLayer;
    var routeLine;
    var routeGlowLine;
    var completedRouteLine;
    var activeProgressPct = 0;
    var markersGroup;
    var activeCoords = [];
    var originData = null;
    var destData = null;
    var stopsData = [];
    var currLocData = null;
    var currentTheme = 'standard';
    var gpsMarker = null;
    var userInteracted = false;
    var autoFollowGps = true;
    var lastFittedRouteKey = '';

    var tileUrls = {
      standard: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      satellite: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      dark: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
    };

    function postAppMessage(payload) {
      var str = typeof payload === 'string' ? payload : JSON.stringify(payload);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(str);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(str, '*');
      }
    }

    function initMap() {
      try {
        if (map) return;
        map = L.map('map', {
          center: [${centerLat}, ${centerLng}],
          zoom: ${initialZoom},
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true,
          tap: false,
          touchZoom: true,
          dragging: true
        });

        currentTileLayer = L.tileLayer(tileUrls[currentTheme] || tileUrls.standard, {
          maxZoom: 20,
          subdomains: ['0', '1', '2', '3']
        }).addTo(map);

        markersGroup = L.layerGroup().addTo(map);

        // Track when user manually interacts (pinch zoom, drag, pan)
        map.on('movestart dragstart zoomstart touchstart pointerdown', function(e) {
          userInteracted = true;
          autoFollowGps = false;
        });

        map.on('click', function(e) {
          postAppMessage({
            type: 'MAP_CLICK',
            latitude: e.latlng.lat,
            longitude: e.latlng.lng
          });
        });

        setTimeout(function() {
          if (map) map.invalidateSize();
          postAppMessage({ type: 'MAP_READY' });
        }, 100);
      } catch (err) {
        console.error('initMap error:', err);
      }
    }

    function renderScene(shouldFit) {
      if (!markersGroup || !map) return;
      markersGroup.clearLayers();

      var allPoints = [];

      // Route Polylines
      if (activeCoords && activeCoords.length > 1) {
        if (routeGlowLine) map.removeLayer(routeGlowLine);
        if (routeLine) map.removeLayer(routeLine);
        if (completedRouteLine) map.removeLayer(completedRouteLine);

        var totalLength = 0;
        var segmentLengths = [];
        for (var i = 1; i < activeCoords.length; i++) {
          var segmentLength = map.distance(activeCoords[i - 1], activeCoords[i]);
          segmentLengths.push(segmentLength);
          totalLength += segmentLength;
        }
        var targetLength = totalLength * Math.max(0, Math.min(100, activeProgressPct)) / 100;
        var completedCoords = [activeCoords[0]];
        var remainingCoords = [activeCoords[0]];
        var walkedLength = 0;
        var splitDone = targetLength <= 0;
        for (var j = 0; j < segmentLengths.length; j++) {
          var startPoint = activeCoords[j];
          var endPoint = activeCoords[j + 1];
          var length = segmentLengths[j];
          if (!splitDone && walkedLength + length >= targetLength) {
            var ratio = length ? (targetLength - walkedLength) / length : 0;
            var splitPoint = [
              startPoint[0] + (endPoint[0] - startPoint[0]) * ratio,
              startPoint[1] + (endPoint[1] - startPoint[1]) * ratio
            ];
            completedCoords.push(splitPoint);
            remainingCoords = [splitPoint, endPoint];
            splitDone = true;
          } else if (splitDone) {
            remainingCoords.push(endPoint);
          } else {
            completedCoords.push(endPoint);
          }
          walkedLength += length;
        }

        routeGlowLine = L.polyline(remainingCoords, {
          color: '#174EA6',
          weight: 8,
          opacity: 0.6,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        routeLine = L.polyline(remainingCoords, {
          color: '#1A73E8',
          weight: 5.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
        if (completedCoords.length > 1) {
          completedRouteLine = L.polyline(completedCoords, {
            color: '#9AA0A6', weight: 5, opacity: 0.8, lineCap: 'round', lineJoin: 'round'
          }).addTo(map);
        }

        // Fit bounds ONLY when route key changes AND user hasn't zoomed in manually, or if explicit shouldFit is true
        var currentRouteKey = activeCoords.length + '_' + activeCoords[0][0] + '_' + activeCoords[activeCoords.length - 1][0];
        if (shouldFit || (currentRouteKey !== lastFittedRouteKey && !userInteracted)) {
          lastFittedRouteKey = currentRouteKey;
          var bounds = L.latLngBounds(activeCoords);
          map.fitBounds(bounds, { padding: [50, 40], maxZoom: 16 });
        }
      } else {
        if (routeGlowLine) { map.removeLayer(routeGlowLine); routeGlowLine = null; }
        if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
        if (completedRouteLine) { map.removeLayer(completedRouteLine); completedRouteLine = null; }
      }

      // Origin Pin (Green 'A')
      if (originData && originData.lat) {
        allPoints.push([originData.lat, originData.lng]);
        var originIcon = L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="custom-marker"><div class="marker-pin origin"><div class="marker-text">A</div></div><div class="marker-label">' + (originData.name || 'Start Hub (A)') + '</div></div>',
          iconSize: [32, 54],
          iconAnchor: [16, 32]
        });
        var origMarker = L.marker([originData.lat, originData.lng], { icon: originIcon }).addTo(markersGroup);
        origMarker.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          postAppMessage({ type: 'MARKER_CLICK', target: 'origin', lat: originData.lat, lng: originData.lng });
        });
      }

      // Intermediate Multi-Stop Pins (Blue '1', '2', '3'...)
      if (stopsData && stopsData.length) {
        stopsData.forEach(function(s, idx) {
          if (!s.lat || !s.lng) return;
          allPoints.push([s.lat, s.lng]);
          var stopIcon = L.divIcon({
            className: 'custom-div-icon',
            html: '<div class="custom-marker"><div class="marker-pin stop"><div class="marker-text">' + (idx + 1) + '</div></div><div class="marker-label">' + (idx + 1) + '. ' + (s.name || ('Drop ' + (idx + 1))) + '</div></div>',
            iconSize: [32, 54],
            iconAnchor: [16, 32]
          });
          var stpMarker = L.marker([s.lat, s.lng], { icon: stopIcon }).addTo(markersGroup);
          stpMarker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            postAppMessage({ type: 'MARKER_CLICK', target: 'stop', index: idx, id: s.id, lat: s.lat, lng: s.lng });
          });
        });
      }

      // Destination Pin (Red 'B')
      if (destData && destData.lat) {
        allPoints.push([destData.lat, destData.lng]);
        var destIcon = L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="custom-marker"><div class="marker-pin destination"><div class="marker-text">B</div></div><div class="marker-label">' + (destData.name || 'End Point (B)') + '</div></div>',
          iconSize: [32, 54],
          iconAnchor: [16, 32]
        });
        var dstMarker = L.marker([destData.lat, destData.lng], { icon: destIcon }).addTo(markersGroup);
        dstMarker.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          postAppMessage({ type: 'MARKER_CLICK', target: 'destination', lat: destData.lat, lng: destData.lng });
        });
      }

      // Live GPS Driver Location Puck
      if (currLocData && currLocData.lat) {
        var puckIcon = L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="gps-puck-wrap"><div class="gps-radar-wave"></div><div class="gps-puck-core"></div></div>',
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        });
        gpsMarker = L.marker([currLocData.lat, currLocData.lng], { icon: puckIcon }).addTo(markersGroup);
      }

      // Auto-fit points only on initial load if no route and user hasn't zoomed
      if (shouldFit && allPoints.length > 0) {
        if (allPoints.length === 1) {
          map.setView(allPoints[0], 15);
        } else {
          var allBounds = L.latLngBounds(allPoints);
          map.fitBounds(allBounds, { padding: [50, 40], maxZoom: 16 });
        }
      }
    }

    window.setMapTheme = function(theme) {
      if (!map) return;
      if (currentTileLayer) map.removeLayer(currentTileLayer);
      currentTheme = theme;
      document.body.className = 'theme-' + theme;
      currentTileLayer = L.tileLayer(tileUrls[theme] || tileUrls.standard, {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3']
      }).addTo(map);
    };

    window.zoomIn = function() {
      userInteracted = true;
      autoFollowGps = false;
      if (map) map.zoomIn();
    };

    window.zoomOut = function() {
      userInteracted = true;
      autoFollowGps = false;
      if (map) map.zoomOut();
    };

    window.fitAllPoints = function() {
      userInteracted = false;
      autoFollowGps = false;
      if (!map) return;
      if (activeCoords && activeCoords.length > 1) {
        map.fitBounds(L.latLngBounds(activeCoords), { padding: [50, 40], maxZoom: 16 });
        return;
      }
      var pts = [];
      if (originData && originData.lat) pts.push([originData.lat, originData.lng]);
      if (stopsData && stopsData.length) {
        stopsData.forEach(function(s) { if (s.lat && s.lng) pts.push([s.lat, s.lng]); });
      }
      if (destData && destData.lat) pts.push([destData.lat, destData.lng]);

      if (pts.length > 1) {
        map.fitBounds(L.latLngBounds(pts), { padding: [50, 40], maxZoom: 16 });
      } else if (pts.length === 1) {
        map.setView(pts[0], 16);
      }
    };

    window.focusLocation = function(lat, lng, zoom) {
      userInteracted = true;
      autoFollowGps = false;
      if (map) {
        map.flyTo([lat, lng], zoom || 16, { animate: true, duration: 0.8 });
      }
    };

    window.recenter = function(lat, lng) {
      userInteracted = false;
      autoFollowGps = true;
      if (map) map.flyTo([lat, lng], 16, { animate: true, duration: 0.8 });
    };

    window.updateRouteData = function(data, forceFit) {
      if (!map || !data) return;
      activeCoords = data.coords || [];
      activeProgressPct = data.progressPct || 0;
      originData = data.origin;
      destData = data.dest;
      stopsData = data.stops || [];
      renderScene(forceFit === true);
    };

    window.updateUserLocation = function(lat, lng, heading) {
      currLocData = { lat: lat, lng: lng, heading: heading };
      if (gpsMarker) {
        gpsMarker.setLatLng([lat, lng]);
      } else if (markersGroup) {
        var puckIcon = L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="gps-puck-wrap"><div class="gps-radar-wave"></div><div class="gps-puck-core"></div></div>',
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        });
        gpsMarker = L.marker([lat, lng], { icon: puckIcon }).addTo(markersGroup);
      }

      // ONLY gently follow live GPS if the user is NOT actively zooming / panning elsewhere
      if (autoFollowGps && !userInteracted) {
        if (map) map.panTo([lat, lng], { animate: true });
      }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(initMap, 30);
    } else {
      document.addEventListener("DOMContentLoaded", initMap);
      window.onload = initMap;
    }
  </script>
</body>
</html>`;
  }, []);

  const webViewSource = useMemo(() => {
    return { html: staticHtml, baseUrl: 'https://localhost' };
  }, [staticHtml]);

  const pushRouteData = useCallback((forceFit?: boolean) => {
    const rawCoords = activeRoute?.coordinates || [];
    const payload = JSON.stringify({
      coords: rawCoords,
      origin: origin || null,
      dest: destination || null,
      stops: stops || [],
      progressPct: activeProgressPct,
    });
    webViewRef.current?.injectJavaScript?.(
      `window.updateRouteData && window.updateRouteData(${payload}, ${forceFit ? 'true' : 'false'}); true;`
    );
  }, [activeRoute?.coordinates, origin, destination, stops, activeProgressPct]);

  const pushUserLocation = useCallback(() => {
    if (currentLocation?.latitude && currentLocation?.longitude) {
      webViewRef.current?.injectJavaScript?.(
        `window.updateUserLocation && window.updateUserLocation(${currentLocation.latitude}, ${currentLocation.longitude}, ${currentLocation.heading || 0}); true;`
      );
    }
  }, [currentLocation?.latitude, currentLocation?.longitude, currentLocation?.heading]);

  // Sync focusedLocation
  useEffect(() => {
    if (focusedLocation?.latitude && focusedLocation?.longitude) {
      webViewRef.current?.injectJavaScript?.(
        `window.focusLocation && window.focusLocation(${focusedLocation.latitude}, ${focusedLocation.longitude}, ${focusedLocation.zoom || 16}); true;`
      );
    }
  }, [focusedLocation?.latitude, focusedLocation?.longitude, focusedLocation?.zoom]);

  // Sync user location via JS injection without reloading the map
  useEffect(() => {
    if (isMapReadyRef.current) {
      pushUserLocation();
    }
  }, [pushUserLocation]);

  // Sync route & stops data via JS injection without reloading the map
  useEffect(() => {
    if (isMapReadyRef.current) {
      pushRouteData();
    }
  }, [pushRouteData]);

  const handleZoomIn = () => {
    webViewRef.current?.injectJavaScript?.('window.zoomIn && window.zoomIn(); true;');
  };

  const handleZoomOut = () => {
    webViewRef.current?.injectJavaScript?.('window.zoomOut && window.zoomOut(); true;');
  };

  const handleFitAll = () => {
    webViewRef.current?.injectJavaScript?.('window.fitAllPoints && window.fitAllPoints(); true;');
  };

  const handleToggleLayer = () => {
    const nextLayer = mapLayer === 'dark' ? 'standard' : mapLayer === 'standard' ? 'satellite' : 'dark';
    setMapLayer(nextLayer);
    webViewRef.current?.injectJavaScript?.(`window.setMapTheme && window.setMapTheme('${nextLayer}'); true;`);
  };

  const handleRecenterMap = () => {
    if (onRecenter) onRecenter();
    webViewRef.current?.injectJavaScript?.(
      `window.recenter && window.recenter(${centerLat}, ${centerLng}); true;`
    );
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = typeof event.nativeEvent.data === 'string'
        ? JSON.parse(event.nativeEvent.data)
        : event.nativeEvent.data;

      if (data?.type === 'MAP_READY') {
        isMapReadyRef.current = true;
        pushRouteData(true);
        pushUserLocation();
      } else if (data?.type === 'MAP_CLICK' && onMapPress) {
        onMapPress({ latitude: data.latitude, longitude: data.longitude });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleWebMsg = (e: MessageEvent) => {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (data?.type === 'MAP_READY') {
            isMapReadyRef.current = true;
            pushRouteData(true);
            pushUserLocation();
          } else if (data?.type === 'MAP_CLICK' && onMapPress) {
            onMapPress({ latitude: data.latitude, longitude: data.longitude });
          }
        } catch {
          // ignore
        }
      };
      window.addEventListener('message', handleWebMsg);
      return () => window.removeEventListener('message', handleWebMsg);
    }
  }, [onMapPress, pushRouteData, pushUserLocation]);

  return (
    <View style={[styles.container, style]}>
      {/* Real Geographic Leaflet / Google Maps Tile Canvas */}
      {Platform.OS === 'web' ? (
        <iframe
          srcDoc={staticHtml}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Google Map Canvas"
        />
      ) : NativeWebView ? (
        <NativeWebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={webViewSource}
          style={styles.webView}
          scrollEnabled={interactive}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          allowsInlineMediaPlayback={true}
          androidLayerType="hardware"
          scalesPageToFit={false}
          onMessage={handleWebViewMessage}
        />
      ) : (
        <View style={styles.fallbackMap} />
      )}

      {/* Floating Action Controls Stack (Right-side Google Maps Controls) */}
      {showControls && (
        <View style={styles.controlsColumn}>
          <TouchableOpacity style={styles.controlBtn} onPress={handleZoomIn}>
            <Plus size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={handleZoomOut}>
            <Minus size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={handleFitAll}>
            <Crosshair size={18} color="#8AB4F8" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlBtn, mapLayer !== 'dark' && styles.controlBtnActive]}
            onPress={handleToggleLayer}
          >
            <Layers size={18} color={mapLayer !== 'dark' ? THEME.colors.primaryLight : '#FFFFFF'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlBtn, styles.recenterBtn]}
            onPress={handleRecenterMap}
          >
            <Compass size={18} color={THEME.colors.primaryLight} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#202124',
    position: 'relative',
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: '#202124',
  },
  fallbackMap: {
    flex: 1,
    backgroundColor: '#202124',
  },
  controlsColumn: {
    position: 'absolute',
    right: 14,
    top: '36%',
    gap: 10,
    zIndex: 25,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#303134',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  controlBtnActive: {
    backgroundColor: 'rgba(26, 115, 232, 0.25)',
    borderColor: THEME.colors.primary,
  },
  recenterBtn: {
    backgroundColor: '#303134',
    borderColor: THEME.colors.primary,
  },
});
