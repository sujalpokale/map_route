"use client";

import React, { useState, useEffect } from "react";
import {
  GeoPoint,
  CandidateRoute,
  calculateRoutes,
  searchPlaces,
  reverseGeocode,
  checkReroute,
  OptimizeStopsResponse,
  StopItem,
} from "@/lib/api";
import InteractiveMap from "@/components/map/InteractiveMap";
import GooglePlaceAutocomplete from "@/components/routes/GooglePlaceAutocomplete";
import RouteCard from "@/components/routes/RouteCard";
import ComparisonMatrixModal from "@/components/routes/ComparisonMatrixModal";
import AIAssistantDrawer from "@/components/ai/AIAssistantDrawer";
import MultiStopPlanner from "@/components/vrp/MultiStopPlanner";
import FleetDashboardView from "@/components/fleet/FleetDashboardView";
import OCRScannerView from "@/components/ocr/OCRScannerView";
import AnalyticsDashboardView from "@/components/analytics/AnalyticsDashboardView";
import {
  Navigation,
  Sparkles,
  Search,
  ArrowUpDown,
  Car,
  Truck,
  Bike,
  BatteryCharging,
  Layers,
  Bot,
  Scan,
  TrendingUp,
  Package,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Zap,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  Circle,
  Menu,
  Crosshair,
} from "lucide-react";

