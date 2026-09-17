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
} from "lucide-react";

interface RouteCardProps {
  route: CandidateRoute;
  isSelected: boolean;
  onSelect: () => void;
}

export default function RouteCard({ route, isSelected, onSelect }: RouteCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  // Score color gradient
  const getScoreColor = (score: number) => {
    if (score >= 88) return "text-emerald-400 border-emerald-500/40 bg-emerald-950/40";
    if (score >= 75) return "text-cyan-400 border-cyan-500/40 bg-cyan-950/40";
    if (score >= 60) return "text-amber-400 border-amber-500/40 bg-amber-950/40";
    return "text-rose-400 border-rose-500/40 bg-rose-950/40";
  };

  const getTrafficBadge = (level: string) => {
    switch (level) {
      case "Low":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "Moderate":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "High":
        return "bg-orange-500/20 text-orange-300 border-orange-500/30";
      case "Severe":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-2xl p-4 transition-all duration-300 border ${
        isSelected
          ? "glass-panel border-cyan-500/70 shadow-[0_0_25px_rgba(6,182,212,0.18)] ring-1 ring-cyan-400/50"
          : "glass-panel-hover border-white/10 hover:border-white/20"
      }`}
    >
      {/* Top Header: Label, Recommended Tag, and Score */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-slate-100 text-base">{route.label}</h4>
            {route.is_recommended && (
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                <Sparkles className="w-3 h-3 text-cyan-300" /> RECOMMENDED
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
            <span>ETA {route.eta_iso}</span>
            <span>•</span>
            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${getTrafficBadge(route.traffic_level)}`}>
              {route.traffic_level} Traffic
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-300">
              <CloudSun className="w-3 h-3 text-amber-400" /> {route.weather_condition}
            </span>
          </div>
        </div>

        {/* Circular Score Badge */}
        <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border ${getScoreColor(route.overall_score)}`}>
          <span className="text-xl font-black leading-none">{Math.round(route.overall_score)}</span>
          <span className="text-[10px] tracking-wider uppercase font-semibold opacity-80 mt-0.5">Score</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/5 text-center">
        <div className="bg-slate-900/60 rounded-xl p-2">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-0.5">
            <Clock className="w-3 h-3 text-cyan-400" /> Time
          </div>
          <div className="text-sm font-bold text-slate-200">{route.duration_min}m</div>
        </div>

        <div className="bg-slate-900/60 rounded-xl p-2">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-0.5">
            <Navigation className="w-3 h-3 text-emerald-400" /> Distance
          </div>
          <div className="text-sm font-bold text-slate-200">{route.distance_km} km</div>
        </div>

        <div className="bg-slate-900/60 rounded-xl p-2">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-0.5">
            <Fuel className="w-3 h-3 text-amber-400" /> Fuel
          </div>
          <div className="text-sm font-bold text-slate-200">{route.fuel_litres} L</div>
        </div>

        <div className="bg-slate-900/60 rounded-xl p-2">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-0.5">
            <IndianRupee className="w-3 h-3 text-violet-400" /> Total
          </div>
          <div className="text-sm font-bold text-slate-200">₹{Math.round(route.total_cost_inr)}</div>
        </div>
      </div>

      {/* AI Decision Explanation Banner */}
      {route.recommendation_reason && (
        <div className="mt-3 p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-200/90 leading-relaxed flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>{route.recommendation_reason}</span>
        </div>
      )}

      {/* Accordion Controls for Breakdown & Steps */}
      <div className="flex items-center justify-between mt-3 pt-2 text-xs text-slate-400 font-medium">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowDetails(!showDetails);
          }}
          className="hover:text-cyan-300 flex items-center gap-1 transition-colors"
        >
          <Layers className="w-3.5 h-3.5" />
          {showDetails ? "Hide Sub-Scores" : "Score Breakdown"}
          {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {route.steps && route.steps.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowSteps(!showSteps);
            }}
            className="hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            {showSteps ? "Hide Directions" : `Directions (${route.steps.length})`}
            {showSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expanded Sub-Scores Bar Visualizer */}
      {showDetails && (
        <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-white/5 space-y-2 text-xs">
          <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider mb-2">
            9-Factor Intelligent Sub-Scores (0 - 100)
          </div>

          {[
            { label: "Travel Time", score: route.sub_scores.time_score, color: "bg-cyan-500" },
            { label: "Fuel Efficiency", score: route.sub_scores.fuel_score, color: "bg-emerald-500" },
            { label: "Total Economic Cost", score: route.sub_scores.cost_score, color: "bg-violet-500" },
            { label: "Traffic Congestion", score: route.sub_scores.traffic_score, color: "bg-amber-500" },
            { label: "Distance", score: route.sub_scores.distance_score, color: "bg-blue-500" },
            { label: "Weather Safety", score: route.sub_scores.weather_score, color: "bg-yellow-500" },
            { label: "Road Surface", score: route.sub_scores.road_condition_score, color: "bg-indigo-500" },
            { label: "Overall Safety", score: route.sub_scores.safety_score, color: "bg-teal-500" },
          ].map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>{item.label}</span>
                <span className="font-semibold">{Math.round(item.score)}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-full transition-all duration-500`}
                  style={{ width: `${item.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Turn-by-Turn Steps List */}
      {showSteps && route.steps && (
        <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-white/5 max-h-56 overflow-y-auto space-y-2 text-xs">
          <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider mb-2">
            Turn-by-Turn Guidance
          </div>
          {route.steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2 text-slate-300 pb-2 border-b border-white/5 last:border-0">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-cyan-400 font-bold flex items-center justify-center text-[10px] shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1">
                <div>{step.instruction}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
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
