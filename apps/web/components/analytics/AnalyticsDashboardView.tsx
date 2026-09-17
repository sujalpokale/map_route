"use client";

import React, { useState, useEffect } from "react";
import { fetchAnalytics, AnalyticsDashboard } from "@/lib/api";
import {
  TrendingUp,
  Fuel,
  IndianRupee,
  Clock,
  Leaf,
  Award,
  CheckCircle2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function AnalyticsDashboardView() {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch((e) => console.warn("Analytics error", e));
  }, []);

  const COLORS = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b"];

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs">
        Loading commercial analytics indicators...
      </div>
    );
  }

  const { kpis, monthly_fuel_cost_trend, eta_error_distribution, strategy_adoption } = data;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl glass-panel border border-white/10">
        <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" /> Commercial Analytics & Cost Savings
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Audited metrics measuring fuel reduction, financial savings, and ETA model accuracy.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-400" /> Total Cost Saved
          </div>
          <div className="text-lg font-black text-emerald-300">₹{kpis.cost_saved_inr.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 mt-1">Across {kpis.total_trips_completed} trips</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
            <Fuel className="w-3.5 h-3.5 text-cyan-400" /> Fuel Conserved
          </div>
          <div className="text-lg font-black text-cyan-300">{kpis.fuel_saved_litres} L</div>
          <div className="text-[10px] text-slate-500 mt-1">Saved via eco-routing</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
            <Leaf className="w-3.5 h-3.5 text-teal-400" /> CO2 Offset
          </div>
          <div className="text-lg font-black text-teal-300">{kpis.co2_offset_kg} kg</div>
          <div className="text-[10px] text-slate-500 mt-1">Carbon offset achieved</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> ETA ML Precision
          </div>
          <div className="text-lg font-black text-amber-300">±{kpis.avg_eta_prediction_error_min} min</div>
          <div className="text-[10px] text-slate-500 mt-1">Avg model prediction error</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly Cost Trend */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10">
          <h4 className="text-xs font-bold text-slate-200 mb-3">
            Monthly Fuel Costs: Standard vs Route-Intelligence Optimized (₹)
          </h4>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly_fuel_cost_trend}>
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="standard_cost" name="Standard Cost" fill="#475569" radius={[4, 4, 0, 0]} />
                <Bar dataKey="optimized_cost" name="Optimized Cost" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Strategy Adoption Pie */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10">
          <h4 className="text-xs font-bold text-slate-200 mb-3">
            Optimization Strategy Utilization (% Distribution)
          </h4>
          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={strategy_adoption}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {strategy_adoption.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
