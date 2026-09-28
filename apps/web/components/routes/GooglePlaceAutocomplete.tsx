"use client";

import React, { useState, useEffect, useRef } from "react";
import { GeoPoint, searchPlaces } from "@/lib/api";
import {
  MapPin,
  Crosshair,
  Search,
  X,
  Navigation,
  Building2,
  Train,
  Plane,
  Clock,
  Compass,
  Check,
  Loader2,
} from "lucide-react";

interface GooglePlaceAutocompleteProps {
  label: string;
  placeholder: string;
  value: GeoPoint | null;
  query: string;
  onQueryChange: (query: string) => void;
  onSelectPlace: (place: GeoPoint) => void;
  onSelectCurrentLocation?: () => void;
  onSelectOnMap?: () => void;
  isOrigin?: boolean;
  userLiveLocation?: GeoPoint | null;
  isLocating?: boolean;
}

const POPULAR_PRESETS: { name: string; subtitle: string; point: GeoPoint; type: "train" | "airport" | "it" | "city" }[] = [
  {
    name: "Pune Railway Station",
    subtitle: "Somwar Peth, Pune, Maharashtra",
    point: {
      lat: 18.5284,
      lng: 73.8744,
      address: "Pune Railway Station, Somwar Peth, Pune, Maharashtra",
      name: "Pune Railway Station",
      city: "Pune",
    },
    type: "train",
  },
  {
    name: "Hinjawadi Rajiv Gandhi Infotech Park",
    subtitle: "Phase 1, Hinjawadi, Pune, Maharashtra",
    point: {
      lat: 18.5913,
      lng: 73.7389,
      address: "Hinjawadi Rajiv Gandhi Infotech Park, Pune, Maharashtra",
      name: "Hinjawadi IT Park",
      city: "Pune",
    },
    type: "it",
  },
  {
    name: "Pune International Airport (PNQ)",
    subtitle: "Lohegaon, Pune, Maharashtra",
    point: {
      lat: 18.5821,
      lng: 73.9197,
      address: "Pune International Airport (PNQ), Lohegaon, Pune, Maharashtra",
      name: "Pune Airport",
      city: "Pune",
    },
    type: "airport",
  },
  {
    name: "Mumbai CST Terminus",
    subtitle: "Fort, Mumbai, Maharashtra",
    point: {
      lat: 18.9401,
      lng: 72.8354,
      address: "Chhatrapati Shivaji Maharaj Terminus (CSMT), Fort, Mumbai",
      name: "CSMT Mumbai",
      city: "Mumbai",
    },
    type: "train",
  },
  {
    name: "Kempegowda International Airport (BLR)",
    subtitle: "Devanahalli, Bengaluru, Karnataka",
    point: {
      lat: 13.1986,
      lng: 77.7066,
      address: "Kempegowda International Airport (BLR), Bengaluru, Karnataka",
      name: "Kempegowda Airport",
      city: "Bengaluru",
    },
    type: "airport",
  },
];

