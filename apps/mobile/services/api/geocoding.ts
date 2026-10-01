import { apiClient } from './client';
import { GeoPoint } from '@/types';

// Pre-indexed curated locations for zero-latency instant offline suggestions
const CURATED_PLACES: GeoPoint[] = [
  { name: 'Lalganj Baripura', address: 'Lalganj, Baripura, Nagpur, Maharashtra 440002', city: 'Nagpur', lat: 21.1624, lng: 79.1128 },
  { name: 'Mehandi Bagh', address: 'Mehandi Bagh Road, Lalganj, Nagpur, Maharashtra', city: 'Nagpur', lat: 21.1650, lng: 79.1140 },
  { name: 'Hinjawadi Phase 1 Tech Hub', address: 'Rajiv Gandhi Infotech Park, Hinjawadi', city: 'Pune', lat: 18.5987, lng: 73.7178 },
  { name: 'Pune Central Railway Station', address: 'Agarkar Nagar, Central Pune', city: 'Pune', lat: 18.5284, lng: 73.8744 },
  { name: 'Magarpatta Cybercity', address: 'Magarpatta City, Hadapsar', city: 'Pune', lat: 18.5529, lng: 73.9372 },
  { name: 'Viman Nagar International Airport', address: 'Lohegaon Airport Road, Viman Nagar', city: 'Pune', lat: 18.5679, lng: 73.9143 },
  { name: 'Phoenix Marketcity Mall', address: 'Viman Nagar, Nagar Road, Pune', city: 'Pune', lat: 18.5621, lng: 73.9168 },
  { name: 'Westend Mall Aundh', address: 'DP Road, Aundh, Pune', city: 'Pune', lat: 18.5626, lng: 73.8072 },
  { name: 'Shivaji Nagar Bus Terminus', address: 'Shivaji Nagar, Pune', city: 'Pune', lat: 18.5314, lng: 73.8446 },
  { name: 'Bandra Kurla Complex (BKC)', address: 'G Block, Bandra East', city: 'Mumbai', lat: 19.0657, lng: 72.8687 },
  { name: 'Chhatrapati Shivaji Maharaj Terminus (CSMT)', address: 'Fort, South Mumbai', city: 'Mumbai', lat: 18.9401, lng: 72.8354 },
  { name: 'Cyber City DLF Phase 2', address: 'Sector 24, Gurugram', city: 'Delhi NCR', lat: 28.4906, lng: 77.0898 },
  { name: 'Connaught Place', address: 'Radial Roads, Central Delhi', city: 'New Delhi', lat: 28.6315, lng: 77.2167 },
  { name: 'Electronic City Phase 1', address: 'Hosur Road, Bengaluru', city: 'Bengaluru', lat: 12.8399, lng: 77.6770 },
  { name: 'Kempegowda International Airport (BLR)', address: 'Devanahalli, Bengaluru', city: 'Bengaluru', lat: 13.1986, lng: 77.7066 },
  { name: 'HITEC City Cyber Towers', address: 'Madhapur, Hyderabad', city: 'Hyderabad', lat: 17.4504, lng: 78.3808 },
  { name: 'Chennai Central Station', address: 'Kannappar Thidal, Periyamet', city: 'Chennai', lat: 13.0827, lng: 80.2755 },
];

// In-memory cache for ultra-responsive search experience
const searchCache = new Map<string, GeoPoint[]>();

