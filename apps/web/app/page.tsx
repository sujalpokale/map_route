"use client";

import React, { useState, useEffect } from "react";
import {
  GeoPoint,
  CandidateRoute,
  calculateRoutes,
  searchPlaces,
  checkReroute,
  OptimizeStopsResponse,
  StopItem,
} from "@/lib/api";
import InteractiveMap from "@/components/map/InteractiveMap";
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
} from "lucide-react";

export default function Home() {
  // Navigation tabs: studio | vrp | fleet | ocr | analytics
  const [activeTab, setActiveTab] = useState<"studio" | "vrp" | "fleet" | "ocr" | "analytics">("studio");

  // Route Studio State
  const [origin, setOrigin] = useState<GeoPoint>({
    lat: 18.5204,
    lng: 73.8567,
    address: "Pune Railway Station, Somwar Peth, Pune",
  });
  const [destination, setDestination] = useState<GeoPoint>({
    lat: 18.5913,
    lng: 73.7389,
    address: "Hinjawadi Rajiv Gandhi Infotech Park, Pune",
  });

  const [originQuery, setOriginQuery] = useState("Pune Railway Station");
  const [destQuery, setDestQuery] = useState("Hinjawadi Infotech Park");
  const [originSuggestions, setOriginSuggestions] = useState<GeoPoint[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<GeoPoint[]>([]);

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

  // Modals & Drawers
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // 1. Initial Route Calculation
  useEffect(() => {
    fetchRoutes();
  }, [vehicleType, optimizationMode]);

  const fetchRoutes = async (orig = origin, dest = destination) => {
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

  // 2. Search Autocomplete handlers
  const handleOriginSearch = async (val: string) => {
    setOriginQuery(val);
    if (val.trim().length > 2) {
      const places = await searchPlaces(val);
      setOriginSuggestions(places);
    } else {
      setOriginSuggestions([]);
    }
  };

  const handleDestSearch = async (val: string) => {
    setDestQuery(val);
    if (val.trim().length > 2) {
      const places = await searchPlaces(val);
      setDestSuggestions(places);
    } else {
      setDestSuggestions([]);
    }
  };

  const swapLocations = () => {
    const tempPt = origin;
    const tempQ = originQuery;
    setOrigin(destination);
    setOriginQuery(destQuery);
    setDestination(tempPt);
    setDestQuery(tempQ);
    fetchRoutes(destination, tempPt);
  };

  // 3. Simulated Sudden Incident & Dynamic Rerouting trigger
  const triggerIncidentCheck = async () => {
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#080c14] text-slate-100 font-sans">
      {/* ========================================================= */}
      {/* 1. Header Navigation Bar */}
      {/* ========================================================= */}
      <header className="h-14 border-b border-white/10 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between z-[500] shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-emerald-400 p-[1.5px] shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Navigation className="w-4 h-4 text-cyan-400 -rotate-45" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-sm text-slate-100">
                AERO<span className="text-cyan-400">ROUTE</span>
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                PRO 2.0
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block -mt-0.5">Route Intelligence Platform</span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10 text-xs">
          {[
            { id: "studio", label: "Route Studio", icon: Navigation },
            { id: "vrp", label: "Multi-Stop VRP", icon: Package },
            { id: "fleet", label: "Fleet & Telematics", icon: Truck },
            { id: "ocr", label: "OCR Scanner", icon: Scan },
            { id: "analytics", label: "Analytics", icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  isActive
                    ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {/* Live Engine Status Badge */}
          <div className="hidden lg:flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">Backend: Live | OSRM + Open-Meteo</span>
          </div>

          {/* AI Assistant Button */}
          <button
            onClick={() => setIsAssistantOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:opacity-90 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all"
          >
            <Bot className="w-4 h-4 text-slate-950" />
            <span>AI Assistant</span>
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. Main Workspace Split View */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Control Panel / Sidebar */}
        <aside className="w-full md:w-[460px] lg:w-[490px] h-full flex flex-col border-r border-white/10 bg-slate-950/70 backdrop-blur-xl shrink-0 z-10 overflow-y-auto">
          {/* TAB 1: Route Studio */}
          {activeTab === "studio" && (
            <div className="p-4 space-y-4">
              {/* Origin / Destination Search Card */}
              <div className="p-4 rounded-2xl glass-panel border border-white/10 space-y-3 relative">
                {/* Origin Input */}
                <div className="relative">
                  <label className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Origin (Start)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={originQuery}
                      onChange={(e) => handleOriginSearch(e.target.value)}
                      placeholder="Search pickup or departure location..."
                      className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
                  </div>

                  {/* Origin Autocomplete Suggestions */}
                  {originSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden divide-y divide-white/5">
                      {originSuggestions.map((place, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setOrigin(place);
                            setOriginQuery(place.address || "");
                            setOriginSuggestions([]);
                            fetchRoutes(place, destination);
                          }}
                          className="w-full p-2 text-left text-xs text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors line-clamp-1"
                        >
                          {place.address}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Swap Button */}
                <div className="flex items-center justify-center -my-1">
                  <button
                    type="button"
                    onClick={swapLocations}
                    className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-transform active:rotate-180"
                    title="Swap locations"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
                  </button>
                </div>

                {/* Destination Input */}
                <div className="relative">
                  <label className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-rose-400" /> Destination (Dropoff)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={destQuery}
                      onChange={(e) => handleDestSearch(e.target.value)}
                      placeholder="Search destination or customer address..."
                      className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
                  </div>

                  {/* Destination Autocomplete Suggestions */}
                  {destSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden divide-y divide-white/5">
                      {destSuggestions.map((place, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setDestination(place);
                            setDestQuery(place.address || "");
                            setDestSuggestions([]);
                            fetchRoutes(origin, place);
                          }}
                          className="w-full p-2 text-left text-xs text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors line-clamp-1"
                        >
                          {place.address}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Vehicle Selector */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Vehicle Profile</span>
                  <span className="text-[10px] text-slate-400">Physics & Drag Calibrated</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: "CAR", label: "Car", icon: Car },
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
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs transition-all ${
                          isSelected
                            ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-300 font-bold"
                            : "bg-slate-900/80 border-white/5 text-slate-400 hover:bg-slate-800"
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-1" />
                        <span className="text-[11px]">{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optimization Mode Strategy Pills */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Optimization Strategy</span>
                  <span className="text-[10px] text-cyan-400 font-mono">Dynamic Weights</span>
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
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          isSelected
                            ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 border-cyan-400 font-bold shadow-md shadow-cyan-500/20"
                            : "bg-slate-900/80 text-slate-300 border-white/10 hover:border-white/20"
                        }`}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Reroute Alert Proposal Banner (if active) */}
              {rerouteAlert && (
                <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs space-y-2 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Dynamic Reroute Alert
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {rerouteAlert.reason}. A faster bypass route ({rerouteAlert.alternativeLabel}) saves{" "}
                    <b className="text-amber-300">{rerouteAlert.savedMin} minutes</b>.
                  </p>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setRerouteAlert(null)}
                      className="px-2.5 py-1 text-slate-400 text-[11px] hover:text-slate-200"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        alert("Route diverted to Bypass Expressway.");
                        setRerouteAlert(null);
                      }}
                      className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-[11px]"
                    >
                      Accept Reroute (Save {rerouteAlert.savedMin}m)
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons: Compare Matrix & Incident Simulator */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMatrixOpen(true)}
                  disabled={routes.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" /> Compare All Routes
                </button>
                <button
                  type="button"
                  onClick={triggerIncidentCheck}
                  className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  title="Simulate Traffic Incident & Check Dynamic Rerouting"
                >
                  <AlertTriangle className="w-4 h-4" />
                </button>
              </div>

              {/* Candidate Route Cards List */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Candidate Routes Ranked by IRS</span>
                  <span>{routes.length} Alternatives</span>
                </div>

                {loading ? (
                  <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    <span>Evaluating candidates across 9 dimensions...</span>
                  </div>
                ) : (
                  routes.map((route) => (
                    <RouteCard
                      key={route.id}
                      route={route}
                      isSelected={route.id === selectedRouteId}
                      onSelect={() => setSelectedRouteId(route.id)}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Multi-Stop VRP */}
          {activeTab === "vrp" && (
            <div className="p-4">
              <MultiStopPlanner
                origin={origin}
                onPlanGenerated={(res: OptimizeStopsResponse) => {
                  setDeliveryStops(res.ordered_stops);
                  setVrpPolyline(res.polyline_coordinates);
                }}
              />
            </div>
          )}

          {/* TAB 3: Fleet & Telematics */}
          {activeTab === "fleet" && (
            <div className="p-4">
              <FleetDashboardView />
            </div>
          )}

          {/* TAB 4: OCR Scanner */}
          {activeTab === "ocr" && (
            <div className="p-4">
              <OCRScannerView
                onLocationSelected={(pt) => {
                  setDestination(pt);
                  setDestQuery(pt.address || "");
                  setActiveTab("studio");
                  fetchRoutes(origin, pt);
                }}
              />
            </div>
          )}

          {/* TAB 5: Commercial Analytics */}
          {activeTab === "analytics" && (
            <div className="p-4">
              <AnalyticsDashboardView />
            </div>
          )}
        </aside>

        {/* Right Canvas: Interactive Leaflet Map */}
        <main className="flex-1 h-full relative">
          <InteractiveMap
            origin={origin}
            destination={destination}
            routes={routes}
            selectedRouteId={selectedRouteId}
            onSelectRoute={(id) => setSelectedRouteId(id)}
            deliveryStops={activeTab === "vrp" ? deliveryStops : []}
            optimizedPolyline={activeTab === "vrp" ? vrpPolyline : []}
            onMapClick={(lat, lng) => {
              // Click map to set destination
              const newDest: GeoPoint = {
                lat,
                lng,
                address: `Target (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
              };
              setDestination(newDest);
              setDestQuery(newDest.address || "");
              fetchRoutes(origin, newDest);
            }}
          />
        </main>
      </div>

      {/* ========================================================= */}
      {/* 3. Floating Overlays & Modals */}
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
