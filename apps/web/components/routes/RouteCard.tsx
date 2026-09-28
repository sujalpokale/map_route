"use client";

import React, { useState } from "react";
import { CandidateRoute } from "@/lib/api";
import {
  Clock,
  Navigation,
  Fuel,
  IndianRupee,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CloudSun,
  Layers,
  Sparkles,
  ArrowRight,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
} from "lucide-react";

interface RouteCardProps {
  route: CandidateRoute;
  isSelected: boolean;
  onSelect: () => void;
}

export default function RouteCard({ route, isSelected, onSelect }: RouteCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  // Google Maps traffic styling
  const getTrafficColor = (level: string) => {
    switch (level) {
      case "Low":
        return "text-[#188038]"; // Google Green
      case "Moderate":
        return "text-[#e37400]"; // Google Orange/Amber
      case "High":
        return "text-[#d93025]"; // Google Red
      case "Severe":
        return "text-[#b31412]"; // Deep Red
      default:
        return "text-[#188038]";
    }
  };

  const getTrafficBadge = (level: string) => {
    switch (level) {
      case "Low":
        return "bg-[#e6f4ea] text-[#137333] border-[#ceead6]";
      case "Moderate":
        return "bg-[#fef7e0] text-[#b06000] border-[#feefc3]";
      case "High":
        return "bg-[#fce8e6] text-[#c5221f] border-[#fad2cf]";
      case "Severe":
        return "bg-[#fce8e6] text-[#a50e0e] border-[#fad2cf]";
      default:
        return "bg-[#f1f3f4] text-[#3c4043] border-[#dadce0]";
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-2xl p-4 transition-all duration-200 border ${
        isSelected
          ? "bg-[#f1f6fd] border-[#1a73e8] shadow-[0_2px_8px_rgba(26,115,232,0.2)] ring-1 ring-[#1a73e8]"
          : "bg-white border-[#dadce0] hover:bg-[#f8f9fa] hover:border-[#bdc1c6] shadow-sm"
      }`}
    >
      {/* Top Header: Duration, Distance, and Recommended Tag */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            {/* Big Google Maps Duration */}
            <span className={`text-2xl font-bold tracking-tight ${getTrafficColor(route.traffic_level)}`}>
              {route.duration_min} min
            </span>
            <span className="text-sm font-medium text-[#5f6368]">
              ({route.distance_km} km)
            </span>
          </div>

          {/* Road / Route Name */}
          <div className="text-sm font-semibold text-[#202124] truncate mt-0.5">
            via {route.label}
          </div>

          {/* Traffic info & ETA */}
          <div className="flex items-center gap-2 mt-1 text-xs text-[#5f6368]">
            <span className={`inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full border text-[11px] ${getTrafficBadge(route.traffic_level)}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${route.traffic_level === "Low" ? "bg-[#188038]" : route.traffic_level === "Moderate" ? "bg-[#e37400]" : "bg-[#d93025]"}`} />
              {route.traffic_level} Traffic
            </span>
            <span>•</span>
            <span>ETA {route.eta_iso}</span>
          </div>
        </div>

        {/* Score Pill & Recommended Tag */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {route.is_recommended && (
            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#ceead6]">
              <Sparkles className="w-3 h-3 text-[#188038]" /> FASTEST
            </span>
          )}
          <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg bg-white border border-[#dadce0] text-[#202124] shadow-xs">
            <span className="text-[10px] text-[#70757a] font-normal uppercase">IRS</span>
            <span className="text-[#1a73e8]">{Math.round(route.overall_score)}</span>
            <span className="text-[10px] text-[#70757a]">/100</span>
          </div>
        </div>
      </div>

      {/* Metrics Row (Fuel, Cost, Weather) */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#e8eaed] text-xs">
        <div className="bg-white/80 rounded-xl p-2 border border-[#e8eaed] flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#fef7e0] flex items-center justify-center shrink-0">
            <Fuel className="w-3.5 h-3.5 text-[#b06000]" />
          </div>
          <div>
            <div className="text-[10px] text-[#70757a]">Est. Fuel</div>
            <div className="font-bold text-[#202124]">{route.fuel_litres} L</div>
          </div>
        </div>

        <div className="bg-white/80 rounded-xl p-2 border border-[#e8eaed] flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#e8f0fe] flex items-center justify-center shrink-0">
            <IndianRupee className="w-3.5 h-3.5 text-[#1a73e8]" />
          </div>
          <div>
            <div className="text-[10px] text-[#70757a]">Total Cost</div>
            <div className="font-bold text-[#202124]">₹{Math.round(route.total_cost_inr)}</div>
          </div>
        </div>

        <div className="bg-white/80 rounded-xl p-2 border border-[#e8eaed] flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#f1f3f4] flex items-center justify-center shrink-0">
            <CloudSun className="w-3.5 h-3.5 text-[#5f6368]" />
          </div>
          <div>
            <div className="text-[10px] text-[#70757a]">Weather</div>
            <div className="font-bold text-[#202124] truncate">{route.weather_condition}</div>
          </div>
        </div>
      </div>

      {/* AI Decision Explanation Banner (Google Maps smart insight) */}
      {route.recommendation_reason && (
        <div className="mt-2.5 p-2 rounded-xl bg-[#e8f0fe] border border-[#d2e3fc] text-xs text-[#174ea6] flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#1a73e8] shrink-0 mt-0.5" />
          <span className="leading-snug">{route.recommendation_reason}</span>
        </div>
      )}

      {/* Accordion Action Buttons */}
      <div className="flex items-center justify-between mt-3 pt-2 text-xs font-semibold text-[#5f6368]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowDetails(!showDetails);
          }}
          className="hover:text-[#1a73e8] flex items-center gap-1 transition-colors py-1 px-1.5 rounded-md hover:bg-black/5"
        >
          <Layers className="w-3.5 h-3.5" />
          {showDetails ? "Hide Score Breakdown" : "Score Breakdown"}
          {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {route.steps && route.steps.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowSteps(!showSteps);
            }}
            className="hover:text-[#1a73e8] flex items-center gap-1 transition-colors py-1 px-1.5 rounded-md hover:bg-black/5"
          >
            <Navigation className="w-3.5 h-3.5" />
            {showSteps ? "Hide Directions" : `Directions (${route.steps.length})`}
            {showSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expanded Sub-Scores Bar Visualizer */}
      {showDetails && (
        <div className="mt-2.5 p-3 rounded-xl bg-white border border-[#dadce0] space-y-2 text-xs">
          <div className="text-[11px] font-bold uppercase text-[#5f6368] tracking-wider mb-1.5">
            9-Factor Intelligent Sub-Scores (0 - 100)
          </div>

          {[
            { label: "Travel Time", score: route.sub_scores.time_score, color: "bg-[#1a73e8]" },
            { label: "Fuel Efficiency", score: route.sub_scores.fuel_score, color: "bg-[#188038]" },
            { label: "Total Economic Cost", score: route.sub_scores.cost_score, color: "bg-[#8430ce]" },
            { label: "Traffic Congestion", score: route.sub_scores.traffic_score, color: "bg-[#f9ab00]" },
            { label: "Distance Factor", score: route.sub_scores.distance_score, color: "bg-[#1a73e8]" },
            { label: "Weather Safety", score: route.sub_scores.weather_score, color: "bg-[#ea8600]" },
            { label: "Road Surface Quality", score: route.sub_scores.road_condition_score, color: "bg-[#5f6368]" },
            { label: "Driver Safety", score: route.sub_scores.safety_score, color: "bg-[#137333]" },
          ].map((item, idx) => (
            <div key={idx} className="space-y-0.5">
              <div className="flex justify-between text-[11px] text-[#3c4043]">
                <span>{item.label}</span>
                <span className="font-semibold">{Math.round(item.score)}</span>
              </div>
              <div className="w-full h-1.5 bg-[#f1f3f4] rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-full transition-all duration-300`}
                  style={{ width: `${item.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expanded Turn-by-Turn Guidance (Google Maps Directions Style) */}
      {showSteps && route.steps && (
        <div className="mt-2.5 p-3 rounded-xl bg-white border border-[#dadce0] max-h-56 overflow-y-auto space-y-2.5 text-xs">
          <div className="text-[11px] font-bold uppercase text-[#5f6368] tracking-wider pb-1 border-b border-[#e8eaed]">
            Turn-by-Turn Route Guidance
          </div>
          {route.steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-[#202124] pb-2 border-b border-[#f1f3f4] last:border-0">
              <div className="w-6 h-6 rounded-full bg-[#f1f3f4] text-[#1a73e8] font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium text-[#202124]">{step.instruction}</div>
                <div className="text-[11px] text-[#5f6368] mt-0.5">
                  {(step.distance_m / 1000).toFixed(1)} km • ~{Math.round(step.duration_s / 60)} min
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
