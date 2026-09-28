import { apiClient } from './client';
import { GeoPoint } from '@/types';

// Pre-indexed curated locations for zero-latency local fallback
const CURATED_PLACES: GeoPoint[] = [
  { name: 'Hinjawadi Phase 1 Tech Hub', address: 'Rajiv Gandhi Infotech Park, Hinjawadi', city: 'Pune', lat: 18.5987, lng: 73.7178 },
  { name: 'Pune Central Railway Station', address: 'Agarkar Nagar, Central Pune', city: 'Pune', lat: 18.5284, lng: 73.8744 },
  { name: 'Magarpatta Cybercity', address: 'Magarpatta City, Hadapsar', city: 'Pune', lat: 18.5529, lng: 73.9372 },
  { name: 'Viman Nagar International Airport', address: 'Lohegaon Airport Road, Viman Nagar', city: 'Pune', lat: 18.5679, lng: 73.9143 },
  { name: 'Bandra Kurla Complex (BKC)', address: 'G Block, Bandra East', city: 'Mumbai', lat: 19.0657, lng: 72.8687 },
  { name: 'Chhatrapati Shivaji Maharaj Terminus', address: 'Fort, South Mumbai', city: 'Mumbai', lat: 18.9401, lng: 72.8354 },
  { name: 'Cyber City DLF Phase 2', address: 'Sector 24, Gurugram', city: 'Delhi NCR', lat: 28.4906, lng: 77.0898 },
  { name: 'Connaught Place', address: 'Radial Roads, Central Delhi', city: 'New Delhi', lat: 28.6315, lng: 77.2167 },
  { name: 'Electronic City Phase 1', address: 'Hosur Road, Bengaluru', city: 'Bengaluru', lat: 12.8399, lng: 77.6770 },
  { name: 'Kempegowda International Airport', address: 'Devanahalli, Bengaluru', city: 'Bengaluru', lat: 13.1986, lng: 77.7066 },
  { name: 'HITEC City Cyber Towers', address: 'Madhapur, Hyderabad', city: 'Hyderabad', lat: 17.4504, lng: 78.3808 },
  { name: 'Chennai Central Station', address: 'Kannappar Thidal, Periyamet', city: 'Chennai', lat: 13.0827, lng: 80.2755 },
];

// In-memory cache for zero-latency instant search results
const searchCache = new Map<string, GeoPoint[]>();

