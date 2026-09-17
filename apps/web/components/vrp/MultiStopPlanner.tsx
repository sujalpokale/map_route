"use client";

import React, { useState } from "react";
import { GeoPoint, StopItem, OptimizeStopsResponse, optimizeStops } from "@/lib/api";
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
} from "lucide-react";

interface MultiStopPlannerProps {
  origin: GeoPoint;
  onPlanGenerated: (res: OptimizeStopsResponse) => void;
}

export default function MultiStopPlanner({ origin, onPlanGenerated }: MultiStopPlannerProps) {
  const [stops, setStops] = useState<StopItem[]>([
    {
      id: "stop-1",
      address: "Hinjawadi Phase 1, Infotech Park, Pune",
      lat: 18.5913,
      lng: 73.7389,
      package_weight_kg: 25.0,
      priority: 2,
      time_window_start: "10:00",
      time_window_end: "12:00",
    },
    {
      id: "stop-2",
      address: "Shivajinagar Commercial Complex, Pune",
      lat: 18.5314,
      lng: 73.8446,
      package_weight_kg: 80.0,
      priority: 3, // Urgent
      time_window_start: "11:00",
      time_window_end: "13:00",
    },
    {
      id: "stop-3",
      address: "Hadapsar Magarpatta City, Pune",
      lat: 18.5089,
      lng: 73.9260,
      package_weight_kg: 45.0,
      priority: 1,
      time_window_start: "14:00",
      time_window_end: "16:00",
    },
    {
      id: "stop-4",
      address: "Kothrud Industrial Area, Pune",
      lat: 18.5074,
      lng: 73.8077,
      package_weight_kg: 15.0,
      priority: 1,
      time_window_start: "15:00",
      time_window_end: "17:00",
    },
  ]);

  const [newAddress, setNewAddress] = useState("");
  const [newWeight, setNewWeight] = useState("20");
  const [newPriority, setNewPriority] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<OptimizeStopsResponse | null>(null);

  const handleAddStop = () => {
    if (!newAddress.trim()) return;
    const item: StopItem = {
      id: `stop-${Date.now()}`,
      address: newAddress.trim(),
      lat: origin.lat + (Math.random() - 0.5) * 0.08,
      lng: origin.lng + (Math.random() - 0.5) * 0.08,
      package_weight_kg: parseFloat(newWeight) || 10.0,
      priority: newPriority,
    };
    setStops([...stops, item]);
    setNewAddress("");
  };

  const handleRemoveStop = (id: string) => {
    setStops(stops.filter((s) => s.id !== id));
  };

  const handleRunOptimization = async () => {
    if (stops.length === 0 || loading) return;
    setLoading(true);
    try {
      const res = await optimizeStops({
        origin: origin,
        stops: stops,
        vehicle_type: "VAN",
      });
      setLastResponse(res);
      onPlanGenerated(res);
    } catch (e: any) {
      alert(`Optimization failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="p-4 rounded-2xl glass-panel border border-white/10 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-cyan-400" /> Multi-Stop Delivery Sequencer (VRP)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            2-Opt Heuristic sequencing accounting for payloads, priority, and route efficiency.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRunOptimization}
          disabled={loading || stops.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 disabled:opacity-40 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all"
        >
          <Sparkles className="w-4 h-4" />
          {loading ? "Optimizing Tour..." : "Solve Delivery Route"}
        </button>
      </div>

      {/* Result Metrics if solved */}
      {lastResponse && (
        <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-center animate-in fade-in duration-300">
          <div>
            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <Navigation className="w-3 h-3 text-cyan-400" /> Optimized Tour
            </div>
            <div className="text-base font-bold text-slate-100 mt-0.5">{lastResponse.total_distance_km} km</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-emerald-400" /> Total Duration
            </div>
            <div className="text-base font-bold text-slate-100 mt-0.5">{lastResponse.estimated_duration_min} min</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <Weight className="w-3 h-3 text-amber-400" /> Payload
            </div>
            <div className="text-base font-bold text-slate-100 mt-0.5">{lastResponse.total_payload_kg} kg</div>
          </div>
        </div>
      )}

      {/* Add Stop Input Row */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2.5">
        <div className="text-xs font-semibold text-slate-300">Add New Destination Stop</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddStop()}
            placeholder="Enter customer delivery address or hub name..."
            className="flex-1 bg-slate-800/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <input
            type="number"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            placeholder="kg"
            className="w-20 bg-slate-800/80 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-slate-100 text-center focus:outline-none focus:border-cyan-500"
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(parseInt(e.target.value))}
            className="bg-slate-800/80 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none"
          >
            <option value={1}>Normal</option>
            <option value={2}>High</option>
            <option value={3}>⚡ Urgent</option>
          </select>
          <button
            type="button"
            onClick={handleAddStop}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* Stops List */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {stops.map((stop, idx) => (
          <div
            key={stop.id}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5 hover:border-white/15 transition-all text-xs"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-slate-800 text-cyan-400 font-bold flex items-center justify-center text-xs shrink-0">
                {idx + 1}
              </span>
              <div>
                <div className="font-medium text-slate-200">{stop.address}</div>
                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>{stop.package_weight_kg} kg</span>
                  <span>•</span>
                  {stop.priority === 3 ? (
                    <span className="text-rose-400 font-semibold">⚡ Urgent Priority</span>
                  ) : (
                    <span>Priority {stop.priority}</span>
                  )}
                  {stop.time_window_start && (
                    <>
                      <span>•</span>
                      <span>Window: {stop.time_window_start} - {stop.time_window_end}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleRemoveStop(stop.id)}
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
