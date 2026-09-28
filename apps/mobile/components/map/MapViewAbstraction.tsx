import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Platform,
} from 'react-native';
import { Plus, Minus, Layers, Crosshair } from 'lucide-react-native';
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
  currentLocation?: { latitude: number; longitude: number; heading?: number } | null;
  onMapPress?: (coords: { latitude: number; longitude: number }) => void;
  onRecenter?: () => void;
  style?: ViewStyle;
  showControls?: boolean;
  interactive?: boolean;
}

export const MapViewAbstraction: React.FC<MapViewAbstractionProps> = ({
  origin,
  destination,
  waypoints = [],
  stops = [],
  activeRoute,
  currentLocation,
  onMapPress,
  onRecenter,
  style,
  showControls = true,
  interactive = true,
}) => {
  const webViewRef = useRef<any>(null);
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite' | 'dark'>('standard');

  const centerLat = currentLocation?.latitude || origin?.lat || 18.5204;
  const centerLng = currentLocation?.longitude || origin?.lng || 73.8567;

  useEffect(() => {
    if (currentLocation?.latitude && currentLocation?.longitude) {
      webViewRef.current?.injectJavaScript?.(
        `window.updateUserLocation && window.updateUserLocation(${currentLocation.latitude}, ${currentLocation.longitude}, ${currentLocation.heading || 0}); true;`
      );
    }
  }, [currentLocation?.latitude, currentLocation?.longitude, currentLocation?.heading]);

  // Build the complete Leaflet HTML template with Real Google-style / CartoDB / Satellite tiles
  const generateMapHtml = () => {
    const rawCoords = activeRoute?.coordinates || [];

    const polylineJson = JSON.stringify(rawCoords);
    const originJson = JSON.stringify(origin || null);
    const destJson = JSON.stringify(destination || null);
    const stopsJson = JSON.stringify(stops || []);
    const currLocJson = JSON.stringify(
      currentLocation
        ? { lat: currentLocation.latitude, lng: currentLocation.longitude, heading: currentLocation.heading || 0 }
        : null
    );

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #202124; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    #map { position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; background: #202124; }
    .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
    
    /* Authentic Google Maps Marker Pins */
    .custom-marker {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .marker-pin {
      width: 28px;
      height: 28px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.45);
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
      width: 22px;
      height: 22px;
    }
    .marker-inner-dot {
      width: 7px;
      height: 7px;
      background: #FFFFFF;
      border-radius: 50%;
      transform: rotate(45deg);
    }
    .marker-label {
      background: #303134;
      color: #E8EAED;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.15);
      margin-top: 4px;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
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
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var currentTileLayer;
    var routeLine;
    var routeGlowLine;
    var markersGroup;

    var tileUrls = {
      standard: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      satellite: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    };

    var activeCoords = ${polylineJson};
    var originData = ${originJson};
    var destData = ${destJson};
    var stopsData = ${stopsJson};
    var currLocData = ${currLocJson};
    var currentTheme = '${mapLayer}';
    var gpsMarker = null;

    function initMap() {
      try {
        if (map) return;
        map = L.map('map', {
          center: [${centerLat}, ${centerLng}],
          zoom: ${(activeRoute?.coordinates && activeRoute.coordinates.length > 1) ? 13 : 15},
          zoomControl: false,
          attributionControl: false
        });

        var subdoms = (currentTheme === 'dark') ? 'abcd' : ['0', '1', '2', '3'];
        currentTileLayer = L.tileLayer(tileUrls[currentTheme] || tileUrls.standard, {
          maxZoom: 20,
          subdomains: subdoms
        }).addTo(map);

        markersGroup = L.layerGroup().addTo(map);

        map.on('click', function(e) {
          var payload = JSON.stringify({
            type: 'MAP_CLICK',
            latitude: e.latlng.lat,
            longitude: e.latlng.lng
          });
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(payload);
          } else if (window.parent) {
            window.parent.postMessage(payload, '*');
          }
        });

        renderScene();
        setTimeout(function() { if (map) map.invalidateSize(); }, 200);
      } catch (err) {
        console.error('initMap error:', err);
      }
    }

    function renderScene() {
      if (!markersGroup || !map) return;
      markersGroup.clearLayers();

      // Render Google Maps Style Route Lines
      if (activeCoords && activeCoords.length > 1) {
        if (routeGlowLine) map.removeLayer(routeGlowLine);
        if (routeLine) map.removeLayer(routeLine);

        // Google Blue Soft Casing
        routeGlowLine = L.polyline(activeCoords, {
          color: '#174EA6',
          weight: 8,
          opacity: 0.6,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Google Navigation Primary Blue Corridor
        routeLine = L.polyline(activeCoords, {
          color: '#1A73E8',
          weight: 5.5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        var bounds = L.latLngBounds(activeCoords);
        map.fitBounds(bounds, { padding: [60, 40], maxZoom: 16 });
      }

      // Origin Pin
      if (originData && originData.lat) {
        var originIcon = L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="custom-marker"><div class="marker-pin origin"><div class="marker-inner-dot"></div></div><div class="marker-label">' + (originData.name || 'Start') + '</div></div>',
          iconSize: [30, 52],
          iconAnchor: [15, 30]
        });
        L.marker([originData.lat, originData.lng], { icon: originIcon }).addTo(markersGroup);
      }

      // Destination Pin
      if (destData && destData.lat) {
        var destIcon = L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="custom-marker"><div class="marker-pin destination"><div class="marker-inner-dot"></div></div><div class="marker-label">' + (destData.name || 'Destination') + '</div></div>',
          iconSize: [30, 52],
          iconAnchor: [15, 30]
        });
        L.marker([destData.lat, destData.lng], { icon: destIcon }).addTo(markersGroup);
      }

      // Intermediate Multi-Stop Pins
      if (stopsData && stopsData.length) {
        stopsData.forEach(function(s, idx) {
          var stopIcon = L.divIcon({
            className: 'custom-div-icon',
            html: '<div class="custom-marker"><div class="marker-pin stop"><div class="marker-inner-dot"></div></div><div class="marker-label">Stop ' + (idx + 1) + '</div></div>',
            iconSize: [24, 42],
            iconAnchor: [12, 24]
          });
          L.marker([s.lat, s.lng], { icon: stopIcon }).addTo(markersGroup);
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
    }

    window.setMapTheme = function(theme) {
      if (!map) return;
      if (currentTileLayer) map.removeLayer(currentTileLayer);
      currentTheme = theme;
      var subdoms = (theme === 'dark') ? 'abcd' : ['0', '1', '2', '3'];
      currentTileLayer = L.tileLayer(tileUrls[theme] || tileUrls.standard, { maxZoom: 20, subdomains: subdoms }).addTo(map);
    };

    window.zoomIn = function() { if (map) map.zoomIn(); };
    window.zoomOut = function() { if (map) map.zoomOut(); };
    window.recenter = function(lat, lng) {
      if (map) map.flyTo([lat, lng], 15, { animate: true, duration: 1 });
    };

    window.updateUserLocation = function(lat, lng, heading) {
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
      if (!activeCoords || activeCoords.length <= 1) {
        if (map) map.setView([lat, lng], 15, { animate: true });
      }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(initMap, 50);
    } else {
      document.addEventListener("DOMContentLoaded", initMap);
      window.onload = initMap;
    }
  </script>
</body>
</html>`;
  };

  const handleZoomIn = () => {
    webViewRef.current?.injectJavaScript?.('window.zoomIn && window.zoomIn(); true;');
  };

  const handleZoomOut = () => {
    webViewRef.current?.injectJavaScript?.('window.zoomOut && window.zoomOut(); true;');
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
      if (data?.type === 'MAP_CLICK' && onMapPress) {
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
          if (data?.type === 'MAP_CLICK' && onMapPress) {
            onMapPress({ latitude: data.latitude, longitude: data.longitude });
          }
        } catch {
          // ignore
        }
      };
      window.addEventListener('message', handleWebMsg);
      return () => window.removeEventListener('message', handleWebMsg);
    }
  }, [onMapPress]);

  const htmlContent = generateMapHtml();

  return (
    <View style={[styles.container, style]}>
      {/* Real Geographic Leaflet / Google Maps Tile Canvas */}
      {Platform.OS === 'web' ? (
        <iframe
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Google Map Canvas"
        />
      ) : NativeWebView ? (
        <NativeWebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent, baseUrl: 'https://localhost' }}
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
            <Crosshair size={18} color={THEME.colors.primaryLight} />
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