export const geocodingService = {
  /**
   * Ultra-fast multi-source location search with Google Places Autocomplete,
   * Photon Komoot worldwide OSM index, and local cache.
   */
  async search(query: string, userLocation?: { lat: number; lng: number }): Promise<GeoPoint[]> {
    if (!query || query.trim().length < 1) return [];
    const cleanQ = query.trim();
    const cacheKey = cleanQ.toLowerCase();

    // 1. Instant Cache Hit (0ms)
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey)!;
    }

    const googleKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    const results: GeoPoint[] = [];
    const seenAddresses = new Set<string>();

    const addPoint = (p: GeoPoint) => {
      const key = `${p.name?.toLowerCase()}_${(p.address || '').toLowerCase()}`;
      if (!seenAddresses.has(key) && p.lat && p.lng) {
        seenAddresses.add(key);
        results.push(p);
      }
    };

    // Fast Parallel Tasks
    const tasks: Promise<any>[] = [];

    // Task A: Google Maps Places & Geocode API
    if (googleKey) {
      tasks.push(
        (async () => {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1800);
            
            // Query Google Geocoding API for full coordinates
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanQ)}&key=${googleKey}${
              userLocation ? `&location=${userLocation.lat},${userLocation.lng}` : ''
            }`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            
            if (res.ok) {
              const json = await res.json();
              if (json.status === 'OK' && Array.isArray(json.results)) {
                json.results.slice(0, 5).forEach((item: any) => {
                  const comp = item.address_components || [];
                  const cityComp = comp.find((c: any) =>
                    c.types.includes('locality') || c.types.includes('administrative_area_level_2')
                  );
                  const stateComp = comp.find((c: any) =>
                    c.types.includes('administrative_area_level_1')
                  );
                  addPoint({
                    name: item.formatted_address.split(',')[0] || cleanQ,
                    address: item.formatted_address,
                    city: cityComp?.long_name || stateComp?.long_name || '',
                    lat: item.geometry.location.lat,
                    lng: item.geometry.location.lng,
                  });
                });
              }
            }
          } catch {
            // ignore
          }
        })()
      );
    }

    // Task B: Photon Komoot API (Ultra-fast worldwide OSM place/street/POI search)
    tasks.push(
      (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 1600);
          let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQ)}&limit=8`;
          if (userLocation?.lat && userLocation?.lng) {
            url += `&lat=${userLocation.lat}&lon=${userLocation.lng}`;
          }
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);

          if (res.ok) {
            const json = await res.json();
            if (json.features && Array.isArray(json.features)) {
              json.features.forEach((f: any) => {
                const props = f.properties || {};
                const coords = f.geometry?.coordinates || [0, 0];
                const name = props.name || props.street || cleanQ;
                const parts = [
                  props.name,
                  props.street,
                  props.district || props.suburb || props.locality,
                  props.city,
                  props.state,
                  props.country,
                ].filter(Boolean);
                const fullAddr = Array.from(new Set(parts)).join(', ');
                addPoint({
                  name,
                  address: fullAddr || name,
                  city: props.city || props.district || props.state || '',
                  lat: coords[1],
                  lng: coords[0],
                });
              });
            }
          }
        } catch {
          // ignore
        }
      })()
    );

    // Task C: OpenStreetMap Nominatim Search (Fallback for specific house numbers / Indian areas)
    tasks.push(
      (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 1800);
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            cleanQ
          )}&limit=5&addressdetails=1`;
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'RouteIntelligenceApp/1.0' },
          });
          clearTimeout(timeout);

          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json)) {
              json.forEach((item: any) => {
                addPoint({
                  name: item.name || item.display_name.split(',')[0],
                  address: item.display_name,
                  city: item.address?.city || item.address?.town || item.address?.county || item.address?.state || '',
                  lat: parseFloat(item.lat),
                  lng: parseFloat(item.lon),
                });
              });
            }
          }
        } catch {
          // ignore
        }
      })()
    );

    // Run all providers concurrently
    await Promise.allSettled(tasks);

    // If still empty, match curated points instantly
    if (results.length === 0) {
      const lower = cleanQ.toLowerCase();
      CURATED_PLACES.forEach((p) => {
        if (
          p.name.toLowerCase().includes(lower) ||
          p.address.toLowerCase().includes(lower) ||
          (p.city && p.city.toLowerCase().includes(lower))
        ) {
          addPoint(p);
        }
      });
    }

    const finalResults = results.slice(0, 8);
    if (finalResults.length > 0) {
      searchCache.set(cacheKey, finalResults);
    }
    return finalResults;
  },

  /**
   * Reverse Geocode coordinates to friendly place name & address
   */
  async reverse(lat: number, lng: number): Promise<{ address: string; lat: number; lng: number } | null> {
    const googleKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

    // 1. Try Google Reverse Geocode if key available
    if (googleKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.results && json.results[0]) {
            return {
              address: json.results[0].formatted_address,
              lat,
              lng,
            };
          }
        }
      } catch {
        // Continue
      }
    }

    // 2. Try Nominatim Reverse
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'RouteIntelligenceApp/1.0' } });
      if (res.ok) {
        const json = await res.json();
        if (json.display_name) {
          return {
            address: json.display_name,
            lat,
            lng,
          };
        }
      }
    } catch {
      // Continue
    }

    // 3. Try Backend API
    try {
      const response = await apiClient.get<{ address: string; lat: number; lng: number }>('/geocode/reverse', {
        lat,
        lng,
      });
      if (response.data) return response.data;
    } catch {
      // Fallback
    }

    return {
      address: `Selected Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      lat,
      lng,
    };
  },
};
