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
}

const DynamicMap = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-md rounded-2xl border border-white/10 text-slate-400">
      <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4" />
      <span className="text-sm font-medium tracking-wide">Initializing Geospatial Vector Layers...</span>
      <span className="text-xs text-slate-500 mt-1">OpenStreetMap & CartoDB Dark Matter Engine</span>
    </div>
  ),
});

export default function InteractiveMap(props: InteractiveMapProps) {
  return <DynamicMap {...props} />;
}
