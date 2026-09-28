"use client";

import dynamic from "next/dynamic";
import React from "react";
import { GeoPoint, CandidateRoute, StopItem } from "@/lib/api";

interface InteractiveMapProps {
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  waypoints?: GeoPoint[];
  routes: CandidateRoute[];
  selectedRouteId: string | null;
  onSelectRoute?: (routeId: string) => void;
  deliveryStops?: StopItem[];
  optimizedPolyline?: [number, number][];
  onMapClick?: (lat: number, lng: number) => void;
  onSetOrigin?: (point: GeoPoint) => void;
  onSetDestination?: (point: GeoPoint) => void;
  userLocation?: GeoPoint | null;
  onUserLocationFound?: (loc: GeoPoint) => void;
}

const DynamicMap = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center bg-[#e5e3df] text-[#5f6368]">
      <div className="w-10 h-10 border-4 border-[#1a73e8]/20 border-t-[#1a73e8] rounded-full animate-spin mb-3" />
      <span className="text-sm font-semibold tracking-wide text-[#202124]">Loading Google Maps Layers...</span>
      <span className="text-xs text-[#70757a] mt-1">High Precision Geospatial Routing Engine</span>
    </div>
  ),
});

export default function InteractiveMap(props: InteractiveMapProps) {
  return <DynamicMap {...props} />;
}