export default function GooglePlaceAutocomplete({
  label,
  placeholder,
  value,
  query,
  onQueryChange,
  onSelectPlace,
  onSelectCurrentLocation,
  onSelectOnMap,
  isOrigin = false,
  userLiveLocation = null,
  isLocating = false,
}: GooglePlaceAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Debounced search places handler
  const handleInputChange = (text: string) => {
    onQueryChange(text);
    setIsOpen(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (text.trim().length >= 2) {
      setIsLoading(true);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const results = await searchPlaces(text);
          setSuggestions(results);
        } catch (e) {
          console.warn("Geocode search error", e);
        } finally {
          setIsLoading(false);
        }
      }, 250);
    } else {
      setSuggestions([]);
      setIsLoading(false);
    }
  };

  const handleSelect = (place: GeoPoint) => {
    onSelectPlace(place);
    onQueryChange(place.name || place.address || "");
    setIsOpen(false);
  };

  const getPresetIcon = (type: string) => {
    switch (type) {
      case "train":
        return <Train className="w-3.5 h-3.5 text-[#1a73e8]" />;
      case "airport":
        return <Plane className="w-3.5 h-3.5 text-[#188038]" />;
      case "it":
        return <Building2 className="w-3.5 h-3.5 text-[#9333ea]" />;
      default:
        return <MapPin className="w-3.5 h-3.5 text-[#5f6368]" />;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input container */}
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#f8f9fa] hover:bg-[#f1f3f4] focus:bg-white border border-[#dadce0] focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20 rounded-xl px-3 py-2 text-xs text-[#202124] placeholder-[#80868b] transition-all pr-14 shadow-xs outline-none"
        />

        {/* Clear / Status Icon Buttons */}
        <div className="absolute right-2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="w-3.5 h-3.5 text-[#1a73e8] animate-spin shrink-0" />
          )}

          {query ? (
            <button
              type="button"
              onClick={() => {
                onQueryChange("");
                setSuggestions([]);
              }}
              title="Clear input"
              className="p-1 rounded-full text-[#70757a] hover:text-[#202124] hover:bg-[#dadce0]/50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : isOrigin && onSelectCurrentLocation ? (
            <button
              type="button"
              onClick={() => {
                onSelectCurrentLocation();
                setIsOpen(false);
              }}
              title="Use current GPS location"
              className="p-1 rounded-full text-[#1a73e8] hover:bg-[#e8f0fe] transition-colors"
            >
              <Crosshair className={`w-3.5 h-3.5 ${isLocating ? "animate-spin text-[#1a73e8]" : ""}`} />
            </button>
          ) : null}
        </div>
      </div>

      {/* ========================================================= */}
      {/* Google Maps Style Autocomplete Popover */}
      {/* ========================================================= */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[600] bg-white rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.18),0_1px_4px_rgba(0,0,0,0.08)] border border-[#dadce0] overflow-hidden divide-y divide-[#f1f3f4] animate-in fade-in zoom-in-95 duration-100 max-h-[340px] overflow-y-auto">
          {/* 1. Quick Actions Row */}
          <div className="p-1.5 bg-[#f8f9fa] space-y-1">
            {/* GPS Live Location Shortcut (Especially for Origin) */}
            {onSelectCurrentLocation && (
              <button
                type="button"
                onClick={() => {
                  onSelectCurrentLocation();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[#e8f0fe] text-[#1a73e8] transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-[#1a73e8]/10 group-hover:bg-[#1a73e8] group-hover:text-white text-[#1a73e8] flex items-center justify-center transition-colors shrink-0">
                  <Crosshair className={`w-4 h-4 ${isLocating ? "animate-spin" : ""}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#1a73e8] flex items-center gap-1.5">
                    <span>Your location</span>
                    {userLiveLocation && (
                      <span className="text-[10px] bg-[#e6f4ea] text-[#137333] px-1.5 py-0.2 rounded-full font-semibold">
                        GPS Active
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#5f6368] truncate">
                    {userLiveLocation?.address || "Detect current GPS coordinates"}
                  </div>
                </div>
              </button>
            )}

            {/* Choose on Map Action */}
            {onSelectOnMap && (
              <button
                type="button"
                onClick={() => {
                  onSelectOnMap();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left hover:bg-[#f1f3f4] text-[#3c4043] transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-[#f1f3f4] group-hover:bg-[#dadce0] text-[#5f6368] flex items-center justify-center transition-colors shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[#202124]">Choose on map</div>
                  <div className="text-[11px] text-[#70757a]">Click anywhere on the map to place a pin</div>
                </div>
              </button>
            )}
          </div>

          {/* 2. Live API Search Suggestions */}
          {suggestions.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-[#70757a] uppercase">
                Search Results
              </div>
              {suggestions.map((place, idx) => {
                const title = place.name || (place.address ? place.address.split(",")[0] : "Location");
                const subtitle = place.address || `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelect(place)}
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-[#f1f3f4] transition-colors group"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#f1f3f4] text-[#5f6368] group-hover:text-[#1a73e8] group-hover:bg-[#e8f0fe] flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[#202124] truncate group-hover:text-[#1a73e8]">
                        {title}
                      </div>
                      <div className="text-[11px] text-[#70757a] truncate">{subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 3. Empty State when query has 2+ characters but 0 results */}
          {query.trim().length >= 2 && suggestions.length === 0 && !isLoading && (
            <div className="p-4 text-center text-[#70757a]">
              <Search className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs font-medium text-[#202124]">No locations found</p>
              <p className="text-[11px] mt-0.5">Try searching by street, landmark, or city name</p>
            </div>
          )}

          {/* 4. Popular Preset Locations (Shown when input is blank / focused) */}
          {query.trim().length < 2 && (
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-[#70757a] uppercase flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Suggested Transport Hubs</span>
              </div>
              {POPULAR_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(preset.point)}
                  className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-[#f1f3f4] transition-colors group"
                >
                  <div className="w-6 h-6 rounded-full bg-[#f8f9fa] group-hover:bg-white flex items-center justify-center shrink-0 mt-0.5 border border-[#dadce0]/60">
                    {getPresetIcon(preset.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#202124] truncate group-hover:text-[#1a73e8]">
                      {preset.name}
                    </div>
                    <div className="text-[11px] text-[#70757a] truncate">{preset.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
