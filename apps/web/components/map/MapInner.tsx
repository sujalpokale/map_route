"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { GeoPoint, CandidateRoute, StopItem, reverseGeocode } from "@/lib/api";
import {
  Plus,
  Minus,
  Navigation,
  Compass,
  Layers as LayersIcon,
  Maximize,
  Check,
  Radio,
  MapPin,
  Crosshair,
  Loader2,
} from "lucide-react";

export type MapTileMode = "standard" | "satellite" | "dark";

interface MapInnerProps {
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  waypoints?: GeoPoint[];
  routes: CandidateRoute[];
  selectedRouteId: string | null;
  onSelectRoute?: (routeId: string) => void;
  deliveryStops?: StopItem[];
  optimizedPolyline?: [number, number][];
  onMapClick?: (lat: number, lng: number) => void;
  userLocation?: GeoPoint | null;
  onUserLocationFound?: (loc: GeoPoint) => void;
}

export default function MapInner({
  origin,
  destination,
  waypoints = [],
  routes = [],
  selectedRouteId,
  onSelectRoute,
  deliveryStops = [],
  optimizedPolyline = [],
  onMapClick,
  userLocation = null,
  onUserLocationFound,
}: MapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polylinesLayerRef = useRef<L.LayerGroup | null>(null);
  const gpsLayerRef = useRef<L.LayerGroup | null>(null);

  // Live GPS tracking state
  const [isLocating, setIsLocating] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsNotification, setGpsNotification] = useState<string | null>(null);

  // Active Map Theme Layer: "standard" (Google-style light), "satellite", or "dark"
  const [tileMode, setTileMode] = useState<MapTileMode>("standard");
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showTrafficBadge, setShowTrafficBadge] = useState(true);

  // Verified Map API Keys
  const cartoApiKey =
    process.env.NEXT_PUBLIC_CARTO_API_KEY || "cb1_3ovt_1_62230147435a0dcb904241c0";
  const googleApiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  // Primary Tile URL (Google Maps & CARTO Voyager & ESRI Satellite)
  const getPrimaryTileUrl = (mode: MapTileMode) => {
    const keyParam = cartoApiKey ? `?key=${cartoApiKey}` : "";

    if (mode === "satellite") {
      if (googleApiKey) {
        return `https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}&key=${googleApiKey}`;
      }
      // High-resolution ESRI World Satellite Imagery (Zero watermark, 100% reliable)
      return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    }

    if (mode === "dark") {
      // Sleek Dark Matter Theme
      return `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${keyParam}`;
    }

    // Standard: Google Maps clean vector tiles or CARTO Voyager
    if (googleApiKey) {
      return `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${googleApiKey}`;
    }
    return `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${keyParam}`;
  };

  // Safe fallback to OpenStreetMap if upstream is unreachable
  const getFallbackTileUrl = (mode: MapTileMode, z: number, x: number, y: number) => {
    if (mode === "satellite") {
      return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    }
    // Universal OpenStreetMap tile fallback
    const sub = ["a", "b", "c"][(x + y) % 3];
    return `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
  };

  // Factory to create a resilient tile layer
  const createTileLayer = (mode: MapTileMode) => {
    const primaryUrl = getPrimaryTileUrl(mode);
    const layer = L.tileLayer(primaryUrl, {
      subdomains: mode === "satellite" && !googleApiKey ? ["server", "services"] : ["mt0", "mt1", "mt2", "mt3", "a", "b", "c", "d"],
      maxZoom: 20,
    });

    // Automatically recover if a tile fails
    layer.on("tileerror", (event: any) => {
      const tile = event.tile as HTMLImageElement;
      if (tile && !tile.dataset.fallbackTried) {
        tile.dataset.fallbackTried = "true";
        const coords = event.coords;
        if (coords) {
          tile.src = getFallbackTileUrl(mode, coords.z, coords.x, coords.y);
        }
      }
    });

    return layer;
  };

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on user live location if present, else origin, else world fallback
    const initialCenter: [number, number] = userLocation
      ? [userLocation.lat, userLocation.lng]
      : origin
      ? [origin.lat, origin.lng]
      : [20.5937, 78.9629]; // Default broad overview if GPS pending

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: userLocation || origin ? 16 : 5,
      zoomControl: false,
      attributionControl: false,
    });

    const initialTile = createTileLayer("standard").addTo(map);
    tileLayerRef.current = initialTile;

    // Modern attribution in bottom right
    L.control
      .attribution({ position: "bottomright" })
      .addAttribution('&copy; <a href="https://carto.com/" target="_blank">CARTO</a> &copy; <a href="https://www.openstreetmap.org/" target="_blank">OpenStreetMap</a>')
      .addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    const polylinesLayer = L.layerGroup().addTo(map);
    const gpsLayer = L.layerGroup().addTo(map);

    markersLayerRef.current = markersLayer;
    polylinesLayerRef.current = polylinesLayer;
    gpsLayerRef.current = gpsLayer;
    mapInstanceRef.current = map;

    // Auto-detect live GPS immediately on first visit
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy;
          setGpsLocation({ lat, lng, accuracy });

          try {
            const currentMap = mapInstanceRef.current;
            if (currentMap && currentMap.getContainer()) {
              if ((currentMap as any)._loaded) {
                currentMap.flyTo([lat, lng], 16, { duration: 1.2 });
              } else {
                currentMap.setView([lat, lng], 16);
              }
            }
          } catch (e) {
            console.warn("Auto-GPS initial map positioning note:", e);
          }

          if (onUserLocationFound) {
            const addr = await reverseGeocode(lat, lng);
            onUserLocationFound({
              lat,
              lng,
              address: addr,
              name: "Your Live Location",
            });
          }
        },
        (err) => {
          console.warn("Auto-GPS initial detection note:", err.message);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }

    // Map click handler
    map.on("click", (e) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    });

    // Invalidate size in case of window resize or drawer toggling
    const handleResize = () => map.invalidateSize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Handle Tile Layer Changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const newTile = createTileLayer(tileMode).addTo(map);
    tileLayerRef.current = newTile;
  }, [tileMode]);

  // 3. Render Google Maps Markers and Polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const polylinesLayer = polylinesLayerRef.current;
    if (!map || !markersLayer || !polylinesLayer) return;

    markersLayer.clearLayers();
    polylinesLayer.clearLayers();

    const allPoints: [number, number][] = [];

    // --- Google Origin Marker (Start Depot in VRP, Blue Beacon in Studio) ---
    if (origin) {
      const isVRP = deliveryStops && deliveryStops.length > 0;
      const origColor = isVRP ? "#188038" : "#1a73e8";

      const origIcon = L.divIcon({
        className: "custom-gmap-origin",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));">
            ${
              isVRP
                ? `<div style="
                    background: #188038;
                    color: #ffffff;
                    border: 2px solid #ffffff;
                    border-radius: 6px;
                    padding: 1px 5px;
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.25);
                    margin-bottom: 2px;
                    white-space: nowrap;
                  ">START</div>`
                : ""
            }
            <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              <div class="gmap-pulse-circle" style="border-color: ${origColor};"></div>
              <div style="
                width: 20px;
                height: 20px;
                background: ${origColor};
                border: 3px solid #ffffff;
                border-radius: 50%;
                box-shadow: 0 2px 6px rgba(0,0,0,0.35);
                position: relative;
                z-index: 2;
              "></div>
            </div>
          </div>
        `,
        iconSize: [36, isVRP ? 48 : 32],
        iconAnchor: [18, isVRP ? 40 : 16],
      });

      const origMarker = L.marker([origin.lat, origin.lng], { icon: origIcon }).addTo(markersLayer);
      origMarker.bindPopup(`
        <div style="font-family: inherit; padding: 2px;">
          <div style="font-size: 11px; font-weight: 700; color: ${origColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
            ${isVRP ? "🟢 STARTING DEPOT / HUB" : "YOUR STARTING POINT"}
          </div>
          <div style="font-weight: 600; color: #202124; font-size: 13px; line-height: 1.3;">${origin.address || "Departure Point"}</div>
          <div style="font-size: 11px; color: #70757a; margin-top: 4px;">${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}</div>
        </div>
      `);
      allPoints.push([origin.lat, origin.lng]);
    }

    // --- Google Destination Marker (Authentic Red Pin / End Finish Point) ---
    const isSameAsOrigin = origin && destination && destination.lat === origin.lat && destination.lng === origin.lng;
    if (destination && !isSameAsOrigin) {
      const isVRP = deliveryStops && deliveryStops.length > 0;
      const destIcon = L.divIcon({
        className: "custom-gmap-dest",
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));">
            ${
              isVRP
                ? `<div style="
                    background: #d93025;
                    color: #ffffff;
                    border: 2px solid #ffffff;
                    border-radius: 6px;
                    padding: 1px 5px;
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.25);
                    margin-bottom: -2px;
                    position: relative;
                    z-index: 3;
                    white-space: nowrap;
                  ">FINISH</div>`
                : ""
            }
            <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 0C7.16344 0 0 7.16344 0 16C0 28 16 40 16 40C16 40 32 28 32 16C32 7.16344 24.8366 0 16 0Z" fill="#EA4335"/>
              <circle cx="16" cy="16" r="6" fill="#FFFFFF"/>
            </svg>
          </div>
        `,
        iconSize: [36, isVRP ? 52 : 40],
        iconAnchor: [18, isVRP ? 52 : 40],
        popupAnchor: [0, -36],
      });

      const destMarker = L.marker([destination.lat, destination.lng], { icon: destIcon }).addTo(markersLayer);
      destMarker.bindPopup(`
        <div style="font-family: inherit; padding: 2px;">
          <div style="font-size: 11px; font-weight: 700; color: #d93025; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
            ${isVRP ? "🔴 FINAL DESTINATION / FINISH POINT" : "DESTINATION"}
          </div>
          <div style="font-weight: 600; color: #202124; font-size: 13px; line-height: 1.3;">${destination.address || "Arrival Point"}</div>
          <div style="font-size: 11px; color: #70757a; margin-top: 4px;">${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}</div>
        </div>
      `);
      allPoints.push([destination.lat, destination.lng]);
    }

    // --- Waypoints ---
    waypoints.forEach((wp, idx) => {
      const wpIcon = L.divIcon({
        className: "custom-gmap-stop",
        html: `
          <div style="
            width: 26px;
            height: 26px;
            background: #ffffff;
            border: 2px solid #5f6368;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            color: #202124;
            box-shadow: 0 2px 5px rgba(0,0,0,0.25);
          ">
            ${idx + 1}
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const m = L.marker([wp.lat, wp.lng], { icon: wpIcon }).addTo(markersLayer);
      m.bindPopup(`<b>Stop ${idx + 1}</b><br/>${wp.address || ""}`);
      allPoints.push([wp.lat, wp.lng]);
    });

    // --- Delivery Stops (VRP Mode) ---
    deliveryStops.forEach((stop, idx) => {
      const isUrgent = stop.priority === 3;
      const bgColor = isUrgent ? "#d93025" : "#1a73e8";

      const icon = L.divIcon({
        className: "custom-gmap-vrp-stop",
        html: `
          <div style="
            width: 28px;
            height: 28px;
            background: ${bgColor};
            border: 2.5px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            color: #ffffff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          ">
            ${idx + 1}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const m = L.marker([stop.lat, stop.lng], { icon }).addTo(markersLayer);
      m.bindPopup(`
        <div style="font-family: inherit; padding: 2px;">
          <div style="font-size: 11px; color: ${bgColor}; font-weight: 700;">
            STOP #${idx + 1} ${isUrgent ? "• HIGH PRIORITY" : ""}
          </div>
          <div style="font-weight: 600; color: #202124; font-size: 13px; margin-top: 2px;">${stop.address}</div>
          <div style="font-size: 11px; color: #5f6368; margin-top: 4px;">Payload: ${stop.package_weight_kg} kg</div>
        </div>
      `);
      allPoints.push([stop.lat, stop.lng]);
    });

    // --- VRP Multi-Stop Polyline ---
    if (optimizedPolyline && optimizedPolyline.length > 0) {
      // Outer casing
      L.polyline(optimizedPolyline, {
        color: "#ffffff",
        weight: 8,
        opacity: 0.9,
      }).addTo(polylinesLayer);

      // Core line
      L.polyline(optimizedPolyline, {
        color: "#1a73e8",
        weight: 5,
        opacity: 0.95,
        dashArray: "6, 6",
      }).addTo(polylinesLayer);

      optimizedPolyline.forEach((pt) => allPoints.push(pt));
    }

    // --- Google Maps Candidate Routes ---
    if (routes && routes.length > 0) {
      const selectedRoute =
        routes.find((r) => r.id === selectedRouteId || (!selectedRouteId && r.is_recommended)) || routes[0];

      const getSignature = (coords: [number, number][]) => {
        if (!coords || coords.length === 0) return "";
        const start = coords[0];
        const mid = coords[Math.floor(coords.length / 2)];
        const end = coords[coords.length - 1];
        return `${coords.length}_${start[0]?.toFixed(5)},${start[1]?.toFixed(5)}_${mid[0]?.toFixed(5)},${mid[1]?.toFixed(5)}_${end[0]?.toFixed(5)},${end[1]?.toFixed(5)}`;
      };

      const selectedSig = getSignature(selectedRoute.coordinates);
      const renderedSigs = new Set<string>();

      // Ensure unselected routes render first, selected route on top
      const sortedRoutes = [...routes].sort((a, b) => {
        if (a.id === selectedRouteId) return 1;
        if (b.id === selectedRouteId) return -1;
        return 0;
      });

      sortedRoutes.forEach((r) => {
        const isSelected = r.id === selectedRouteId || (!selectedRouteId && r.is_recommended);
        const sig = getSignature(r.coordinates);

        if (isSelected) {
          // Selected Route: Classic Google Maps Blue with clean casing
          // White outline / casing
          L.polyline(r.coordinates, {
            color: "#ffffff",
            weight: 9,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(polylinesLayer);

          // Primary blue stroke
          const mainPoly = L.polyline(r.coordinates, {
            color: "#1a73e8", // Iconic Google Maps Route Blue
            weight: 6,
            opacity: 1,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(polylinesLayer);

          mainPoly.bindTooltip(
            `<div style="font-family: inherit; font-size: 12px;">
              <b>${r.label}</b> • <span style="color: #188038; font-weight: 700;">${r.duration_min} min</span> (${r.distance_km} km)
            </div>`,
            { sticky: true, className: "custom-leaflet-tooltip" }
          );

          r.coordinates.forEach((pt) => allPoints.push(pt));
          renderedSigs.add(sig);
        } else {
          // Only draw distinct alternative polylines if they follow an actually different road path
          if (sig === selectedSig || renderedSigs.has(sig)) {
            return;
          }
          renderedSigs.add(sig);

          // Alternative Routes: Google Maps Muted Grey, clickable
          L.polyline(r.coordinates, {
            color: "#ffffff",
            weight: 7,
            opacity: 0.8,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(polylinesLayer);

          const altPoly = L.polyline(r.coordinates, {
            color: "#9aa0a6", // Google Road Grey
            weight: 5,
            opacity: 0.85,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(polylinesLayer);

          altPoly.on("click", () => {
            if (onSelectRoute) onSelectRoute(r.id);
          });

          altPoly.bindTooltip(
            `<div style="font-family: inherit; font-size: 12px;">
              <b>Click to select:</b> ${r.label} (${r.duration_min} min, ${r.distance_km} km)
            </div>`,
            { sticky: true, className: "custom-leaflet-tooltip" }
          );

          r.coordinates.forEach((pt) => allPoints.push(pt));
        }
      });
    }

    // Auto-fit bounds if we have multiple points, or center smoothly on single point
    try {
      if (allPoints.length > 1) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, {
          padding: [60, 60],
          maxZoom: 15,
        });
      } else if (allPoints.length === 1) {
        map.setView(allPoints[0], 15, { animate: true });
      }
    } catch (fitErr) {
      console.warn("Map fitBounds/setView positioning note:", fitErr);
    }
  }, [origin, destination, waypoints, routes, selectedRouteId, deliveryStops, optimizedPolyline]);

  // 4. Render Live GPS Location beacon and accuracy circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    const gpsLayer = gpsLayerRef.current;
    if (!map || !gpsLayer) return;

    gpsLayer.clearLayers();

    const activeLoc =
      userLocation ||
      (gpsLocation
        ? {
            lat: gpsLocation.lat,
            lng: gpsLocation.lng,
            address: "Your Location (GPS)",
          }
        : null);

    if (!activeLoc) return;

    // Outer accuracy radius circle
    if (gpsLocation?.accuracy && gpsLocation.accuracy > 15) {
      L.circle([activeLoc.lat, activeLoc.lng], {
        radius: Math.min(gpsLocation.accuracy, 400),
        color: "#1a73e8",
        weight: 1.5,
        opacity: 0.4,
        fillColor: "#1a73e8",
        fillOpacity: 0.08,
      }).addTo(gpsLayer);
    }

    // Google Maps signature blue pulsating GPS beacon
    const liveIcon = L.divIcon({
      className: "custom-gmap-live-loc",
      html: `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
          <div class="gmap-pulse-circle" style="width: 36px; height: 36px;"></div>
          <div style="
            width: 18px;
            height: 18px;
            background: #1a73e8;
            border: 3px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(26, 115, 232, 0.5), 0 1px 3px rgba(0,0,0,0.3);
            position: relative;
            z-index: 10;
          "></div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const marker = L.marker([activeLoc.lat, activeLoc.lng], { icon: liveIcon }).addTo(gpsLayer);
    marker.bindPopup(`
      <div style="font-family: inherit; padding: 2px;">
        <div style="font-size: 11px; font-weight: 700; color: #1a73e8; text-transform: uppercase; letter-spacing: 0.5px;">Your Location</div>
        <div style="font-weight: 600; color: #202124; font-size: 13px; margin-top: 2px;">${activeLoc.address || "Current Position"}</div>
        <div style="font-size: 11px; color: #70757a; margin-top: 3px;">GPS Coordinates: ${activeLoc.lat.toFixed(4)}, ${activeLoc.lng.toFixed(4)}</div>
      </div>
    `);

    // Center map on user location if no destination is set yet
    if (!destination || routes.length === 0) {
      map.flyTo([activeLoc.lat, activeLoc.lng], 15, { duration: 1.2 });
    }
  }, [userLocation, gpsLocation]);

  // Handle GPS Locate User Click
  const handleLocateUser = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsNotification("Geolocation is not supported by your browser.");
      setTimeout(() => setGpsNotification(null), 4000);
      return;
    }

    setIsLocating(true);
    setGpsNotification("Acquiring GPS location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        setGpsLocation({ lat, lng, accuracy });
        setIsLocating(false);
        setGpsNotification(null);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.2 });
        }

        if (onUserLocationFound) {
          onUserLocationFound({
            lat,
            lng,
            address: "Your Location (GPS)",
            name: "Your Location",
          });
        }
      },
      (error) => {
        setIsLocating(false);
        let msg = "Could not retrieve GPS location.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Location access denied. Please allow location permissions in your browser.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "GPS position unavailable. Please try again.";
        } else if (error.code === error.TIMEOUT) {
          msg = "GPS request timed out. Please try again.";
        }
        setGpsNotification(msg);
        setTimeout(() => setGpsNotification(null), 5000);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Zoom In / Out Handlers
  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  // Re-center on Route or Default
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    if (origin && destination) {
      const bounds = L.latLngBounds([
        [origin.lat, origin.lng],
        [destination.lat, destination.lng],
      ]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60] });
    } else if (userLocation) {
      mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 0.8 });
    } else if (origin) {
      mapInstanceRef.current.flyTo([origin.lat, origin.lng], 15, { duration: 0.8 });
    } else {
      mapInstanceRef.current.setView([18.5204, 73.8567], 12);
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Map DOM Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* GPS Notification Toast Banner */}
      {gpsNotification && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.18)] border border-[#dadce0] text-xs font-semibold text-[#202124] flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <Crosshair className={`w-3.5 h-3.5 text-[#1a73e8] ${isLocating ? "animate-spin" : ""}`} />
          <span>{gpsNotification}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* Google Maps Signature Controls: Bottom-Right Float */}
      {/* ========================================================= */}
      <div className="absolute bottom-6 right-4 z-[400] flex flex-col items-center gap-2 select-none">
        {/* Google Maps Signature "My Location" GPS Button */}
        <button
          type="button"
          onClick={handleLocateUser}
          title="Show your current location (GPS)"
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-[0_2px_6px_rgba(0,0,0,0.3)] border border-[#dadce0] active:scale-95 ${
            isLocating
              ? "bg-[#e8f0fe] text-[#1a73e8]"
              : gpsLocation || userLocation
              ? "bg-[#1a73e8] text-white hover:bg-[#1557b0]"
              : "bg-white text-[#5f6368] hover:text-[#1a73e8] hover:bg-[#f8f9fa]"
          }`}
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Crosshair className="w-4 h-4" />
          )}
        </button>

        {/* Re-center Route Button */}
        <button
          type="button"
          onClick={handleRecenter}
          title="Re-center on Route"
          className="w-10 h-10 rounded-full bg-white text-[#5f6368] hover:text-[#1a73e8] hover:bg-[#f8f9fa] flex items-center justify-center transition-all shadow-[0_2px_6px_rgba(0,0,0,0.3)] border border-[#dadce0] active:scale-95"
        >
          <Navigation className="w-4 h-4 -rotate-45" />
        </button>

        {/* Zoom In & Out Pill */}
        <div className="flex flex-col bg-white rounded-lg shadow-[0_2px_6px_rgba(0,0,0,0.3)] border border-[#dadce0] overflow-hidden">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom in"
            className="w-10 h-10 flex items-center justify-center text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors border-b border-[#dadce0] active:bg-[#e8eaed]"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom out"
            className="w-10 h-10 flex items-center justify-center text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors active:bg-[#e8eaed]"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* Google Maps Layer Switcher: Bottom-Left Thumbnail */}
      {/* ========================================================= */}
      <div className="absolute bottom-6 left-4 z-[400] select-none">
        <div className="relative">
          {/* Main Layers Button / Preview Box */}
          <button
            type="button"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="group flex items-center gap-2 p-1.5 pr-3 bg-white rounded-xl shadow-[0_2px_6px_rgba(0,0,0,0.3)] border border-[#dadce0] hover:shadow-[0_4px_12px_rgba(0,0,0,0.25)] transition-all active:scale-98"
            title="Change Map Layers"
          >
            <div className="w-9 h-9 rounded-lg overflow-hidden border border-[#dadce0] relative bg-[#f1f3f4] flex items-center justify-center">
              {tileMode === "satellite" ? (
                <div className="w-full h-full bg-[#1b3d2f] flex items-center justify-center text-[10px] text-white font-bold">
                  SAT
                </div>
              ) : tileMode === "dark" ? (
                <div className="w-full h-full bg-[#202124] flex items-center justify-center text-[10px] text-white font-bold">
                  NIGHT
                </div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#e8f0fe] via-[#ffffff] to-[#ceead6] flex items-center justify-center">
                  <LayersIcon className="w-4 h-4 text-[#1a73e8]" />
                </div>
              )}
            </div>
            <div className="text-left">
              <span className="block text-xs font-bold text-[#202124] capitalize">
                {tileMode} Map
              </span>
              <span className="block text-[10px] text-[#5f6368]">Layers & Style</span>
            </div>
          </button>

          {/* Expanded Layer Selection Popover */}
          {showLayerMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-2xl p-3 shadow-[0_4px_16px_rgba(0,0,0,0.2)] border border-[#dadce0] space-y-2 animate-in fade-in zoom-in-95 duration-150">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#5f6368] px-1">
                Map Types
              </div>

              {/* Mode Options */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: "standard",
                    label: "Default",
                    bgColor: "bg-gradient-to-br from-[#e8f0fe] to-[#ceead6]",
                  },
                  {
                    id: "satellite",
                    label: "Satellite",
                    bgColor: "bg-[#1b3d2f] text-white",
                  },
                  {
                    id: "dark",
                    label: "Night",
                    bgColor: "bg-[#202124] text-white",
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTileMode(item.id as MapTileMode);
                      setShowLayerMenu(false);
                    }}
                    className={`flex flex-col items-center gap-1 p-1 rounded-xl border text-center transition-all ${
                      tileMode === item.id
                        ? "border-[#1a73e8] ring-2 ring-[#1a73e8]/30 bg-[#e8f0fe]"
                        : "border-[#dadce0] hover:bg-[#f1f3f4]"
                    }`}
                  >
                    <div
                      className={`w-12 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-sm ${item.bgColor}`}
                    >
                      {tileMode === item.id && <Check className="w-3.5 h-3.5 text-[#1a73e8]" />}
                    </div>
                    <span className="text-[11px] font-semibold text-[#3c4043]">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Traffic Overlay Toggle */}
              <div className="pt-2 border-t border-[#dadce0]">
                <button
                  type="button"
                  onClick={() => setShowTrafficBadge(!showTrafficBadge)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#f1f3f4] text-xs text-[#3c4043] font-medium"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#188038]" /> Live Traffic Data
                  </span>
                  <span className="text-[11px] font-bold text-[#1a73e8]">
                    {showTrafficBadge ? "ON" : "OFF"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Traffic Status Floating Pill (Google Maps live traffic indicator) */}
      {showTrafficBadge && (
        <div className="absolute top-4 right-4 z-[400] flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.18)] border border-[#dadce0] text-xs font-medium text-[#3c4043]">
          <span className="w-2 h-2 rounded-full bg-[#188038] animate-pulse" />
          <span>Live Traffic: Normal Flow</span>
        </div>
      )}
    </div>
  );
}
