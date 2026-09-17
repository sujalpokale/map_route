"use client";

import React, { useState, useEffect } from "react";
import { FleetVehicle, fetchFleetVehicles } from "@/lib/api";
import {
  Truck,
  BatteryCharging,
  Gauge,
  ShieldCheck,
  UserCheck,
  MapPin,
  RefreshCw,
  Fuel,
  Weight,
} from "lucide-react";

export default function FleetDashboardView() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchFleetVehicles();
      setVehicles(data);
    } catch (e) {
      console.warn("Failed to load fleet data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-2xl glass-panel border border-white/10">
        <div>
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Truck className="w-4 h-4 text-cyan-400" /> Commercial Fleet & Driver Telematics
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time tracking of vehicle payloads, battery states, driver assignments, and live speeds.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Fleet Vehicles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vehicles.map((v) => {
          const payloadPct = Math.round((v.current_payload_kg / v.max_payload_kg) * 100);
          const isEnRoute = v.status === "EN_ROUTE";

          return (
            <div
              key={v.id}
              className="glass-panel-hover p-4 rounded-2xl border border-white/10 space-y-3 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-100 text-sm">{v.name}</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-white/5">
                      {v.license_plate}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1">
                      <Fuel className="w-3 h-3 text-cyan-400" /> {v.fuel_type}
                    </span>
                    <span>•</span>
                    <span>{v.fuel_efficiency} {v.fuel_type === "ELECTRIC" ? "km/kWh" : "km/L"}</span>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                    isEnRoute
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse"
                      : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                  }`}
                >
                  {isEnRoute ? "● EN ROUTE" : "AVAILABLE"}
                </span>
              </div>

              {/* Telemetry Row */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/70 p-2.5 rounded-xl border border-white/5">
                  <div className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" /> Live Speed
                  </div>
                  <div className="text-sm font-bold text-slate-100 mt-1">{v.current_speed_kmh} km/h</div>
                </div>

                <div className="bg-slate-900/70 p-2.5 rounded-xl border border-white/5">
                  <div className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Driver Assigned
                  </div>
                  <div className="text-sm font-semibold text-slate-100 mt-1">{v.driver_name}</div>
                </div>
              </div>

              {/* Payload Progress Bar */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-300 text-[11px]">
                  <span className="flex items-center gap-1">
                    <Weight className="w-3 h-3 text-slate-400" /> Payload Capacity
                  </span>
                  <span className="font-semibold">
                    {v.current_payload_kg} / {v.max_payload_kg} kg ({payloadPct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      payloadPct > 85 ? "bg-rose-500" : payloadPct > 60 ? "bg-amber-500" : "bg-cyan-500"
                    }`}
                    style={{ width: `${payloadPct}%` }}
                  />
                </div>
              </div>

              {/* EV Battery Bar if Electric */}
              {v.fuel_type === "ELECTRIC" && v.current_battery_pct !== undefined && (
                <div className="space-y-1 text-xs pt-1">
                  <div className="flex justify-between text-slate-300 text-[11px]">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <BatteryCharging className="w-3.5 h-3.5" /> State of Charge (SOC)
                    </span>
                    <span className="font-bold text-emerald-300">{v.current_battery_pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: `${v.current_battery_pct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Location Tag */}
              <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1">
                <MapPin className="w-3 h-3 text-cyan-400" /> Current Sector: <span className="text-slate-200">{v.location.name}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
