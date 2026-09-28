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
      title: "Logistics Hub Label",
      text: "TO: Global Tech Logistics, Plot 32, Rajiv Gandhi Infotech Park, Phase 2, Hinjawadi, Pune, Maharashtra 411057. Tel: +91 98220 12345.",
    },
    {
      title: "Freight Waybill",
      text: "Consignee: Somwar Peth Freight Depot, Near Pune Railway Station, Pune 411001. Package: 420 kg Auto Components. Invoice #PUN-9821.",
    },
    {
      title: "GPS Waypoint",
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
    <div className="space-y-3.5">
      <div className="p-3.5 rounded-2xl bg-white border border-[#dadce0] shadow-sm">
        <h3 className="font-bold text-[#202124] text-sm flex items-center gap-2">
          <Scan className="w-4 h-4 text-[#1a73e8]" /> Google Lens & OCR Location Parser
        </h3>
        <p className="text-xs text-[#5f6368] mt-1">
          Extract addresses, postal pins, or GPS coordinates from invoices and text to plot instant Google Maps routes.
        </p>
      </div>

      {/* Preset Delivery Slips */}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-[#5f6368]">Sample Delivery Slips:</div>
        <div className="grid grid-cols-3 gap-2">
          {sampleSlips.map((slip, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setRawText(slip.text);
                handleParse(slip.text);
              }}
              className="p-2.5 rounded-xl bg-white hover:bg-[#f8f9fa] border border-[#dadce0] hover:border-[#1a73e8] text-left transition-all shadow-xs group"
            >
              <div className="text-xs font-semibold text-[#202124] group-hover:text-[#1a73e8] transition-colors flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#1a73e8]" /> {slip.title}
              </div>
              <div className="text-[11px] text-[#70757a] line-clamp-1 mt-1">{slip.text}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Text / Upload Dropzone */}
      <div className="p-3.5 rounded-2xl bg-white border border-[#dadce0] shadow-sm space-y-2.5">
        <div className="text-xs font-medium text-[#202124]">Paste Receipt / Address Text:</div>
        <textarea
          rows={3}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste shipping label, invoice text, or address coordinates..."
          className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl p-3 text-xs text-[#202124] placeholder-[#80868b] focus:outline-none focus:border-[#1a73e8] focus:bg-white resize-none"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => handleParse()}
            disabled={!rawText.trim() || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all"
          >
            <Scan className="w-3.5 h-3.5" />
            {loading ? "Parsing Location..." : "Extract & Geocode"}
          </button>
        </div>
      </div>

      {/* Extracted Results Card */}
      {result && result.locations.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-[#e6f4ea] border border-[#ceead6] space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#137333] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#188038]" /> Location Extracted ({result.processing_time_ms}ms)
            </span>
            <span className="text-[11px] text-[#137333] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#ceead6]">
              Confidence: {Math.round(result.locations[0].confidence_score * 100)}%
            </span>
          </div>

          <div className="bg-white rounded-xl p-3 border border-[#ceead6] space-y-1 text-xs">
            <div className="text-[#5f6368] text-[11px]">Normalized Address:</div>
            <div className="font-semibold text-[#202124] flex items-start gap-1.5">
              <MapPin className="w-4 h-4 text-[#d93025] shrink-0 mt-0.5" />
              <span>{result.locations[0].cleaned_address}</span>
            </div>

            {result.locations[0].pincode && (
              <div className="text-[11px] text-[#5f6368] pt-1">
                PIN: <span className="font-mono text-[#1a73e8] font-bold">{result.locations[0].pincode}</span>
              </div>
            )}
          </div>

          {result.locations[0].geocoded_point && (
            <button
              type="button"
              onClick={() => onLocationSelected(result.locations[0].geocoded_point!)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#188038] hover:bg-[#137333] text-white font-bold text-xs shadow-sm transition-all"
            >
              Set as Destination & Navigate <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
