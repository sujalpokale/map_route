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
    <div className="space-y-3.5">
      {/* Top Header Card */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-[#dadce0] shadow-sm">
        <div>
          <h3 className="font-bold text-[#202124] text-sm flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#1a73e8]" /> Fleet & Driver Telematics
          </h3>
          <p className="text-xs text-[#5f6368] mt-0.5">
            Real-time tracking of vehicle payloads, battery state, and live positions.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="p-2 rounded-xl bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] border border-[#dadce0] transition-colors"
          title="Refresh Fleet"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#1a73e8]" : ""}`} />
        </button>
      </div>

      {/* Fleet Vehicles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
        {vehicles.map((v) => {
          const payloadPct = Math.round((v.current_payload_kg / v.max_payload_kg) * 100);
          const isEnRoute = v.status === "EN_ROUTE";

          return (
            <div
              key={v.id}
              className="p-3.5 rounded-2xl bg-white border border-[#dadce0] hover:border-[#bdc1c6] shadow-xs space-y-2.5 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[#202124] text-sm">{v.name}</h4>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]">
                      {v.license_plate}
                    </span>
                  </div>
                  <div className="text-xs text-[#5f6368] flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1">
                      <Fuel className="w-3 h-3 text-[#1a73e8]" /> {v.fuel_type}
                    </span>
                    <span>•</span>
                    <span>{v.fuel_efficiency} {v.fuel_type === "ELECTRIC" ? "km/kWh" : "km/L"}</span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isEnRoute
                      ? "bg-[#e6f4ea] text-[#137333] border-[#ceead6]"
                      : "bg-[#f1f3f4] text-[#5f6368] border-[#dadce0]"
                  }`}
                >
                  {isEnRoute ? "● EN ROUTE" : "AVAILABLE"}
                </span>
              </div>

              {/* Telemetry Row */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#f8f9fa] p-2 rounded-xl border border-[#e8eaed]">
                  <div className="text-[#5f6368] flex items-center gap-1.5 text-[11px]">
                    <Gauge className="w-3 h-3 text-[#1a73e8]" /> Live Speed
                  </div>
                  <div className="text-sm font-bold text-[#202124] mt-0.5">{v.current_speed_kmh} km/h</div>
                </div>

                <div className="bg-[#f8f9fa] p-2 rounded-xl border border-[#e8eaed]">
                  <div className="text-[#5f6368] flex items-center gap-1.5 text-[11px]">
                    <UserCheck className="w-3 h-3 text-[#188038]" /> Driver
                  </div>
                  <div className="text-sm font-semibold text-[#202124] mt-0.5 truncate">{v.driver_name}</div>
                </div>
              </div>

              {/* Payload Progress Bar */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-[#5f6368] text-[11px]">
                  <span className="flex items-center gap-1">
                    <Weight className="w-3 h-3" /> Payload
                  </span>
                  <span className="font-semibold text-[#202124]">
                    {v.current_payload_kg} / {v.max_payload_kg} kg ({payloadPct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#f1f3f4] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      payloadPct > 85 ? "bg-[#d93025]" : payloadPct > 60 ? "bg-[#ea8600]" : "bg-[#1a73e8]"
                    }`}
                    style={{ width: `${payloadPct}%` }}
                  />
                </div>
              </div>

              {/* EV Battery Bar if Electric */}
              {v.fuel_type === "ELECTRIC" && v.current_battery_pct !== undefined && (
                <div className="space-y-1 text-xs pt-0.5">
                  <div className="flex justify-between text-[#5f6368] text-[11px]">
                    <span className="flex items-center gap-1 text-[#188038]">
                      <BatteryCharging className="w-3 h-3" /> Battery State (SOC)
                    </span>
                    <span className="font-bold text-[#188038]">{v.current_battery_pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#f1f3f4] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#188038] rounded-full"
                      style={{ width: `${v.current_battery_pct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Location Tag */}
              <div className="text-[11px] text-[#5f6368] flex items-center gap-1 pt-0.5">
                <MapPin className="w-3 h-3 text-[#d93025]" /> Sector: <span className="text-[#202124] font-medium">{v.location.name}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