export default function Home() {
  // Navigation tabs: studio | vrp | fleet | ocr | analytics
  const [activeTab, setActiveTab] = useState<"studio" | "vrp" | "fleet" | "ocr" | "analytics">("studio");

  // Floating Drawer / Panel Collapse & Width state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState<number>(480);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Mouse Drag Handler to dynamically resize sidebar panel
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(380, Math.min(e.clientX - 12, window.innerWidth - 60));
      setPanelWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    if (isResizing) {
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Route Studio State — default to null so live location is acquired first
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [destination, setDestination] = useState<GeoPoint | null>(null);

  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");

  // Google Maps Live GPS State
  const [userLiveLocation, setUserLiveLocation] = useState<GeoPoint | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [locationToast, setLocationToast] = useState<string | null>(null);

  const [vehicleType, setVehicleType] = useState<"CAR" | "VAN" | "TRUCK" | "BIKE" | "EV">("CAR");
  const [fuelType, setFuelType] = useState<"PETROL" | "DIESEL" | "ELECTRIC" | "CNG">("PETROL");
  const [optimizationMode, setOptimizationMode] = useState<
    "Fastest" | "Shortest" | "Cheapest" | "Fuel Efficient" | "Balanced" | "Fleet Optimized" | "EV Optimal"
  >("Balanced");

  const [routes, setRoutes] = useState<CandidateRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Dynamic Reroute Alert state
  const [rerouteAlert, setRerouteAlert] = useState<{
    available: boolean;
    reason: string;
    savedMin: number;
    alternativeLabel: string;
  } | null>(null);

  // VRP State
  const [deliveryStops, setDeliveryStops] = useState<StopItem[]>([]);
  const [vrpPolyline, setVrpPolyline] = useState<[number, number][]>([]);
  const [vrpDestination, setVrpDestination] = useState<GeoPoint | null>(null);

  // Modals & Drawers
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // 1. Automatically detect user live location on initial mount
  useEffect(() => {
    handleUseCurrentLocation();
  }, []);

  // 2. Re-calculate routes when vehicle type or optimization strategy changes (only if both origin & destination are set)
  useEffect(() => {
    if (origin && destination) {
      fetchRoutes(origin, destination);
    }
  }, [vehicleType, optimizationMode]);

  const fetchRoutes = async (orig = origin, dest = destination) => {
    if (!orig || !dest) {
      setRoutes([]);
      setSelectedRouteId(null);
      return;
    }
    setLoading(true);
    try {
      const res = await calculateRoutes({
        origin: orig,
        destination: dest,
        vehicle_type: vehicleType,
        fuel_type: vehicleType === "EV" ? "ELECTRIC" : fuelType,
        optimization_mode: optimizationMode,
      });
      setRoutes(res.routes);
      if (res.routes.length > 0) {
        setSelectedRouteId(res.best_route_id || res.routes[0].id);
      }
    } catch (e: any) {
      console.warn("Route calculation issue", e);
    } finally {
      setLoading(false);
    }
  };

  // 3. Google Maps Live GPS Location Handler
  const handleUseCurrentLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationToast("Geolocation is not supported by your browser");
      setTimeout(() => setLocationToast(null), 4000);
      return;
    }

    setIsLocatingUser(true);
    setLocationToast("Acquiring GPS fix for your live location...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setIsLocatingUser(false);

        // Reverse geocode to get clean address
        const addr = await reverseGeocode(lat, lng);
        const livePoint: GeoPoint = {
          lat,
          lng,
          address: addr,
          name: "Your Location",
        };

        setUserLiveLocation(livePoint);
        setOrigin(livePoint);
        setOriginQuery(addr ? addr.split(",")[0] : "Your Location");
        setLocationToast(`📍 Live location detected: ${addr || "Your Location"}. Choose a destination to view route.`);
        setTimeout(() => setLocationToast(null), 4500);

        // If destination is already set, recalculate routes
        if (destination) {
          fetchRoutes(livePoint, destination);
        }
      },
      (err) => {
        setIsLocatingUser(false);
        setLocationToast("Could not access GPS. Please allow location permissions or search an address.");
        setTimeout(() => setLocationToast(null), 5000);
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
    );
  };

  const swapLocations = () => {
    if (!origin && !destination) return;
    const tempPt = origin;
    const tempQ = originQuery;
    setOrigin(destination);
    setOriginQuery(destQuery);
    setDestination(tempPt);
    setDestQuery(tempQ);
    if (destination && tempPt) {
      fetchRoutes(destination, tempPt);
    }
  };

  // 4. Simulated Sudden Incident & Dynamic Rerouting trigger
  const triggerIncidentCheck = async () => {
    if (!origin || !destination) return;
    try {
      const res = await checkReroute(origin, destination);
      if (res.reroute_available) {
        setRerouteAlert({
          available: true,
          reason: res.incident_description,
          savedMin: res.time_saved_min,
          alternativeLabel: res.suggested_route_label,
        });
      }
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#e5e3df] text-[#202124] font-sans select-none">
      {/* ========================================================= */}
      {/* 1. Fullscreen Google Maps Canvas (Primary Backdrop) */}
      {/* ========================================================= */}
      <div className="absolute inset-0 w-full h-full z-0">
        <InteractiveMap
          origin={
            activeTab === "vrp"
              ? origin || userLiveLocation || { lat: 18.5204, lng: 73.8567, address: "Depot / Start" }
              : origin
          }
          destination={activeTab === "vrp" ? vrpDestination : destination}
          routes={activeTab === "vrp" ? [] : routes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={(id) => setSelectedRouteId(id)}
          deliveryStops={activeTab === "vrp" ? deliveryStops : []}
          optimizedPolyline={activeTab === "vrp" ? vrpPolyline : []}
          userLocation={userLiveLocation}
          onUserLocationFound={(livePt) => {
            setUserLiveLocation(livePt);
            if (!origin) {
              setOrigin(livePt);
              setOriginQuery(livePt.address || "Your Location");
            }
            setLocationToast(`GPS located: ${livePt.address || "Your Position"}`);
            setTimeout(() => setLocationToast(null), 3000);
          }}
          onMapClick={async (lat, lng) => {
            // Google Maps authentic click-to-place with instant reverse-geocoding
            setLocationToast("Resolving clicked location...");
            const resolvedAddr = await reverseGeocode(lat, lng);
            const clickedPoint: GeoPoint = {
              lat,
              lng,
              address: resolvedAddr,
              name: resolvedAddr.split(",")[0],
            };

            if (activeTab === "vrp") {
              const newStop: StopItem = {
                id: `stop-${Date.now()}`,
                address: resolvedAddr,
                lat,
                lng,
                package_weight_kg: 15.0,
                priority: 1,
              };
              setDeliveryStops((prev) => [...prev, newStop]);
              setLocationToast(`📍 Added Stop #${deliveryStops.length + 1}: ${clickedPoint.name}`);
              setTimeout(() => setLocationToast(null), 3500);
            } else {
              if (!origin) {
                setOrigin(clickedPoint);
                setOriginQuery(resolvedAddr);
                setLocationToast(`Starting point set: ${clickedPoint.name}`);
                setTimeout(() => setLocationToast(null), 3000);
              } else {
                setDestination(clickedPoint);
                setDestQuery(resolvedAddr);
                setLocationToast(`Destination set: ${clickedPoint.name}`);
                setTimeout(() => setLocationToast(null), 3000);
                fetchRoutes(origin, clickedPoint);
              }
            }
          }}
        />
      </div>

      {/* ========================================================= */}
      {/* 2. Top-Right Floating Controls (AI Assistant & Live Badge) */}
      {/* ========================================================= */}
      <div className="absolute top-4 right-4 z-[400] flex items-center gap-2">
        {/* Compare Routes Button */}
        {routes.length > 1 && (
          <button
            type="button"
            onClick={() => setIsMatrixOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/95 hover:bg-white text-[#3c4043] hover:text-[#1a73e8] rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.18)] border border-[#dadce0] text-xs font-semibold transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
          >
            <Layers className="w-3.5 h-3.5 text-[#1a73e8]" />
            <span>Compare {routes.length} Routes</span>
          </button>
        )}

        {/* Gemini AI Transportation Assistant */}
        <button
          type="button"
          onClick={() => setIsAssistantOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-[#202124] hover:text-[#1a73e8] rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.22)] border border-[#dadce0] text-xs font-bold transition-all hover:shadow-[0_4px_12px_rgba(26,115,232,0.25)]"
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#1a73e8] via-[#8ab4f8] to-[#9333ea] flex items-center justify-center text-white">
            <Sparkles className="w-3 h-3" />
          </div>
          <span>Gemini Assistant</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 3. Collapsed Pill Trigger (when sidebar is minimized) */}
      {/* ========================================================= */}
      {isPanelCollapsed && (
        <div
          onClick={() => setIsPanelCollapsed(false)}
          className="absolute top-4 left-4 z-[500] flex items-center gap-2.5 bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.25)] border border-[#dadce0] px-4 py-2.5 hover:shadow-[0_4px_14px_rgba(0,0,0,0.2)] transition-all cursor-pointer group"
          title="Open Directions Panel"
        >
          <div className="w-6 h-6 rounded-full bg-[#1a73e8] text-white flex items-center justify-center">
            <Navigation className="w-3.5 h-3.5 -rotate-45" />
          </div>
          <div className="text-xs">
            <span className="font-bold text-[#202124]">AeroRoute Maps</span>
            <span className="text-[#5f6368] ml-1.5 hidden sm:inline">
              {originQuery} → {destQuery}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#5f6368] group-hover:translate-x-0.5 transition-transform" />
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. Floating Google Maps Panel (Search, Directions, Tabs) */}
      {/* ========================================================= */}
      {!isPanelCollapsed && (
        <aside
          style={{ width: `${panelWidth}px`, maxWidth: "calc(100vw - 24px)" }}
          className="absolute top-3 left-3 z-[500] max-h-[calc(100vh-24px)] flex flex-col bg-white rounded-2xl shadow-[0_6px_24px_rgba(0,0,0,0.18),0_1px_3px_rgba(0,0,0,0.08)] border border-[#dadce0] overflow-hidden transition-all duration-75 select-none"
        >
          {/* Panel Top Brand & Controls Bar */}
          <div className="px-4 py-2.5 border-b border-[#dadce0] bg-[#ffffff] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1a73e8] text-white shadow-xs shrink-0">
                <Navigation className="w-4 h-4 -rotate-45" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-bold text-sm text-[#202124]">AeroRoute</span>
                  <span className="text-xs font-medium text-[#1a73e8]">Maps</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#ceead6]">
                    LIVE
                  </span>
                </div>
                <span className="text-[10px] text-[#70757a] block mt-0.5 truncate">
                  High-Precision OSRM & Multi-Factor Routing
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-2">
              {/* Width Preset Cycle Button */}
              <button
                type="button"
                onClick={() => {
                  if (panelWidth < 520) setPanelWidth(600);
                  else if (panelWidth < 680) setPanelWidth(760);
                  else setPanelWidth(440);
                }}
                className="px-2 py-1 rounded-lg text-[#5f6368] hover:text-[#1a73e8] hover:bg-[#e8f0fe] transition-colors text-[11px] font-semibold flex items-center gap-1 border border-transparent hover:border-[#d2e3fc]"
                title={`Current width: ${Math.round(panelWidth)}px. Click to cycle width presets (Compact / Standard / Wide)`}
              >
                <span>{panelWidth > 680 ? "Wide" : panelWidth > 520 ? "Medium" : "Compact"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPanelCollapsed(true)}
                className="p-1.5 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
                title="Collapse sidebar to view full map"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Edge Draggable Resize Handle */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
            className={`absolute top-0 right-0 bottom-0 w-3.5 cursor-ew-resize hover:bg-[#1a73e8]/20 transition-colors flex items-center justify-center group z-[550] ${
              isResizing ? "bg-[#1a73e8]/30" : ""
            }`}
            title="Drag right edge to resize panel width freely"
          >
            <div className="w-1 h-10 rounded-full bg-[#dadce0] group-hover:bg-[#1a73e8] transition-colors" />
          </div>

          {/* Google Category Navigation Chips */}
          <div className="px-3 py-2 border-b border-[#dadce0] bg-[#f8f9fa] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: "studio", label: "Routes", icon: Navigation },
              { id: "vrp", label: "Multi-Stop VRP", icon: Package },
              { id: "fleet", label: "Fleet Live", icon: Truck },
              { id: "ocr", label: "OCR Scan", icon: Scan },
              { id: "analytics", label: "Analytics", icon: TrendingUp },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-[#e8f0fe] text-[#1a73e8] border border-[#1a73e8]/40 shadow-xs"
                      : "bg-white text-[#3c4043] border border-[#dadce0] hover:bg-[#f1f3f4]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Panel Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
            {/* ========================================================= */}
            {/* TAB 1: Route Studio (Directions & Route Results) */}
            {/* ========================================================= */}
            {activeTab === "studio" && (
              <>
                {/* 1. Google Maps Travel Mode Selector */}
                <div className="flex items-center justify-around border-b border-[#dadce0] pb-2 text-xs">
                  {[
                    { id: "CAR", label: "Drive", icon: Car },
                    { id: "VAN", label: "Van", icon: Truck },
                    { id: "TRUCK", label: "Truck", icon: Truck },
                    { id: "BIKE", label: "Bike", icon: Bike },
                    { id: "EV", label: "EV", icon: BatteryCharging },
                  ].map((v) => {
                    const Icon = v.icon;
                    const isSelected = vehicleType === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setVehicleType(v.id as any);
                          if (v.id === "EV") setFuelType("ELECTRIC");
                          else if (v.id === "TRUCK" || v.id === "VAN") setFuelType("DIESEL");
                          else setFuelType("PETROL");
                        }}
                        className={`flex flex-col items-center py-1 px-3 relative transition-colors ${
                          isSelected
                            ? "text-[#1a73e8] font-bold"
                            : "text-[#5f6368] hover:text-[#202124]"
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-0.5" />
                        <span className="text-[11px]">{v.label}</span>
                        {/* Google Blue active underline */}
                        {isSelected && (
                          <span className="absolute bottom-[-9px] left-1 right-1 h-0.5 bg-[#1a73e8] rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>                {/* 2. Google Maps Directions Card (Origin & Destination with Autocomplete & Live Location) */}
                <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#dadce0] shadow-sm space-y-2.5 relative">
                  <div className="flex items-center gap-2">
                    {/* Left: Google Maps Dot & Pin Connector */}
                    <div className="flex flex-col items-center justify-center w-5 shrink-0 py-1.5">
                      <div className="w-3 h-3 rounded-full border-2 border-[#1a73e8] bg-white" />
                      <div className="w-0.5 h-10 border-l-2 border-dotted border-[#bdc1c6] my-0.5" />
                      <MapPin className="w-3.5 h-3.5 text-[#d93025]" />
                    </div>

                    {/* Middle: Google Autocomplete Inputs */}
                    <div className="flex-1 space-y-2 min-w-0">
                      <GooglePlaceAutocomplete
                        label="Origin"
                        placeholder="Choose starting point or 'Your location'..."
                        value={origin}
                        query={originQuery}
                        onQueryChange={(q) => setOriginQuery(q)}
                        onSelectPlace={(place) => {
                          setOrigin(place);
                          fetchRoutes(place, destination);
                        }}
                        onSelectCurrentLocation={handleUseCurrentLocation}
                        onSelectOnMap={() => {
                          setLocationToast("Click anywhere on the map to set starting point");
                          setTimeout(() => setLocationToast(null), 4000);
                        }}
                        isOrigin={true}
                        userLiveLocation={userLiveLocation}
                        isLocating={isLocatingUser}
                      />

                      <GooglePlaceAutocomplete
                        label="Destination"
                        placeholder="Choose destination or landmark..."
                        value={destination}
                        query={destQuery}
                        onQueryChange={(q) => setDestQuery(q)}
                        onSelectPlace={(place) => {
                          setDestination(place);
                          fetchRoutes(origin, place);
                        }}
                        onSelectOnMap={() => {
                          setLocationToast("Click anywhere on the map to set destination point");
                          setTimeout(() => setLocationToast(null), 4000);
                        }}
                        isOrigin={false}
                      />
                    </div>

                    {/* Right: Swap Locations Button */}
                    <button
                      type="button"
                      onClick={swapLocations}
                      className="p-2 rounded-full text-[#5f6368] hover:text-[#1a73e8] hover:bg-[#f1f3f4] border border-[#dadce0] transition-transform active:rotate-180 shrink-0"
                      title="Reverse origin and destination"
                    >
                      <ArrowUpDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Toast Notification under input card */}
                  {locationToast && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#1a73e8] bg-[#e8f0fe] px-2.5 py-1 rounded-lg animate-in fade-in duration-100">
                      <Sparkles className="w-3 h-3 shrink-0" />
                      <span className="truncate">{locationToast}</span>
                    </div>
                  )}
                </div>

                {/* 3. Optimization Mode Strategy Chips */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#5f6368] px-1">
                    <span>Routing Strategy</span>
                    <span className="text-[#1a73e8]">Dynamic Weights</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Balanced",
                      "Fastest",
                      "Cheapest",
                      "Fuel Efficient",
                      "Fleet Optimized",
                      "EV Optimal",
                    ].map((mode) => {
                      const isSelected = optimizationMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setOptimizationMode(mode as any)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                            isSelected
                              ? "bg-[#1a73e8] text-white border-[#1a73e8] shadow-xs"
                              : "bg-white text-[#3c4043] border-[#dadce0] hover:bg-[#f1f3f4]"
                          }`}
                        >
                          {mode}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Dynamic Reroute Alert Proposal Banner (if active) */}
                {rerouteAlert && (
                  <div className="p-3 rounded-2xl bg-[#fef7e0] border border-[#feefc3] text-xs space-y-2 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-1.5 font-bold text-[#b06000]">
                      <AlertTriangle className="w-4 h-4 text-[#ea8600]" /> Dynamic Reroute Recommended
                    </div>
                    <p className="text-[#3c4043] leading-relaxed">
                      {rerouteAlert.reason}. Faster detour ({rerouteAlert.alternativeLabel}) saves{" "}
                      <b className="text-[#188038]">{rerouteAlert.savedMin} minutes</b>.
                    </p>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setRerouteAlert(null)}
                        className="px-2.5 py-1 text-[#5f6368] text-[11px] hover:text-[#202124]"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          alert("Route diverted to recommended Bypass Expressway.");
                          setRerouteAlert(null);
                        }}
                        className="px-3 py-1 bg-[#ea8600] hover:bg-[#b06000] text-white font-bold rounded-lg text-[11px] shadow-xs"
                      >
                        Accept Reroute (Save {rerouteAlert.savedMin}m)
                      </button>
                    </div>
                  </div>
                )}

                {/* 5. Action Row: Compare Matrix & Incident Simulator */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMatrixOpen(true)}
                    disabled={routes.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-white hover:bg-[#f8f9fa] border border-[#dadce0] text-xs font-semibold text-[#3c4043] shadow-xs transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#1a73e8]" /> Compare All Routes
                  </button>
                  <button
                    type="button"
                    onClick={triggerIncidentCheck}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-[#f8f9fa] border border-[#dadce0] text-xs text-[#ea8600] hover:text-[#b06000] shadow-xs transition-colors"
                    title="Simulate Sudden Traffic Incident & Check Dynamic Reroute"
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </button>
                </div>

                {/* 6. Candidate Route Cards List */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-[#5f6368] px-1 font-medium">
                    <span>Ranked Routes</span>
                    <span>{routes.length} Options</span>
                  </div>

                  {loading ? (
                    <div className="p-8 text-center text-[#5f6368] text-xs flex flex-col items-center gap-2 bg-white rounded-2xl border border-[#dadce0]">
                      <div className="w-6 h-6 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin" />
                      <span>Evaluating routes across 9 multi-factor weights...</span>
                    </div>
                  ) : routes.length > 0 ? (
                    routes.map((route) => (
                      <RouteCard
                        key={route.id}
                        route={route}
                        isSelected={route.id === selectedRouteId}
                        onSelect={() => setSelectedRouteId(route.id)}
                      />
                    ))
                  ) : (
                    <div className="p-4 bg-white rounded-2xl border border-[#dadce0] shadow-xs space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#e8f0fe] flex items-center justify-center text-[#1a73e8] shrink-0 mt-0.5">
                          <Crosshair className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#202124]">
                            {origin ? "Live Starting Point Ready" : "Set Your Starting Point"}
                          </h4>
                          <p className="text-[11px] text-[#5f6368] mt-0.5 leading-relaxed">
                            {origin
                              ? "Type your destination above or click anywhere on the map to view intelligent routes from your live location."
                              : "Click the GPS icon or search your address to pinpoint starting location."}
                          </p>
                        </div>
                      </div>

                      {/* Quick Destination Presets */}
                      <div className="pt-2 border-t border-[#f1f3f4]">
                        <span className="text-[10px] font-bold text-[#70757a] uppercase tracking-wider block mb-1.5">
                          Suggested Destinations
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            {
                              name: "Airport (PNQ)",
                              lat: 18.5821,
                              lng: 73.9197,
                              addr: "Pune International Airport (PNQ), Lohegaon",
                            },
                            {
                              name: "Hinjawadi IT Park",
                              lat: 18.5913,
                              lng: 73.7389,
                              addr: "Hinjawadi Rajiv Gandhi Infotech Park, Pune",
                            },
                            {
                              name: "Railway Station",
                              lat: 18.5284,
                              lng: 73.8744,
                              addr: "Pune Railway Station, Somwar Peth",
                            },
                            {
                              name: "FC Road Hub",
                              lat: 18.5314,
                              lng: 73.8446,
                              addr: "Fergusson College Road, Shivajinagar",
                            },
                          ].map((item) => (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => {
                                const destPt: GeoPoint = {
                                  lat: item.lat,
                                  lng: item.lng,
                                  address: item.addr,
                                  name: item.name,
                                };
                                setDestination(destPt);
                                setDestQuery(item.name);
                                if (origin) {
                                  fetchRoutes(origin, destPt);
                                }
                              }}
                              className="px-2.5 py-1 bg-[#f8f9fa] hover:bg-[#e8f0fe] hover:text-[#1a73e8] border border-[#dadce0] rounded-full text-[11px] font-medium text-[#3c4043] transition-colors"
                            >
                              + {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB 2: Multi-Stop VRP */}
            {activeTab === "vrp" && (
              <MultiStopPlanner
                origin={
                  origin ||
                  userLiveLocation || {
                    lat: 18.5204,
                    lng: 73.8567,
                    address: "Pune Central Hub",
                  }
                }
                destination={vrpDestination}
                onOriginChange={(orig) => setOrigin(orig)}
                onDestinationChange={(dest) => setVrpDestination(dest)}
                stops={deliveryStops}
                onStopsChange={(newStops) => setDeliveryStops(newStops)}
                onPlanGenerated={(res: OptimizeStopsResponse) => {
                  setDeliveryStops(res.ordered_stops);
                  setVrpPolyline(res.polyline_coordinates);
                }}
                onClearPlan={() => {
                  setDeliveryStops([]);
                  setVrpPolyline([]);
                  setVrpDestination(null);
                }}
              />
            )}

            {/* TAB 3: Fleet & Telematics */}
            {activeTab === "fleet" && <FleetDashboardView />}

            {/* TAB 4: OCR Scanner */}
            {activeTab === "ocr" && (
              <OCRScannerView
                onLocationSelected={(pt) => {
                  setDestination(pt);
                  setDestQuery(pt.address || "");
                  setActiveTab("studio");
                  fetchRoutes(origin, pt);
                }}
              />
            )}

            {/* TAB 5: Commercial Analytics */}
            {activeTab === "analytics" && <AnalyticsDashboardView />}
          </div>
        </aside>
      )}

      {/* ========================================================= */}
      {/* 5. Floating Overlays & Modals */}
      {/* ========================================================= */}

      {/* Side-by-Side Comparison Matrix Modal */}
      <ComparisonMatrixModal
        routes={routes}
        isOpen={isMatrixOpen}
        onClose={() => setIsMatrixOpen(false)}
        onSelectRoute={(id) => setSelectedRouteId(id)}
      />

      {/* AI Transportation Assistant Drawer */}
      <AIAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onNavigateTab={(tab) => {
          if (["studio", "vrp", "fleet", "ocr", "analytics"].includes(tab)) {
            setActiveTab(tab as any);
          }
        }}
      />
    </div>
  );
}
