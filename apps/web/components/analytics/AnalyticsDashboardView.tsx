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

  // Google Brand Chart Colors
  const COLORS = ["#1a73e8", "#188038", "#f9ab00", "#ea4335"];

  if (!data) {
    return (
      <div className="p-8 text-center text-[#5f6368] text-xs">
        Loading commercial analytics indicators...
      </div>
    );
  }

  const { kpis, monthly_fuel_cost_trend, eta_error_distribution, strategy_adoption } = data;

  return (
    <div className="space-y-3.5">
      <div className="p-3.5 rounded-2xl bg-white border border-[#dadce0] shadow-sm">
        <h3 className="font-bold text-[#202124] text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#1a73e8]" /> Fleet Analytics & Cost Savings
        </h3>
        <p className="text-xs text-[#5f6368] mt-0.5">
          Audited metrics measuring fuel reduction, financial savings, and ETA model accuracy.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-2xl bg-white border border-[#dadce0] shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-[#5f6368] mb-1">
            <IndianRupee className="w-3.5 h-3.5 text-[#188038]" /> Total Cost Saved
          </div>
          <div className="text-lg font-bold text-[#188038]">₹{kpis.cost_saved_inr.toLocaleString()}</div>
          <div className="text-[10px] text-[#70757a] mt-0.5">Across {kpis.total_trips_completed} trips</div>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-[#dadce0] shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-[#5f6368] mb-1">
            <Fuel className="w-3.5 h-3.5 text-[#1a73e8]" /> Fuel Conserved
          </div>
          <div className="text-lg font-bold text-[#1a73e8]">{kpis.fuel_saved_litres} L</div>
          <div className="text-[10px] text-[#70757a] mt-0.5">Saved via eco-routing</div>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-[#dadce0] shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-[#5f6368] mb-1">
            <Leaf className="w-3.5 h-3.5 text-[#137333]" /> CO2 Offset
          </div>
          <div className="text-lg font-bold text-[#137333]">{kpis.co2_offset_kg} kg</div>
          <div className="text-[10px] text-[#70757a] mt-0.5">Carbon offset achieved</div>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-[#dadce0] shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-[#5f6368] mb-1">
            <Clock className="w-3.5 h-3.5 text-[#ea8600]" /> ETA ML Precision
          </div>
          <div className="text-lg font-bold text-[#ea8600]">±{kpis.avg_eta_prediction_error_min} min</div>
          <div className="text-[10px] text-[#70757a] mt-0.5">Avg model precision</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Monthly Cost Trend */}
        <div className="p-3.5 rounded-2xl bg-white border border-[#dadce0] shadow-xs">
          <h4 className="text-xs font-bold text-[#202124] mb-2.5">
            Monthly Fuel Costs: Standard vs Optimized (₹)
          </h4>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly_fuel_cost_trend}>
                <XAxis dataKey="month" stroke="#70757a" fontSize={11} />
                <YAxis stroke="#70757a" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderColor: "#dadce0", borderRadius: 8, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                />
                <Bar dataKey="standard_cost" name="Standard Cost" fill="#bdc1c6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="optimized_cost" name="Optimized Cost" fill="#1a73e8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Strategy Adoption Pie */}
        <div className="p-3.5 rounded-2xl bg-white border border-[#dadce0] shadow-xs">
          <h4 className="text-xs font-bold text-[#202124] mb-2.5">
            Optimization Strategy Utilization (%)
          </h4>
          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={strategy_adoption}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {strategy_adoption.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderColor: "#dadce0", borderRadius: 8, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", color: "#5f6368" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
