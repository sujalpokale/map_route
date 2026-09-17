"use client";

import React, { useState } from "react";
import { parseOCR, GeoPoint, OCRParseResponse } from "@/lib/api";
import {
  FileText,
  Scan,
  MapPin,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  UploadCloud,
  FileSpreadsheet,
} from "lucide-react";

interface OCRScannerViewProps {
  onLocationSelected: (point: GeoPoint) => void;
}

export default function OCRScannerView({ onLocationSelected }: OCRScannerViewProps) {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OCRParseResponse | null>(null);

  const sampleSlips = [
    {
      title: "Pune Logistics Hub Label",
      text: "TO: Global Tech Logistics, Plot 32, Rajiv Gandhi Infotech Park, Phase 2, Hinjawadi, Pune, Maharashtra 411057. Tel: +91 98220 12345.",
    },
    {
      title: "Commercial Freight Waybill",
      text: "Consignee: Somwar Peth Freight Depot, Near Pune Railway Station, Pune 411001. Package: 420 kg Auto Components. Invoice #PUN-9821.",
    },
    {
      title: "GPS Waypoint Coordinates",
      text: "Delivery drop coordinates: 18.5089, 73.9260 (Hadapsar Mega Hub Gate 3). Contact driver on arrival.",
    },
  ];

  const handleParse = async (textToParse?: string) => {
    const text = textToParse || rawText;
    if (!text.trim() || loading) return;

    setLoading(true);
    try {
      const res = await parseOCR(text);
      setResult(res);
    } catch (e: any) {
      alert(`OCR extraction failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl glass-panel border border-white/10">
        <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
          <Scan className="w-4 h-4 text-cyan-400" /> Computer Vision & OCR Location Parser
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Ingest unstructured invoices, delivery receipts, or map screenshots to automatically parse and geocode addresses into routes.
        </p>
      </div>

      {/* Preset Delivery Slips */}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-slate-300">Try Pre-Loaded Delivery Invoices:</div>
        <div className="grid grid-cols-3 gap-2">
          {sampleSlips.map((slip, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setRawText(slip.text);
                handleParse(slip.text);
              }}
              className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-white/10 text-left transition-all group"
            >
              <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" /> {slip.title}
              </div>
              <div className="text-[11px] text-slate-500 line-clamp-1 mt-1">{slip.text}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Text / Upload Dropzone */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
        <div className="text-xs font-medium text-slate-300">Paste Delivery Text or Receipt Content:</div>
        <textarea
          rows={3}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste shipping receipt text, OCR label, or coordinates..."
          className="w-full bg-slate-800/80 border border-white/10 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => handleParse()}
            disabled={!rawText.trim() || loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Scan className="w-3.5 h-3.5" />
            {loading ? "Extracting & Geocoding..." : "Extract & Geocode Location"}
          </button>
        </div>
      </div>

      {/* Extracted Results Card */}
      {result && result.locations.length > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Location Extracted Successfully ({result.processing_time_ms}ms)
            </span>
            <span className="text-[11px] text-emerald-300 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
              Confidence: {Math.round(result.locations[0].confidence_score * 100)}%
            </span>
          </div>

          <div className="bg-slate-900/90 rounded-xl p-3 border border-white/5 space-y-1.5 text-xs">
            <div className="text-slate-400 text-[11px]">Normalized Verified Address:</div>
            <div className="font-semibold text-slate-100 flex items-start gap-1.5">
              <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>{result.locations[0].cleaned_address}</span>
            </div>

            {result.locations[0].pincode && (
              <div className="text-[11px] text-slate-400 pt-1">
                Detected Postal PIN: <span className="font-mono text-cyan-300">{result.locations[0].pincode}</span>
              </div>
            )}
          </div>

          {result.locations[0].geocoded_point && (
            <button
              type="button"
              onClick={() => onLocationSelected(result.locations[0].geocoded_point!)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all"
            >
              Set as Trip Destination & Plot Route <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
