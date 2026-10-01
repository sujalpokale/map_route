"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  GeoPoint,
  StopItem,
  OptimizeStopsResponse,
  optimizeStops,
  searchPlaces,
  reverseGeocode,
} from "@/lib/api";
import {
  Package,
  Plus,
  Trash2,
  Sparkles,
  Clock,
  Navigation,
  Weight,
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  MapPin,
  Loader2,
  Crosshair,
  RotateCcw,
  Flag,
  Target,
  Edit3,
  X,
  Building2,
  ArrowRight,
  Radio,
  Bike,
  Car,
  Truck,
  Bus,
  ShieldCheck,
} from "lucide-react";

interface MultiStopPlannerProps {
  origin: GeoPoint;
  destination?: GeoPoint | null;
  stops: StopItem[];
  onOriginChange?: (origin: GeoPoint) => void;
  onDestinationChange?: (destination: GeoPoint | null) => void;
  onStopsChange: (stops: StopItem[]) => void;
  onPlanGenerated: (res: OptimizeStopsResponse) => void;
  onClearPlan?: () => void;
}

const PRESET_CLUSTERS: { name: string; stops: StopItem[] }[] = [
  {
    name: "Pune City Deliveries (4 Stops)",
    stops: [
      {
        id: "stop-1",
        address: "Shivajinagar Commercial Complex, Pune",
        lat: 18.5314,
        lng: 73.8446,
        package_weight_kg: 35.0,
        priority: 2,
        time_window_start: "10:00",
        time_window_end: "12:00",
      },
      {
        id: "stop-2",
        address: "Kothrud Industrial Area, Pune",
        lat: 18.5074,
        lng: 73.8077,
        package_weight_kg: 20.0,
        priority: 1,
        time_window_start: "12:00",
        time_window_end: "14:00",
      },
      {
        id: "stop-3",
        address: "Hinjawadi Infotech Park Phase 1, Pune",
        lat: 18.5913,
        lng: 73.7389,
        package_weight_kg: 45.0,
        priority: 1,
        time_window_start: "14:00",
        time_window_end: "16:00",
      },
      {
        id: "stop-4",
        address: "Hadapsar Magarpatta Cybercity, Pune",
        lat: 18.5089,
        lng: 73.9260,
        package_weight_kg: 60.0,
        priority: 3, // Urgent
        time_window_start: "16:00",
        time_window_end: "18:00",
      },
    ],
  },
  {
    name: "Express Airport Cargo (3 Stops)",
    stops: [
      {
        id: "stop-a",
        address: "Pune International Airport Cargo, Lohegaon",
        lat: 18.5821,
        lng: 73.9197,
        package_weight_kg: 50.0,
        priority: 3,
        time_window_start: "09:00",
        time_window_end: "11:00",
      },
      {
        id: "stop-b",
        address: "Viman Nagar Metro Hub, Pune",
        lat: 18.5679,
        lng: 73.9143,
        package_weight_kg: 18.0,
        priority: 1,
      },
      {
        id: "stop-c",
        address: "Kalyani Nagar Commerce Zone, Pune",
        lat: 18.5463,
        lng: 73.9033,
        package_weight_kg: 25.0,
        priority: 2,
      },
    ],
  },
];

