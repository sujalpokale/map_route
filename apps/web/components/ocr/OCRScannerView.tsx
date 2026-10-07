"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { parseOCR, GeoPoint, OCRParseResponse } from "@/lib/api";
import {
  FileText,
  Scan,
  MapPin,
  CheckCircle2,
  ArrowRight,
  UploadCloud,
  Camera,
  X,
  AlertTriangle,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";

interface OCRScannerViewProps {
  onLocationSelected: (point: GeoPoint) => void;
}

type InputMode = "text" | "upload" | "camera";

const sampleSlips = [
  {
    title: "Logistics Hub",
    text: "TO: Global Tech Logistics, Plot 32, Rajiv Gandhi Infotech Park, Phase 2, Hinjawadi, Pune, Maharashtra 411057.",
  },
  {
    title: "Freight Waybill",
    text: "Consignee: Somwar Peth Freight Depot, Near Pune Railway Station, Pune 411001. Package: 420 kg Auto Components.",
  },
  {
    title: "GPS Waypoint",
    text: "Delivery drop: 18.5089, 73.9260 (Hadapsar Mega Hub Gate 3). Contact driver on arrival.",
  },
];

/** Resize + JPEG-compress an image to a base64 string (no prefix). */
async function compressImageToBase64(file: Blob, maxDim = 1400, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        // Strip "data:image/jpeg;base64," prefix
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OCRScannerView({ onLocationSelected }: OCRScannerViewProps) {
  const [mode, setMode] = useState<InputMode>("text");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OCRParseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera stream on unmount or mode change
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (mode !== "camera") stopCamera();
  }, [mode, stopCamera]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      const msg =
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access in your browser settings."
          : err?.name === "NotFoundError"
          ? "No camera found on this device."
          : `Camera error: ${err?.message ?? err}`;
      setCameraError(msg);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !cameraActive) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreviewUrl(dataUrl);
    setImageBase64(dataUrl.split(",")[1]);
    stopCamera();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const b64 = await compressImageToBase64(file);
      const preview = `data:image/jpeg;base64,${b64}`;
      setPreviewUrl(preview);
      setImageBase64(b64);
    } catch {
      setError("Failed to read the selected image file.");
    }
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const resetImage = () => {
    setPreviewUrl(null);
    setImageBase64(null);
    setResult(null);
    setError(null);
  };

  const handleParse = async (overrideText?: string, overrideImage?: string) => {
    const text = overrideText ?? (mode === "text" ? rawText : "");
    const img = overrideImage ?? (mode !== "text" ? imageBase64 ?? undefined : undefined);

    if (!text.trim() && !img) return;
    if (loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await parseOCR(text || undefined, img || undefined);
      if (res.status === "no_text_detected") {
        setError("No readable text found in the image. Try a clearer photo with visible text.");
      } else {
        setResult(res);
      }
    } catch (e: any) {
      setError(`OCR extraction failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    (mode === "text" && rawText.trim().length > 0) ||
    (mode !== "text" && imageBase64 !== null);

  return (
    <div className="space-y-3.5">
      {/* Header */}
      <div className="p-3.5 rounded-2xl bg-white border border-[#dadce0] shadow-sm">
        <h3 className="font-bold text-[#202124] text-sm flex items-center gap-2">
          <Scan className="w-4 h-4 text-[#1a73e8]" /> OCR Location Parser
        </h3>
        <p className="text-xs text-[#5f6368] mt-1">
          Extract addresses or GPS coordinates from delivery slips, invoices, or camera photos.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="flex gap-1.5 p-1 bg-[#f1f3f4] rounded-xl">
        {(["text", "upload", "camera"] as InputMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setResult(null); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              mode === m
                ? "bg-white text-[#1a73e8] shadow-sm border border-[#dadce0]"
                : "text-[#5f6368] hover:text-[#202124]"
            }`}
          >
            {m === "text" && <FileText className="w-3.5 h-3.5" />}
            {m === "upload" && <UploadCloud className="w-3.5 h-3.5" />}
            {m === "camera" && <Camera className="w-3.5 h-3.5" />}
            {m === "text" ? "Text" : m === "upload" ? "Upload" : "Camera"}
          </button>
        ))}
      </div>

      {/* ── TEXT MODE ── */}
      {mode === "text" && (
        <>
          {/* Sample slips */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-[#5f6368]">Sample Delivery Slips:</div>
            <div className="grid grid-cols-3 gap-2">
              {sampleSlips.map((slip, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setRawText(slip.text); handleParse(slip.text); }}
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
                {loading ? "Parsing…" : "Extract & Geocode"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── UPLOAD MODE ── */}
      {mode === "upload" && (
        <div className="p-3.5 rounded-2xl bg-white border border-[#dadce0] shadow-sm space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {!previewUrl ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-[#dadce0] hover:border-[#1a73e8] bg-[#f8f9fa] hover:bg-[#e8f0fe] transition-all group"
            >
              <UploadCloud className="w-8 h-8 text-[#9aa0a6] group-hover:text-[#1a73e8] transition-colors" />
              <div className="text-xs font-semibold text-[#5f6368] group-hover:text-[#1a73e8] transition-colors">
                Click to upload an image
              </div>
              <div className="text-[11px] text-[#9aa0a6]">JPG, PNG, HEIC, WebP supported</div>
            </button>
          ) : (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full max-h-48 object-contain rounded-xl border border-[#dadce0] bg-[#f8f9fa]"
              />
              <button
                type="button"
                onClick={resetImage}
                className="absolute top-2 right-2 p-1 rounded-full bg-white border border-[#dadce0] hover:bg-[#f8f9fa] shadow-sm"
                title="Remove image"
              >
                <X className="w-3.5 h-3.5 text-[#5f6368]" />
              </button>
            </div>
          )}

          <div className="flex gap-2">
            {previewUrl && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#dadce0] hover:border-[#1a73e8] text-xs font-semibold text-[#5f6368] hover:text-[#1a73e8] transition-all"
              >
                <RefreshCw className="w-3 h-3" /> Change
              </button>
            )}
            <button
              type="button"
              onClick={() => handleParse()}
              disabled={!canSubmit || loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {loading ? "Running OCR…" : "Scan Image for Address"}
            </button>
          </div>
        </div>
      )}

      {/* ── CAMERA MODE ── */}
      {mode === "camera" && (
        <div className="p-3.5 rounded-2xl bg-white border border-[#dadce0] shadow-sm space-y-3">
          {cameraError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#fce8e6] border border-[#f28b82] text-xs text-[#c5221f]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {cameraError}
            </div>
          )}

          {!previewUrl ? (
            <>
              {/* Video preview */}
              <div className={`relative rounded-xl overflow-hidden bg-[#202124] aspect-video ${cameraActive ? "block" : "hidden"}`}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover"
                />
                {/* Viewfinder overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-6 border-2 border-white/40 rounded-xl" />
                  <div className="absolute top-8 left-8 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl-sm" />
                  <div className="absolute top-8 right-8 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr-sm" />
                  <div className="absolute bottom-8 left-8 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl-sm" />
                  <div className="absolute bottom-8 right-8 w-5 h-5 border-b-2 border-r-2 border-white rounded-br-sm" />
                </div>
              </div>

              {!cameraActive && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-[#dadce0] hover:border-[#1a73e8] bg-[#f8f9fa] hover:bg-[#e8f0fe] transition-all group"
                >
                  <Camera className="w-8 h-8 text-[#9aa0a6] group-hover:text-[#1a73e8] transition-colors" />
                  <div className="text-xs font-semibold text-[#5f6368] group-hover:text-[#1a73e8] transition-colors">
                    Tap to open camera
                  </div>
                  <div className="text-[11px] text-[#9aa0a6]">Point at a delivery slip or address label</div>
                </button>
              )}

              {cameraActive && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-2 rounded-xl border border-[#dadce0] hover:bg-[#f8f9fa] text-xs font-semibold text-[#5f6368] transition-all flex items-center gap-1.5"
                  >
                    <X className="w-3 h-3" /> Stop
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-xs shadow-sm transition-all"
                  >
                    <Camera className="w-4 h-4" /> Capture Photo
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Captured"
                  className="w-full max-h-52 object-contain rounded-xl border border-[#dadce0] bg-[#f8f9fa]"
                />
                <button
                  type="button"
                  onClick={() => { resetImage(); startCamera(); }}
                  className="absolute top-2 right-2 p-1 rounded-full bg-white border border-[#dadce0] hover:bg-[#f8f9fa] shadow-sm"
                  title="Retake photo"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#5f6368]" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleParse()}
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all"
              >
                <Scan className="w-3.5 h-3.5" />
                {loading ? "Running OCR…" : "Scan Captured Photo"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="p-3 rounded-2xl bg-[#e8f0fe] border border-[#c5d8f7] flex items-center gap-2.5 animate-pulse">
          <Scan className="w-4 h-4 text-[#1a73e8] animate-spin" />
          <span className="text-xs font-semibold text-[#1a73e8]">
            Sending to OCR engine and geocoding…
          </span>
        </div>
      )}

      {/* Error Banner */}
      {error && !loading && (
        <div className="p-3 rounded-2xl bg-[#fce8e6] border border-[#f28b82] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#c5221f] shrink-0 mt-0.5" />
          <p className="text-xs text-[#c5221f] font-medium">{error}</p>
        </div>
      )}

      {/* Results Card */}
      {result && result.locations.length > 0 && !loading && (
        <div className="p-3.5 rounded-2xl bg-[#e6f4ea] border border-[#ceead6] space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#137333] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#188038]" /> Location Extracted ({result.processing_time_ms}ms)
            </span>
            <span className="text-[11px] text-[#137333] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#ceead6]">
              {Math.round(result.locations[0].confidence_score * 100)}% confidence
            </span>
          </div>

          <div className="bg-white rounded-xl p-3 border border-[#ceead6] space-y-1.5 text-xs">
            <div className="text-[#5f6368] text-[11px]">Normalized Address:</div>
            <div className="font-semibold text-[#202124] flex items-start gap-1.5">
              <MapPin className="w-4 h-4 text-[#d93025] shrink-0 mt-0.5" />
              <span>{result.locations[0].cleaned_address}</span>
            </div>
            {result.locations[0].pincode && (
              <div className="text-[11px] text-[#5f6368]">
                PIN: <span className="font-mono text-[#1a73e8] font-bold">{result.locations[0].pincode}</span>
              </div>
            )}
            {result.locations[0].raw_extracted_text && (
              <details className="mt-1">
                <summary className="text-[11px] text-[#9aa0a6] cursor-pointer hover:text-[#5f6368]">
                  Raw OCR text
                </summary>
                <p className="text-[11px] text-[#5f6368] mt-1 whitespace-pre-wrap break-words">
                  {result.locations[0].raw_extracted_text}
                </p>
              </details>
            )}
          </div>

          {result.locations[0].geocoded_point && (
            <button
              type="button"
              onClick={() => onLocationSelected(result.locations[0].geocoded_point!)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#188038] hover:bg-[#137333] text-white font-bold text-xs shadow-sm transition-all"
            >
              Set as Destination &amp; Navigate <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
