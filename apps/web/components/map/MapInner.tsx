"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { GeoPoint, CandidateRoute, StopItem } from "@/lib/api";

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
}: MapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polylinesLayerRef = useRef<L.LayerGroup | null>(null);

  // 1. Initialize Leaflet Map Instance once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center around Pune / Western Maharashtra as initial default
    const initialCenter: [number, number] = [18.5204, 73.8567];
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });

    // Dark Matter tile layer for commercial look
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    // Zoom controls at bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Attribution
    L.control
      .attribution({ position: "bottomleft" })
      .addAttribution('&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors')
      .addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    const polylinesLayer = L.layerGroup().addTo(map);

    markersLayerRef.current = markersLayer;
    polylinesLayerRef.current = polylinesLayer;
    mapInstanceRef.current = map;

    // Map click handler
    if (onMapClick) {
      map.on("click", (e) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Render Markers and Route Polylines whenever props change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const polylinesLayer = polylinesLayerRef.current;
    if (!map || !markersLayer || !polylinesLayer) return;

    markersLayer.clearLayers();
    polylinesLayer.clearLayers();

    const allPoints: [number, number][] = [];

    // Helper for custom SVG DivIcon
    const createMarkerIcon = (color: string, label: string, iconSymbol: string) => {
      return L.divIcon({
        className: "custom-div-marker",
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: #0f172a;
            border: 2px solid ${color};
            border-radius: 50%;
            box-shadow: 0 0 16px ${color}88, 0 4px 10px rgba(0,0,0,0.5);
            color: #ffffff;
            font-size: 14px;
            font-weight: 700;
          ">
            ${iconSymbol}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
    };

    // Render Origin Marker
    if (origin) {
      const origIcon = createMarkerIcon("#10b981", "Origin", "A");
      const origMarker = L.marker([origin.lat, origin.lng], { icon: origIcon }).addTo(markersLayer);
      origMarker.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #10b981; font-weight: 800; letter-spacing: 0.5px;">Trip Origin</div>
          <div style="font-weight: 600; color: #f8fafc; font-size: 13px; margin-top: 2px;">${origin.address || "Start Location"}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">(${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)})</div>
        </div>
      `);
      allPoints.push([origin.lat, origin.lng]);
    }

    // Render Destination Marker
    if (destination) {
      const destIcon = createMarkerIcon("#ef4444", "Destination", "B");
      const destMarker = L.marker([destination.lat, destination.lng], { icon: destIcon }).addTo(markersLayer);
      destMarker.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #ef4444; font-weight: 800; letter-spacing: 0.5px;">Trip Destination</div>
          <div style="font-weight: 600; color: #f8fafc; font-size: 13px; margin-top: 2px;">${destination.address || "End Location"}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">(${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)})</div>
        </div>
      `);
      allPoints.push([destination.lat, destination.lng]);
    }

    // Render Waypoints
    waypoints.forEach((wp, idx) => {
      const wpIcon = createMarkerIcon("#f59e0b", `Stop ${idx + 1}`, `${idx + 1}`);
      const m = L.marker([wp.lat, wp.lng], { icon: wpIcon }).addTo(markersLayer);
      m.bindPopup(`<b>Waypoint ${idx + 1}</b><br/>${wp.address || ""}`);
      allPoints.push([wp.lat, wp.lng]);
    });

    // Render Delivery Stops (for VRP mode)
    deliveryStops.forEach((stop, idx) => {
      const isUrgent = stop.priority === 3;
      const color = isUrgent ? "#f43f5e" : "#06b6d4";
      const icon = createMarkerIcon(color, `Delivery ${idx + 1}`, `${idx + 1}`);
      const m = L.marker([stop.lat, stop.lng], { icon }).addTo(markersLayer);
      m.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px;">
          <div style="font-size: 11px; color: ${color}; font-weight: 800;">STOP #${idx + 1} ${isUrgent ? "⚡ URGENT" : ""}</div>
          <div style="font-weight: 600; color: #f8fafc; font-size: 13px;">${stop.address}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Payload: ${stop.package_weight_kg} kg | Priority: ${stop.priority}</div>
        </div>
      `);
      allPoints.push([stop.lat, stop.lng]);
    });

    // Render VRP Optimized Polyline if provided
    if (optimizedPolyline && optimizedPolyline.length > 0) {
      const poly = L.polyline(optimizedPolyline, {
        color: "#06b6d4",
        weight: 5,
        opacity: 0.9,
        dashArray: "8, 6",
      }).addTo(polylinesLayer);
      optimizedPolyline.forEach((pt) => allPoints.push(pt));
    }

    // Render Candidate Route Polylines
    if (routes && routes.length > 0) {
      // First sort routes so unselected ones are underneath and selected is on top
      const sortedRoutes = [...routes].sort((a, b) => {
        if (a.id === selectedRouteId) return 1;
        if (b.id === selectedRouteId) return -1;
        return 0;
      });

      sortedRoutes.forEach((r, idx) => {
        const isSelected = r.id === selectedRouteId || (!selectedRouteId && r.is_recommended);
        
        let color = "#a855f7"; // purple default alternative
        if (isSelected) {
          color = "#06b6d4"; // Vibrant cyan for primary
        } else if (idx === 1) {
          color = "#eab308"; // Amber for secondary
        } else if (idx === 2) {
          color = "#64748b"; // Muted slate for tertiary
        }

        const poly = L.polyline(r.coordinates, {
          color: color,
          weight: isSelected ? 6 : 4,
          opacity: isSelected ? 0.95 : 0.45,
          lineJoin: "round",
          dashArray: isSelected ? undefined : "6, 8",
        }).addTo(polylinesLayer);

        // Click on polyline to select route
        poly.on("click", () => {
          if (onSelectRoute) onSelectRoute(r.id);
        });

        // Hover tooltip
        poly.bindTooltip(
          `<b>${r.label}</b><br/>Score: <b>${r.overall_score}</b>/100 • ${r.duration_min} min • ${r.distance_km} km`,
          { sticky: true, className: "custom-leaflet-tooltip" }
        );

        if (isSelected) {
          r.coordinates.forEach((pt) => allPoints.push(pt));
        }
      });
    }

    // Auto-fit bounds if we have points
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [origin, destination, waypoints, routes, selectedRouteId, deliveryStops, optimizedPolyline]);

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <div ref={mapContainerRef} className="w-full h-full rounded-2xl overflow-hidden" />
      
      {/* Map Overlay Badge */}
      <div className="absolute top-4 right-4 z-[400] flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs text-slate-300">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        Live Traffic & Telemetry
      </div>
    </div>
  );
}