export default function MultiStopPlanner({
  origin,
  destination = null,
  stops,
  onOriginChange,
  onDestinationChange,
  onStopsChange,
  onPlanGenerated,
  onClearPlan,
}: MultiStopPlannerProps) {
  // 1. Start Point (Origin) State: "live" | "custom"
  const [startPointMode, setStartPointMode] = useState<"live" | "custom">("live");
  const [isLocatingStart, setIsLocatingStart] = useState(false);
  const [startQuery, setStartQuery] = useState(origin?.address || "");
  const [startSuggestions, setStartSuggestions] = useState<GeoPoint[]>([]);
  const [isSearchingStart, setIsSearchingStart] = useState(false);
  const [showStartDropdown, setShowStartDropdown] = useState(false);

  // 2. Middle Stop Input State
  const [middleQuery, setMiddleQuery] = useState("");
  const [middleSuggestions, setMiddleSuggestions] = useState<GeoPoint[]>([]);
  const [selectedMiddleGeo, setSelectedMiddleGeo] = useState<GeoPoint | null>(null);
  const [isSearchingMiddle, setIsSearchingMiddle] = useState(false);
  const [showMiddleDropdown, setShowMiddleDropdown] = useState(false);
  const [newPriority, setNewPriority] = useState(1);

  // 3. End Point Mode State: "last_stop" | "return_origin" | "custom_dest"
  const [endPointMode, setEndPointMode] = useState<"last_stop" | "return_origin" | "custom_dest">(
    destination ? "custom_dest" : "last_stop"
  );
  const [endQuery, setEndQuery] = useState(destination?.address || "");
  const [endSuggestions, setEndSuggestions] = useState<GeoPoint[]>([]);
  const [isSearchingEnd, setIsSearchingEnd] = useState(false);
  const [showEndDropdown, setShowEndDropdown] = useState(false);

  // Solve & Response State
  const [vehicleType, setVehicleType] = useState<"BIKE" | "CAR" | "VAN" | "BUS" | "TRUCK">("BIKE");
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<OptimizeStopsResponse | null>(null);
  const [isOptimized, setIsOptimized] = useState(false);

  const startTimerRef = useRef<NodeJS.Timeout | null>(null);
  const middleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const endTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startDropdownRef = useRef<HTMLDivElement | null>(null);
  const middleDropdownRef = useRef<HTMLDivElement | null>(null);
  const endDropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (startDropdownRef.current && !startDropdownRef.current.contains(e.target as Node)) {
        setShowStartDropdown(false);
      }
      if (middleDropdownRef.current && !middleDropdownRef.current.contains(e.target as Node)) {
        setShowMiddleDropdown(false);
      }
      if (endDropdownRef.current && !endDropdownRef.current.contains(e.target as Node)) {
        setShowEndDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Sync destination prop with local query if changed from map
  useEffect(() => {
    if (destination) {
      if (origin && destination.lat === origin.lat && destination.lng === origin.lng) {
        setEndPointMode("return_origin");
      } else {
        setEndQuery(destination.name || destination.address || "");
        setEndPointMode("custom_dest");
      }
    }
  }, [destination, origin]);

  // --- End Point Mode Selector ---
  const handleSelectEndPointMode = (mode: "last_stop" | "return_origin" | "custom_dest") => {
    setEndPointMode(mode);
    setIsOptimized(false);
    if (mode === "last_stop") {
      if (onDestinationChange) onDestinationChange(null);
    } else if (mode === "return_origin") {
      if (onDestinationChange) onDestinationChange(origin);
    } else if (mode === "custom_dest") {
      // Keep in custom mode and allow searching
    }
  };

  // --- 1. Start Point Handlers ---
  const handleUseLiveLocationAsStart = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocatingStart(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setIsLocatingStart(false);
        try {
          const addr = await reverseGeocode(lat, lng);
          const livePoint: GeoPoint = {
            lat,
            lng,
            address: addr || "Your Current Live Location",
            name: "Live GPS Location",
          };
          setStartPointMode("live");
          setStartQuery(livePoint.address || "");
          setShowStartDropdown(false);
          if (onOriginChange) onOriginChange(livePoint);
          setIsOptimized(false);
        } catch (err) {
          console.warn(err);
        }
      },
      (err) => {
        setIsLocatingStart(false);
        alert("Could not access GPS location. Please ensure location permissions are granted.");
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
    );
  };

  const handleStartQueryChange = (text: string) => {
    setStartQuery(text);
    setShowStartDropdown(true);

    if (startTimerRef.current) clearTimeout(startTimerRef.current);

    if (text.trim().length >= 2) {
      setIsSearchingStart(true);
      startTimerRef.current = setTimeout(async () => {
        try {
          const results = await searchPlaces(text);
          setStartSuggestions(results);
        } catch (e) {
          console.warn(e);
        } finally {
          setIsSearchingStart(false);
        }
      }, 250);
    } else {
      setStartSuggestions([]);
      setIsSearchingStart(false);
    }
  };

  const handleSelectStartSuggestion = (place: GeoPoint) => {
    setStartQuery(place.name || place.address || "");
    setShowStartDropdown(false);
    setStartPointMode("custom");
    if (onOriginChange) onOriginChange(place);
    setIsOptimized(false);
  };

  // --- 2. Middle Stops Handlers ---
  const handleMiddleQueryChange = (text: string) => {
    setMiddleQuery(text);
    setSelectedMiddleGeo(null);
    setShowMiddleDropdown(true);

    if (middleTimerRef.current) clearTimeout(middleTimerRef.current);

    if (text.trim().length >= 2) {
      setIsSearchingMiddle(true);
      middleTimerRef.current = setTimeout(async () => {
        try {
          const results = await searchPlaces(text);
          setMiddleSuggestions(results);
        } catch (e) {
          console.warn(e);
        } finally {
          setIsSearchingMiddle(false);
        }
      }, 250);
    } else {
      setMiddleSuggestions([]);
      setIsSearchingMiddle(false);
    }
  };

  const handleSelectMiddleSuggestion = (place: GeoPoint) => {
    setSelectedMiddleGeo(place);
    setMiddleQuery(place.name || place.address || "");
    setShowMiddleDropdown(false);
  };

  const handleAddMiddleStop = () => {
    if (!middleQuery.trim()) return;

    const lat = selectedMiddleGeo
      ? selectedMiddleGeo.lat
      : origin.lat + (Math.random() - 0.5) * 0.06;
    const lng = selectedMiddleGeo
      ? selectedMiddleGeo.lng
      : origin.lng + (Math.random() - 0.5) * 0.06;

    const newStop: StopItem = {
      id: `stop-${Date.now()}`,
      address: middleQuery.trim(),
      lat,
      lng,
      priority: newPriority,
    };

    const updated = [...stops, newStop];
    onStopsChange(updated);
    setMiddleQuery("");
    setSelectedMiddleGeo(null);
    setShowMiddleDropdown(false);
    setIsOptimized(false);
  };

  const handleRemoveMiddleStop = (id: string) => {
    const updated = stops.filter((s) => s.id !== id);
    onStopsChange(updated);
    setIsOptimized(false);
  };

  const handleClearAll = () => {
    onStopsChange([]);
    setLastResponse(null);
    setIsOptimized(false);
    if (onClearPlan) onClearPlan();
  };

  const handleLoadPreset = (presetStops: StopItem[]) => {
    onStopsChange(presetStops);
    setLastResponse(null);
    setIsOptimized(false);
  };

  // --- 3. End Point Handlers ---
  const handleEndQueryChange = (text: string) => {
    setEndQuery(text);
    setShowEndDropdown(true);

    if (endTimerRef.current) clearTimeout(endTimerRef.current);

    if (text.trim().length >= 2) {
      setIsSearchingEnd(true);
      endTimerRef.current = setTimeout(async () => {
        try {
          const results = await searchPlaces(text);
          setEndSuggestions(results);
        } catch (e) {
          console.warn(e);
        } finally {
          setIsSearchingEnd(false);
        }
      }, 250);
    } else {
      setEndSuggestions([]);
      setIsSearchingEnd(false);
    }
  };

  const handleSelectEndSuggestion = (place: GeoPoint) => {
    setEndQuery(place.name || place.address || "");
    setShowEndDropdown(false);
    if (onDestinationChange) onDestinationChange(place);
    setIsOptimized(false);
  };

  // --- Run Optimization ---
  const handleRunOptimization = async () => {
    if (stops.length === 0 || loading) return;
    setLoading(true);

    let finalDest: GeoPoint | undefined = undefined;
    if (endPointMode === "return_origin") {
      finalDest = origin;
    } else if (endPointMode === "custom_dest" && destination) {
      finalDest = destination;
    }

    try {
      const res = await optimizeStops({
        origin: origin,
        destination: finalDest,
        stops: stops,
        vehicle_type: vehicleType,
      });
      setLastResponse(res);
      setIsOptimized(true);
      onPlanGenerated(res);
    } catch (e: any) {
      alert(`Optimization failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3.5 select-none">
      {/* ========================================================= */}
      {/* 1. Header Card with Primary Action */}
      {/* ========================================================= */}
      <div className="p-3.5 rounded-2xl bg-white border border-[#dadce0] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="font-bold text-[#202124] text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-[#1a73e8] shrink-0" /> Multi-Stop Journey Planner
          </h3>
          <p className="text-[11px] text-[#5f6368] mt-0.5">
            <b>Start</b> → <b>Middle Drops (Nearest First)</b> → <b>End Point</b>
          </p>
        </div>
        <button
          type="button"
          onClick={handleRunOptimization}
          disabled={loading || stops.length === 0}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all active:scale-95 shrink-0 whitespace-nowrap"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>{loading ? "Optimizing..." : "Calculate Best Route"}</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* Vehicle Selection & Road Guidance Toolbar */}
      {/* ========================================================= */}
      <div className="p-3 rounded-2xl bg-white border border-[#dadce0] shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-[#202124]">
          <span className="flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-[#1a73e8]" />
            Routing Vehicle & Road Type Mode
          </span>
          <span className="text-[10px] font-semibold text-[#1a73e8] bg-[#e8f0fe] px-2 py-0.5 rounded-full">
            {vehicleType === "BIKE"
              ? "Small Roads & Alleys"
              : vehicleType === "CAR"
              ? "City Streets & Avenues"
              : vehicleType === "VAN"
              ? "Delivery Corridors"
              : vehicleType === "BUS"
              ? "Transit Boulevards"
              : "Freight Bypasses"}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {[
            { id: "BIKE", label: "Bike", sub: "Small roads", icon: Bike, color: "text-[#188038]" },
            { id: "CAR", label: "Car", sub: "City streets", icon: Car, color: "text-[#1a73e8]" },
            { id: "VAN", label: "Van", sub: "Deliveries", icon: Truck, color: "text-[#b06000]" },
            { id: "BUS", label: "Bus", sub: "Transit roads", icon: Bus, color: "text-[#8430ce]" },
            { id: "TRUCK", label: "Truck", sub: "Freight ring", icon: Truck, color: "text-[#c5221f]" },
          ].map((v) => {
            const Icon = v.icon;
            const isSelected = vehicleType === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setVehicleType(v.id as any);
                  setIsOptimized(false);
                }}
                className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? "bg-[#e8f0fe] border-[#1a73e8] shadow-xs ring-1 ring-[#1a73e8]"
                    : "bg-[#f8f9fa] border-[#dadce0] hover:bg-white text-[#5f6368]"
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 ${isSelected ? v.color : "text-[#5f6368]"}`} />
                <span className={`text-[11px] font-bold ${isSelected ? "text-[#202124]" : "text-[#5f6368]"}`}>
                  {v.label}
                </span>
                <span className="text-[9px] text-[#70757a] hidden sm:block truncate">{v.sub}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Road Characteristic Explanation banner */}
        <div className="text-[11px] text-[#3c4043] bg-[#f8f9fa] border border-[#f1f3f4] rounded-xl px-2.5 py-1.5 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#1a73e8] shrink-0" />
          <span className="leading-snug">
            {vehicleType === "BIKE" && (
              <><b>Bike Mode:</b> Suggests small roads, residential alleys, and shortcuts. Completely bypasses car gridlock and tolls.</>
            )}
            {vehicleType === "CAR" && (
              <><b>Car Mode:</b> Suggests primary city streets, avenues, flyovers, and standard traffic lanes.</>
            )}
            {vehicleType === "VAN" && (
              <><b>Van Mode:</b> Commercial courier routes with accessible curbside loading zones and parcel delivery lanes.</>
            )}
            {vehicleType === "BUS" && (
              <><b>Bus Mode:</b> Wide transit boulevards & high-clearance arterials. Avoids narrow residential alleys & low clearances.</>
            )}
            {vehicleType === "TRUCK" && (
              <><b>Truck Mode:</b> Outer ring bypasses & freight corridors. Strictly avoids weight-restricted narrow streets.</>
            )}
          </span>
        </div>
      </div>


      {/* ========================================================= */}
      {/* 2. Structured Step-by-Step Flow Cards (No Overlaps) */}
      {/* ========================================================= */}
      <div className="space-y-3">
        {/* --------------------------------------------------------- */}
        {/* CARD 1: 🟢 START POINT (Departure Hub) */}
        {/* --------------------------------------------------------- */}
        <div className="p-3 rounded-2xl bg-white border border-[#ceead6] shadow-xs space-y-2.5 relative z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#188038] text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                A
              </span>
              <span className="text-xs font-bold text-[#188038] uppercase tracking-wide">
                1. Start Point (Departure Hub)
              </span>
            </div>

            <button
              type="button"
              onClick={handleUseLiveLocationAsStart}
              disabled={isLocatingStart}
              className="px-2.5 py-1 rounded-lg bg-[#e6f4ea] hover:bg-[#ceead6] text-[#137333] text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50"
              title="Click to detect and set your live GPS location as the route start"
            >
              {isLocatingStart ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#188038]" />
              ) : (
                <Crosshair className="w-3.5 h-3.5 text-[#188038]" />
              )}
              <span>{isLocatingStart ? "Locating..." : "Set Live Location"}</span>
            </button>
          </div>

          {/* 2 Dedicated Start Point Mode Tabs */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              {[
                {
                  id: "live",
                  label: "📍 Live GPS Location",
                  desc: "Start from your current device",
                },
                {
                  id: "custom",
                  label: "🔍 Custom Hub / Search",
                  desc: "Choose warehouse or depot",
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (opt.id === "live") {
                      handleUseLiveLocationAsStart();
                    } else {
                      setStartPointMode("custom");
                    }
                  }}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    startPointMode === opt.id
                      ? "border-[#188038] bg-[#f6fbf7] ring-1 ring-[#188038]"
                      : "border-[#dadce0] bg-[#f8f9fa] hover:bg-white"
                  }`}
                >
                  <span
                    className={`block text-xs font-bold ${
                      startPointMode === opt.id ? "text-[#188038]" : "text-[#202124]"
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="block text-[9px] text-[#70757a] leading-tight mt-0.5">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>

            {/* If Live Location Active */}
            {startPointMode === "live" && (
              <div className="p-2.5 rounded-xl bg-[#f6fbf7] border border-[#ceead6] flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#188038] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#188038]"></span>
                    </span>
                    <span className="font-semibold text-[#137333] truncate block">
                      {origin?.address || "Your Current Live Location"}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#5f6368] block mt-0.5 pl-3.5">
                    GPS: {origin?.lat.toFixed(4)}, {origin?.lng.toFixed(4)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleUseLiveLocationAsStart}
                  disabled={isLocatingStart}
                  className="px-2 py-1 rounded-lg bg-white border border-[#ceead6] hover:bg-[#e6f4ea] text-[#137333] text-[10px] font-bold flex items-center gap-1 shadow-2xs shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>
            )}

            {/* If Custom Search Active */}
            {startPointMode === "custom" && (
              <div ref={startDropdownRef} className="relative">
                <div className="relative">
                  <input
                    type="text"
                    value={startQuery}
                    onChange={(e) => handleStartQueryChange(e.target.value)}
                    onFocus={() => setShowStartDropdown(true)}
                    placeholder="Search start hub, depot, or address..."
                    className="w-full bg-[#f8f9fa] border border-[#188038] focus:ring-2 focus:ring-[#188038]/20 rounded-xl px-3 py-1.5 text-xs text-[#202124] focus:outline-none focus:bg-white pr-7"
                  />
                  {startQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setStartQuery("");
                        setStartSuggestions([]);
                        setShowStartDropdown(false);
                      }}
                      className="absolute right-2 top-2 text-[#70757a] hover:text-[#202124]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {isSearchingStart && (
                    <Loader2 className="w-3.5 h-3.5 text-[#188038] animate-spin absolute right-2 top-2" />
                  )}
                </div>

                {showStartDropdown && startSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-[999] bg-white rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.25)] border border-[#dadce0] overflow-hidden max-h-40 overflow-y-auto divide-y divide-[#f1f3f4]">
                    {startSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectStartSuggestion(item)}
                        className="w-full text-left px-3 py-2.5 bg-white hover:bg-[#e8f0fe] text-xs transition-colors flex items-center gap-2"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#188038] shrink-0" />
                        <div className="min-w-0 flex-1 truncate">
                          <span className="font-semibold text-[#202124]">
                            {item.name || item.address?.split(",")[0]}
                          </span>
                          <span className="text-[10px] text-[#70757a] block truncate">
                            {item.address}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* CARD 2: 🔵 MIDDLE STOPS (Intermediate Deliveries) */}
        {/* --------------------------------------------------------- */}
        <div className="p-3 rounded-2xl bg-white border border-[#d2e3fc] shadow-xs space-y-2.5 relative z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#1a73e8] text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                {stops.length}
              </span>
              <span className="text-xs font-bold text-[#1a73e8] uppercase tracking-wide">
                2. Middle Drops ({stops.length})
              </span>
            </div>
            <span className="text-[11px] text-[#70757a]">Auto-sorted Nearest First</span>
          </div>

          {/* Add Middle Stop Input Row (Fluid & Responsive) */}
          <div ref={middleDropdownRef} className="relative space-y-1.5">
            <div className="flex flex-wrap sm:flex-nowrap gap-1.5">
              <div className="relative flex-1 min-w-[170px]">
                <input
                  type="text"
                  value={middleQuery}
                  onChange={(e) => handleMiddleQueryChange(e.target.value)}
                  onFocus={() => setShowMiddleDropdown(true)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddMiddleStop()}
                  placeholder="Type address or click on map..."
                  className="w-full bg-[#f8f9fa] border border-[#dadce0] focus:border-[#1a73e8] rounded-xl px-3 py-1.5 text-xs text-[#202124] placeholder-[#80868b] focus:outline-none focus:bg-white pr-7"
                />
                {middleQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setMiddleQuery("");
                      setMiddleSuggestions([]);
                      setShowMiddleDropdown(false);
                    }}
                    className="absolute right-2 top-2 text-[#70757a] hover:text-[#202124]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                {isSearchingMiddle && (
                  <Loader2 className="w-3.5 h-3.5 text-[#1a73e8] animate-spin absolute right-2 top-2" />
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(parseInt(e.target.value))}
                  className="bg-[#f8f9fa] border border-[#dadce0] rounded-xl px-2 py-1.5 text-xs text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                >
                  <option value={1}>Normal</option>
                  <option value={2}>High</option>
                  <option value={3}>⚡ Urgent</option>
                </select>

                <button
                  type="button"
                  onClick={handleAddMiddleStop}
                  className="px-3 py-1.5 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-bold transition-colors flex items-center gap-1 shrink-0 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            {/* Suggestions Dropdown (High z-index to overlay cleanly with solid white background) */}
            {showMiddleDropdown && middleSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-[999] bg-white rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.25)] border border-[#dadce0] overflow-hidden max-h-48 overflow-y-auto divide-y divide-[#f1f3f4]">
                {middleSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectMiddleSuggestion(item)}
                    className="w-full text-left px-3 py-2.5 bg-white hover:bg-[#e8f0fe] text-xs transition-colors flex items-center gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#1a73e8] shrink-0" />
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-semibold text-[#202124]">{item.name || item.address?.split(",")[0]}</span>
                      <span className="text-[10px] text-[#70757a] block truncate">{item.address}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* CARD 3: 🔴 END POINT (Final Destination) */}
        {/* --------------------------------------------------------- */}
        <div className="p-3 rounded-2xl bg-white border border-[#fce8e6] shadow-xs space-y-2.5 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#d93025] text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                B
              </span>
              <span className="text-xs font-bold text-[#d93025] uppercase tracking-wide">
                3. End Point (Finish Location)
              </span>
            </div>
          </div>

          {/* 3 Prominent, Non-Overlapping Option Cards */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              {[
                {
                  id: "last_stop",
                  label: "🏁 Last Drop",
                  desc: "Finish at final customer",
                },
                {
                  id: "return_origin",
                  label: "🔄 Return to Start",
                  desc: "Round-trip back to depot",
                },
                {
                  id: "custom_dest",
                  label: "🎯 Custom Hub",
                  desc: "Specific finish address",
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectEndPointMode(opt.id as any)}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    endPointMode === opt.id
                      ? "border-[#d93025] bg-[#fef7f6] ring-1 ring-[#d93025]"
                      : "border-[#dadce0] bg-[#f8f9fa] hover:bg-white"
                  }`}
                >
                  <span className={`block text-xs font-bold ${endPointMode === opt.id ? "text-[#d93025]" : "text-[#202124]"}`}>
                    {opt.label}
                  </span>
                  <span className="block text-[9px] text-[#70757a] leading-tight mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>

            {/* If Custom Location Selected: Search Box */}
            {endPointMode === "custom_dest" && (
              <div ref={endDropdownRef} className="relative">
                <input
                  type="text"
                  value={endQuery}
                  onChange={(e) => handleEndQueryChange(e.target.value)}
                  onFocus={() => setShowEndDropdown(true)}
                  placeholder="Search final finish location or warehouse..."
                  className="w-full bg-[#f8f9fa] border border-[#d93025] focus:ring-2 focus:ring-[#d93025]/20 rounded-xl px-3 py-1.5 text-xs text-[#202124] focus:outline-none focus:bg-white"
                />
                {showEndDropdown && endSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-[999] bg-white rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.25)] border border-[#dadce0] overflow-hidden max-h-40 overflow-y-auto divide-y divide-[#f1f3f4]">
                    {endSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectEndSuggestion(item)}
                        className="w-full text-left px-3 py-2.5 bg-white hover:bg-[#fce8e6] text-xs transition-colors flex items-center gap-2"
                      >
                        <Target className="w-3.5 h-3.5 text-[#d93025] shrink-0" />
                        <div className="min-w-0 flex-1 truncate">
                          <span className="font-semibold text-[#202124]">{item.name || item.address?.split(",")[0]}</span>
                          <span className="text-[10px] text-[#70757a] block truncate">{item.address}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. Result KPI metrics (When Optimized) */}
      {/* ========================================================= */}
      {lastResponse && (
        <div className="p-3.5 rounded-2xl bg-[#e8f0fe] border border-[#d2e3fc] space-y-3 animate-in fade-in duration-200">
          {/* Vehicle Profile & Road Suitability Badges */}
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#d2e3fc]/80 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-[#1a73e8] text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                {lastResponse.vehicle_type === "BIKE" ? (
                  <Bike className="w-3 h-3" />
                ) : lastResponse.vehicle_type === "BUS" ? (
                  <Bus className="w-3 h-3" />
                ) : lastResponse.vehicle_type === "TRUCK" ? (
                  <Truck className="w-3 h-3" />
                ) : lastResponse.vehicle_type === "VAN" ? (
                  <Truck className="w-3 h-3" />
                ) : (
                  <Car className="w-3 h-3" />
                )}
                {lastResponse.vehicle_type || vehicleType} ROUTE
              </span>
              {lastResponse.road_type_summary && (
                <span className="text-[11px] font-semibold text-[#174ea6] bg-white/80 px-2 py-0.5 rounded-md border border-[#d2e3fc]">
                  🛣️ {lastResponse.road_type_summary}
                </span>
              )}
            </div>

            {lastResponse.road_suitability_score && (
              <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] border border-[#ceead6] px-2 py-0.5 rounded-md flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#188038]" />
                {lastResponse.road_suitability_score}% Road Fit
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-[10px] text-[#5f6368] flex items-center justify-center gap-1">
                <Navigation className="w-3 h-3 text-[#1a73e8]" /> Distance
              </div>
              <div className="text-sm font-bold text-[#202124] mt-0.5">
                {lastResponse.total_distance_km} km
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#5f6368] flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-[#188038]" /> Est. Time
              </div>
              <div className="text-sm font-bold text-[#202124] mt-0.5">
                {lastResponse.estimated_duration_min} min
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#5f6368] flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3 text-[#8430ce]" /> Avg Speed
              </div>
              <div className="text-sm font-bold text-[#202124] mt-0.5">
                {lastResponse.average_speed_kmh ? `${Math.round(lastResponse.average_speed_kmh)} km/h` : "32 km/h"}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#5f6368] flex items-center justify-center gap-1">
                <Weight className="w-3 h-3 text-[#ea8600]" /> Payload
              </div>
              <div className="text-sm font-bold text-[#202124] mt-0.5">
                {lastResponse.total_payload_kg} kg
              </div>
            </div>
          </div>

          {lastResponse.vehicle_road_guidance && (
            <div className="text-[11px] text-[#1a73e8] bg-white/90 p-2 rounded-xl border border-[#d2e3fc] flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#1a73e8] shrink-0 mt-0.5" />
              <span>{lastResponse.vehicle_road_guidance}</span>
            </div>
          )}

          {lastResponse.summary && (
            <p className="text-[11px] text-[#3c4043] leading-relaxed pt-1 border-t border-[#d2e3fc]/60">
              {lastResponse.summary}
            </p>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. Middle Delivery Stops List & Preset Chips */}
      {/* ========================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[#5f6368] px-1 font-medium">
          <span>
            {isOptimized ? "Optimized Delivery Sequence" : "Middle Stops List"} ({stops.length})
          </span>
          <div className="flex items-center gap-2">
            {stops.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[#d93025] text-[11px] hover:underline"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESET_CLUSTERS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleLoadPreset(preset.stops)}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white hover:bg-[#e8f0fe] hover:text-[#1a73e8] text-[#3c4043] border border-[#dadce0] shadow-2xs transition-colors"
            >
              + {preset.name}
            </button>
          ))}
        </div>

        {stops.length === 0 ? (
          <div className="p-5 text-center text-[#70757a] text-xs bg-white rounded-2xl border border-dashed border-[#dadce0]">
            <MapPin className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-[#1a73e8]" />
            <p className="font-semibold text-[#202124]">No middle drops added yet</p>
            <p className="text-[11px] mt-0.5">
              Click anywhere on the map or type an address in Step 2 to add customer drops.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
            {stops.map((stop, idx) => {
              const isFirst = idx === 0;
              const isUrgent = stop.priority === 3;

              return (
                <div
                  key={stop.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl bg-white border transition-all text-xs shadow-2xs ${
                    isUrgent
                      ? "border-[#f28b82] bg-[#fef7f6]"
                      : isOptimized
                      ? "border-[#ceead6] hover:border-[#188038]"
                      : "border-[#dadce0] hover:border-[#bdc1c6]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] shrink-0 text-white ${
                        isUrgent
                          ? "bg-[#d93025]"
                          : isFirst && isOptimized
                          ? "bg-[#188038]"
                          : "bg-[#1a73e8]"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-[#202124] truncate flex items-center gap-1.5">
                        <span>{stop.address}</span>
                        {isOptimized && isFirst && (
                          <span className="text-[9px] bg-[#e6f4ea] text-[#137333] px-1.5 py-0.2 rounded-full font-bold">
                            Nearest 1st
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#5f6368] flex items-center gap-1.5 mt-0.5">
                        {isUrgent ? (
                          <span className="text-[#d93025] font-bold">⚡ Urgent Priority</span>
                        ) : (
                          <span>Priority {stop.priority === 2 ? 'High' : 'Normal'}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveMiddleStop(stop.id)}
                    className="p-1.5 text-[#5f6368] hover:text-[#d93025] hover:bg-[#fce8e6] rounded-lg transition-colors shrink-0 ml-2"
                    title="Remove Stop"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
