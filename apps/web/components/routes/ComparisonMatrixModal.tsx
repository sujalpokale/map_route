"use client";

import React from "react";
import { CandidateRoute } from "@/lib/api";
import { X, Check, Award, ArrowRight } from "lucide-react";

interface ComparisonMatrixModalProps {
  routes: CandidateRoute[];
  isOpen: boolean;
  onClose: () => void;
  onSelectRoute: (id: string) => void;
}

export default function ComparisonMatrixModal({
  routes,
  isOpen,
  onClose,
  onSelectRoute,
}: ComparisonMatrixModalProps) {
  if (!isOpen || routes.length === 0) return null;

  // Identify best values for highlighting
  const minTime = Math.min(...routes.map((r) => r.duration_min));
  const minCost = Math.min(...routes.map((r) => r.total_cost_inr));
  const minFuel = Math.min(...routes.map((r) => r.fuel_litres));
  const maxScore = Math.max(...routes.map((r) => r.overall_score));

  const rows = [
    {
      metric: "Overall Score",
      getValue: (r: CandidateRoute) => `${Math.round(r.overall_score)}/100`,
      isBest: (r: CandidateRoute) => r.overall_score === maxScore,
      unit: "pts",
    },
    {
      metric: "Travel Duration",
      getValue: (r: CandidateRoute) => `${r.duration_min} min`,
      isBest: (r: CandidateRoute) => r.duration_min === minTime,
      unit: "min",
    },
    {
      metric: "Total Distance",
      getValue: (r: CandidateRoute) => `${r.distance_km} km`,
      isBest: (r: CandidateRoute) => r.distance_km === Math.min(...routes.map((x) => x.distance_km)),
      unit: "km",
    },
    {
      metric: "Estimated Fuel",
      getValue: (r: CandidateRoute) => `${r.fuel_litres} L`,
      isBest: (r: CandidateRoute) => r.fuel_litres === minFuel,
      unit: "L",
    },
    {
      metric: "Fuel Cost",
      getValue: (r: CandidateRoute) => `₹${Math.round(r.fuel_cost_inr)}`,
      isBest: (r: CandidateRoute) => r.fuel_cost_inr === Math.min(...routes.map((x) => x.fuel_cost_inr)),
      unit: "₹",
    },
    {
      metric: "Toll Charges",
      getValue: (r: CandidateRoute) => `₹${Math.round(r.toll_cost_inr)}`,
      isBest: (r: CandidateRoute) => r.toll_cost_inr === 0,
      unit: "₹",
    },
    {
      metric: "Driver Time Cost",
      getValue: (r: CandidateRoute) => `₹${Math.round(r.driver_cost_inr)}`,
      isBest: (r: CandidateRoute) => r.driver_cost_inr === Math.min(...routes.map((x) => x.driver_cost_inr)),
      unit: "₹",
    },
    {
      metric: "Vehicle Maintenance",
      getValue: (r: CandidateRoute) => `₹${Math.round(r.maintenance_cost_inr)}`,
      isBest: (r: CandidateRoute) => r.maintenance_cost_inr === Math.min(...routes.map((x) => x.maintenance_cost_inr)),
      unit: "₹",
    },
    {
      metric: "Total Route Economic Cost",
      getValue: (r: CandidateRoute) => `₹${Math.round(r.total_cost_inr)}`,
      isBest: (r: CandidateRoute) => r.total_cost_inr === minCost,
      unit: "₹",
    },
    {
      metric: "Traffic Congestion",
      getValue: (r: CandidateRoute) => r.traffic_level,
      isBest: (r: CandidateRoute) => r.traffic_level === "Low",
      unit: "",
    },
    {
      metric: "Road Surface Condition",
      getValue: (r: CandidateRoute) => r.road_quality,
      isBest: (r: CandidateRoute) => r.road_quality === "Good",
      unit: "",
    },
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white border border-[#dadce0] rounded-3xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#dadce0] bg-[#f8f9fa]">
          <div>
            <h3 className="text-base font-bold text-[#202124] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#1a73e8]" /> Multi-Route Comparison Matrix
            </h3>
            <p className="text-xs text-[#5f6368] mt-0.5">
              Side-by-side comparative analysis across physical, economic, and safety metrics.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#e8eaed] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Table */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#dadce0]">
                <th className="py-3 px-4 text-xs font-bold text-[#5f6368] uppercase tracking-wider">Metric</th>
                {routes.map((r) => (
                  <th key={r.id} className="py-3 px-4 text-sm font-semibold text-[#202124] text-center min-w-[150px]">
                    <div className="flex flex-col items-center">
                      <span>{r.label}</span>
                      {r.is_recommended && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#ceead6] mt-1">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f4] text-sm">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#f8f9fa] transition-colors">
                  <td className="py-2.5 px-4 font-medium text-[#3c4043] text-xs">{row.metric}</td>
                  {routes.map((r) => {
                    const isOptimal = row.isBest(r);
                    return (
                      <td key={r.id} className="py-2.5 px-4 text-center">
                        <div
                          className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            isOptimal
                              ? "bg-[#e6f4ea] text-[#137333] border border-[#ceead6]"
                              : "text-[#5f6368]"
                          }`}
                        >
                          {row.getValue(r)}
                          {isOptimal && <Check className="w-3.5 h-3.5 ml-1 text-[#188038]" />}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#dadce0] bg-[#f8f9fa]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5f6368] hover:bg-[#e8eaed] transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              if (routes.length > 0) {
                const best = routes.find((r) => r.is_recommended) || routes[0];
                onSelectRoute(best.id);
                onClose();
              }
            }}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-[#1a73e8] hover:bg-[#1557b0] text-white transition-colors shadow-sm"
          >
            Apply Recommended Route <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