export const geocodingService = {
  /**
   * Multi-source search engine with Google Places, Google Suggestion Auto-expansion,
   * Tokenized Sublocality & Shop Matching, MapTiler, Nominatim, and Photon.
   */
  async search(query: string, userLocation?: { lat: number; lng: number }): Promise<GeoPoint[]> {
    if (!query || query.trim().length < 1) return [];
    const cleanQ = query.trim();
    const locKey = userLocation ? `_${userLocation.lat.toFixed(2)}_${userLocation.lng.toFixed(2)}` : '';
    const cacheKey = `${cleanQ.toLowerCase()}${locKey}`;

    // 1. Instant Cache Hit (0ms)
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey)!;
    }

    const googleKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    const mapTilerKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY || '';
    const results: GeoPoint[] = [];
    const seenCoordinates = new Set<string>();

    const addPoint = (p: GeoPoint) => {
      if (!p.lat || !p.lng) return;
      const nameKey = (p.name || p.address || '').toLowerCase().slice(0, 15);
      const coordKey = `${p.lat.toFixed(3)}_${p.lng.toFixed(3)}_${nameKey}`;
      if (!seenCoordinates.has(coordKey)) {
        seenCoordinates.add(coordKey);
        results.push(p);
      }
    };

    // Fast Token Generation (e.g. "Lalganj baripura" -> ["Lalganj baripura", "Lalganj", "Baripura"])
    const queryTokens = cleanQ.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 3);
    const candidateTerms = [cleanQ];

    // Fetch Google search expansion suggestions in parallel
    try {
      const suggestUrl = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(cleanQ)}&hl=en`;
      const sRes = await fetch(suggestUrl);
      if (sRes.ok) {
        const sJson = await sRes.json();
        if (Array.isArray(sJson[1])) {
          sJson[1].slice(0, 3).forEach((item: string) => {
            if (item && !candidateTerms.includes(item)) {
              candidateTerms.push(item);
            }
          });
        }
      }
    } catch {
      // ignore
    }

    // Add individual tokens for fallback matching
    queryTokens.forEach((tok) => {
      if (!candidateTerms.includes(tok)) {
        candidateTerms.push(tok);
      }
    });

    const tasks: Promise<any>[] = [];

    // =========================================================================
    // Task 1: Google Places Text Search (Searches any shop, business, small area)
    // =========================================================================
    if (googleKey) {
      tasks.push(
        (async () => {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2500);

            let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
              cleanQ
            )}&key=${googleKey}`;

            if (userLocation?.lat && userLocation?.lng) {
              url += `&location=${userLocation.lat},${userLocation.lng}&radius=50000`;
            }

            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (res.ok) {
              const json = await res.json();
              if (json.status === 'OK' && Array.isArray(json.results)) {
                json.results.slice(0, 8).forEach((item: any) => {
                  const placeName = item.name || cleanQ;
                  const formattedAddr = item.formatted_address || item.vicinity || placeName;
                  const addrParts = formattedAddr.split(',').map((s: string) => s.trim());
                  const city = addrParts.length >= 3 ? addrParts[addrParts.length - 3] : (addrParts[1] || '');

                  addPoint({
                    name: placeName,
                    address: formattedAddr,
                    city,
                    lat: item.geometry?.location?.lat,
                    lng: item.geometry?.location?.lng,
                  });
                });
              }
            }
          } catch {
            // Handled
          }
        })()
      );
    }

    // =========================================================================
    // Task 2: Photon Komoot Worldwide OSM Engine (Multi-term search)
    // =========================================================================
    candidateTerms.slice(0, 3).forEach((term) => {
      tasks.push(
        (async () => {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1800);

            let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&limit=6`;
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
                  const placeName = props.name || props.street || term;
                  const parts = [
                    props.name,
                    props.street ? (props.housenumber ? `${props.housenumber}, ${props.street}` : props.street) : null,
                    props.district || props.suburb || props.locality,
                    props.city,
                    props.state,
                  ].filter(Boolean);
                  const fullAddr = Array.from(new Set(parts)).join(', ');

                  addPoint({
                    name: placeName,
                    address: fullAddr || placeName,
                    city: props.city || props.district || props.state || '',
                    lat: coords[1],
                    lng: coords[0],
                  });
                });
              }
            }
          } catch {
            // Handled
          }
        })()
      );
    });

    // =========================================================================
    // Task 3: OpenStreetMap Nominatim with POI, Shop & Extratags Detail
    // =========================================================================
    candidateTerms.slice(0, 2).forEach((term) => {
      tasks.push(
        (async () => {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);

            let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              term
            )}&format=json&addressdetails=1&extratags=1&namedetails=1&limit=6`;

            if (userLocation?.lat && userLocation?.lng) {
              url += `&viewbox=${userLocation.lng - 0.5},${userLocation.lat + 0.5},${userLocation.lng + 0.5},${
                userLocation.lat - 0.5
              }&bounded=0`;
            }

            const res = await fetch(url, {
              signal: controller.signal,
              headers: { 'User-Agent': 'AeroRoutePlatform/2.0 (route-intelligence@ausorum.ai)' },
            });
            clearTimeout(timeout);

            if (res.ok) {
              const json = await res.json();
              if (Array.isArray(json)) {
                json.forEach((item: any) => {
                  const addr = item.address || {};
                  const shopName =
                    item.namedetails?.name ||
                    item.name ||
                    addr.shop ||
                    addr.amenity ||
                    addr.building ||
                    addr.road ||
                    addr.suburb ||
                    item.display_name.split(',')[0];

                  const parts = [
                    shopName,
                    addr.road,
                    addr.suburb || addr.neighbourhood || addr.residential,
                    addr.city || addr.town || addr.district,
                    addr.state,
                  ].filter(Boolean);

                  const cleanAddress = Array.from(new Set(parts)).join(', ');

                  addPoint({
                    name: shopName,
                    address: cleanAddress || item.display_name,
                    city: addr.city || addr.town || addr.district || addr.county || addr.state || '',
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                  });
                });
              }
            }
          } catch {
            // Handled
          }
        })()
      );
    });

    // =========================================================================
    // Task 4: Backend API Geocode Endpoint
    // =========================================================================
    tasks.push(
      (async () => {
        try {
          const res = await apiClient.get<GeoPoint[]>('/geocode/search', { q: cleanQ });
          if (Array.isArray(res.data)) {
            res.data.forEach((p) => addPoint(p));
          }
        } catch {
          // Handled
        }
      })()
    );

    // Run all search providers concurrently
    await Promise.allSettled(tasks);

    // Fallback: match curated landmark dataset if results are low
    const lower = cleanQ.toLowerCase();
    CURATED_PLACES.forEach((p) => {
      const nameMatch = p.name ? p.name.toLowerCase().includes(lower) : false;
      const addrMatch = p.address ? p.address.toLowerCase().includes(lower) : false;
      const cityMatch = p.city ? p.city.toLowerCase().includes(lower) : false;
      if (nameMatch || addrMatch || cityMatch) {
        addPoint(p);
      }
    });

    const finalResults = results.slice(0, 10);
    if (finalResults.length > 0) {
      searchCache.set(cacheKey, finalResults);
    }
    return finalResults;
  },

  /**
   * Reverse Geocode coordinates to precise shop name, building name, street & locality
   */
  async reverse(
    lat: number,
    lng: number
  ): Promise<{ address: string; name?: string; city?: string; lat: number; lng: number } | null> {
    const googleKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

    // 1. Google Reverse Geocode
    if (googleKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.results && json.results[0]) {
            const firstResult = json.results[0];
            const fullAddr = firstResult.formatted_address || '';
            const comp = firstResult.address_components || [];
            
            const poiComp = comp.find((c: any) =>
              c.types.includes('point_of_interest') ||
              c.types.includes('establishment') ||
              c.types.includes('premise') ||
              c.types.includes('sublocality')
            );
            const cityComp = comp.find((c: any) =>
              c.types.includes('locality') || c.types.includes('administrative_area_level_2')
            );

            return {
              address: fullAddr,
              name: poiComp?.long_name || fullAddr.split(',')[0] || 'Selected Location',
              city: cityComp?.long_name || '',
              lat,
              lng,
            };
          }
        }
      } catch {
        // Continue
      }
    }

    // 2. OpenStreetMap High-Precision Reverse (zoom=18 for exact shop/building)
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AeroRoutePlatform/2.0 (route-intelligence@ausorum.ai)' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.display_name) {
          const addr = json.address || {};
          const localName =
            addr.shop ||
            addr.amenity ||
            addr.building ||
            json.name ||
            addr.road ||
            json.display_name.split(',')[0];

          return {
            address: json.display_name,
            name: localName || 'Selected Location',
            city: addr.city || addr.town || addr.district || '',
            lat,
            lng,
          };
        }
      }
    } catch {
      // Continue
    }

    // 3. Backend API Reverse Fallback
    try {
      const response = await apiClient.get<{ address: string; name?: string; city?: string; lat: number; lng: number }>(
        '/geocode/reverse',
        { lat, lng }
      );
      if (response.data) return response.data;
    } catch {
      // Fallback
    }

    return {
      address: `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      name: `Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      city: '',
      lat,
      lng,
    };
  },
};
