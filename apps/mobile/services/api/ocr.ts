import { apiClient } from './client';
import { GeoPoint } from '@/types';

export interface ValidationDetails {
  pincode_valid: boolean;
  city_state_consistent: boolean;
  geocode_verified: boolean;
  conflict_warning?: string | null;
}

export interface ConfidenceBreakdown {
  ocr_confidence: number;
  parsing_confidence: number;
  pincode_confidence: number;
  geocoding_confidence: number;
  consistency_confidence: number;
}

export interface ParsedLocationItem {
  raw_extracted_text: string;
  cleaned_address: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  confidence_score: number;
  confidence_breakdown?: ConfidenceBreakdown;
  geocoded_point?: GeoPoint | null;
  matched_address?: string;
  validation?: ValidationDetails;
}

export interface OCRParseResult {
  locations: ParsedLocationItem[];
  status: string;
  processing_time_ms: number;
}

const INDIAN_STATES = [
  'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Gujarat',
  'Uttar Pradesh', 'Rajasthan', 'Delhi', 'Kerala', 'West Bengal',
  'Madhya Pradesh', 'Haryana', 'Punjab', 'Bihar', 'Andhra Pradesh',
  'Goa', 'Odisha', 'Jharkhand', 'Assam', 'Uttarakhand', 'Himachal Pradesh',
  'Jammu and Kashmir', 'Chandigarh', 'Puducherry'
];

const COMMON_CITIES: Record<string, string> = {
  pune: 'Maharashtra',
  mumbai: 'Maharashtra',
  'navi mumbai': 'Maharashtra',
  thane: 'Maharashtra',
  'pimpri-chinchwad': 'Maharashtra',
  pimpri: 'Maharashtra',
  nagpur: 'Maharashtra',
  nashik: 'Maharashtra',
  bengaluru: 'Karnataka',
  bangalore: 'Karnataka',
  mysuru: 'Karnataka',
  hyderabad: 'Telangana',
  chennai: 'Tamil Nadu',
  delhi: 'Delhi',
  'new delhi': 'Delhi',
  noida: 'Uttar Pradesh',
  'greater noida': 'Uttar Pradesh',
  gurgaon: 'Haryana',
  gurugram: 'Haryana',
  faridabad: 'Haryana',
  ahmedabad: 'Gujarat',
  surat: 'Gujarat',
  kolkata: 'West Bengal',
  jaipur: 'Rajasthan',
  lucknow: 'Uttar Pradesh',
  chandigarh: 'Chandigarh',
  indore: 'Madhya Pradesh',
  bhopal: 'Madhya Pradesh',
  patna: 'Bihar',
  kochi: 'Kerala',
};

const PINCODE_PREFIX_TO_STATE: Record<string, string> = {
  '11': 'Delhi',
  '12': 'Haryana',
  '13': 'Haryana',
  '14': 'Punjab',
  '15': 'Punjab',
  '16': 'Chandigarh',
  '17': 'Himachal Pradesh',
  '18': 'Jammu and Kashmir',
  '20': 'Uttar Pradesh',
  '22': 'Uttar Pradesh',
  '24': 'Uttarakhand',
  '30': 'Rajasthan',
  '38': 'Gujarat',
  '39': 'Gujarat',
  '40': 'Maharashtra',
  '41': 'Maharashtra',
  '42': 'Maharashtra',
  '43': 'Maharashtra',
  '44': 'Maharashtra',
  '45': 'Madhya Pradesh',
  '46': 'Madhya Pradesh',
  '50': 'Telangana',
  '51': 'Andhra Pradesh',
  '56': 'Karnataka',
  '57': 'Karnataka',
  '60': 'Tamil Nadu',
  '67': 'Kerala',
  '68': 'Kerala',
  '70': 'West Bengal',
  '75': 'Odisha',
  '78': 'Assam',
  '80': 'Bihar',
  '83': 'Jharkhand',
};

export const ocrService = {
  async parseImage(
    imageBase64: string,
    coords?: { latitude?: number; longitude?: number }
  ): Promise<OCRParseResult | null> {
    try {
      const response = await apiClient.post<OCRParseResult>('/ocr/parse-location', {
        image_base64: imageBase64,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      if (response.data) {
        return response.data;
      }
      throw new Error(response.error || 'OCR server returned an empty response.');
    } catch (e) {
      console.warn('Backend OCR parse failed:', e);
      throw e;
    }
  },

  async parseRawText(
    text: string,
    coords?: { latitude?: number; longitude?: number }
  ): Promise<OCRParseResult | null> {
    try {
      const response = await apiClient.post<OCRParseResult>('/ocr/parse-location', {
        raw_text: text,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      if (response.data) {
        return response.data;
      }
    } catch (e) {
      console.warn('Backend raw text OCR failed:', e);
    }
    return null;
  },

  async reverseGeocode(lat: number, lng: number): Promise<{ address: string; city?: string; state?: string } | null> {
    try {
      const response = await apiClient.get<{ address: string; lat: number; lng: number }>('/geocoding/reverse', {
        lat,
        lng,
      });
      if (response.data?.address) {
        const addr = response.data.address;
        let detectedCity: string | undefined;
        let detectedState: string | undefined;

        for (const city of Object.keys(COMMON_CITIES)) {
          if (addr.toLowerCase().includes(city.toLowerCase())) {
            detectedCity = city.charAt(0).toUpperCase() + city.slice(1);
            break;
          }
        }
        for (const state of INDIAN_STATES) {
          if (addr.toLowerCase().includes(state.toLowerCase())) {
            detectedState = state;
            break;
          }
        }

        return { address: addr, city: detectedCity, state: detectedState };
      }
    } catch (e) {
      console.warn('Reverse geocode error:', e);
    }
    return null;
  },

  /**
   * Client-side extractor used ONLY when offline or network fails.
   * NEVER invents default cities or fake coordinates.
   */
  extractDetailsLocally(
    text: string,
    fallbackCoords?: { latitude: number; longitude: number }
  ): ParsedLocationItem {
    if (!text || text.trim().length === 0) {
      return {
        raw_extracted_text: '',
        cleaned_address: '',
        confidence_score: 0.0,
        geocoded_point: null,
        validation: {
          pincode_valid: false,
          city_state_consistent: false,
          geocode_verified: false,
          conflict_warning: 'No text was provided.',
        },
      };
    }

    // 1. PIN Code extraction (supports corruption correction e.g. 411O45 -> 411045)
    let pincode: string | undefined;
    const pinMatch = text.match(/\b([1-9][0-9A-Za-z]{5})\b/);
    if (pinMatch) {
      const rawPin = pinMatch[1];
      const repaired = rawPin
        .replace(/[OoD]/g, '0')
        .replace(/[Il|!]/g, '1')
        .replace(/[Ss]/g, '5')
        .replace(/[Bb]/g, '8');
      if (/^[1-9][0-9]{5}$/.test(repaired)) {
        pincode = repaired;
      }
    }

    // Spaced pin format: '411 045'
    if (!pincode) {
      const spacedPin = text.match(/\b([1-9][0-9]{2})\s+([0-9]{3})\b/);
      if (spacedPin) {
        pincode = spacedPin[1] + spacedPin[2];
      }
    }

    // 2. State extraction
    let state: string | undefined;
    for (const st of INDIAN_STATES) {
      const regex = new RegExp(`\\b${st}\\b`, 'i');
      if (regex.test(text)) {
        state = st;
        break;
      }
    }

    // 3. City extraction
    let city: string | undefined;
    for (const [ct, st] of Object.entries(COMMON_CITIES)) {
      const regex = new RegExp(`\\b${ct}\\b`, 'i');
      if (regex.test(text)) {
        city = ct.charAt(0).toUpperCase() + ct.slice(1);
        if (!state) state = st;
        break;
      }
    }

    // Infer state from pincode prefix if missing
    if (pincode && !state) {
      state = PINCODE_PREFIX_TO_STATE[pincode.slice(0, 2)];
    }

    // 4. Coordinates extraction: Only from EXIF or watermark text
    let lat = fallbackCoords?.latitude;
    let lng = fallbackCoords?.longitude;

    const coordMatch = text.match(
      /(?:(?:lat|latitude)[:\s]*)?([+-]?\d{1,2}\.\d{3,})\s*(?:[,\s|/]+)\s*(?:(?:lon|lng|long|longitude)[:\s]*)?([+-]?\d{1,3}\.\d{3,})/i
    );
    if (coordMatch) {
      const parsedLat = parseFloat(coordMatch[1]);
      const parsedLng = parseFloat(coordMatch[2]);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        lat = parsedLat;
        lng = parsedLng;
      }
    }

    // Clean address (remove noise)
    let cleaned = text
      .replace(/(?:deliver to:|ship to:|invoice:|to:|tracking id:[^\n]+|contact:[^\n]+|package:[^\n]+|order id:[^\n]+)/gi, '')
      .replace(/\b(?:ph|tel|mob|phone|mobile)[\s:]*\d{10}\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Consistency check
    const pincode_valid = Boolean(pincode && /^[1-9][0-9]{5}$/.test(pincode));
    let city_state_consistent = true;
    let conflict_warning: string | undefined;

    if (pincode && state) {
      const expectedState = PINCODE_PREFIX_TO_STATE[pincode.slice(0, 2)];
      if (expectedState && expectedState.toLowerCase() !== state.toLowerCase()) {
        city_state_consistent = false;
        conflict_warning = `Pincode ${pincode} (${expectedState}) conflicts with state ${state}.`;
      }
    }

    // Calculate confidence score
    const hasStreet = cleaned.length > 5;
    const partsCount = (hasStreet ? 1 : 0) + (city ? 1 : 0) + (state ? 1 : 0) + (pincode_valid ? 1 : 0);
    const geocode_verified = Boolean(lat && lng);

    let confidence_score = (partsCount / 4.0) * 0.5 + (geocode_verified ? 0.35 : 0.0) + (city_state_consistent ? 0.15 : 0.0);
    confidence_score = Math.round(confidence_score * 100) / 100;

    return {
      raw_extracted_text: text,
      cleaned_address: cleaned.slice(0, 160),
      city,
      state,
      pincode,
      country: 'India',
      confidence_score,
      confidence_breakdown: {
        ocr_confidence: 0.85,
        parsing_confidence: Math.round((partsCount / 4.0) * 100) / 100,
        pincode_confidence: pincode_valid ? 1.0 : 0.0,
        geocoding_confidence: geocode_verified ? 0.90 : 0.0,
        consistency_confidence: city_state_consistent ? 1.0 : 0.3,
      },
      geocoded_point: (lat && lng) ? {
        lat,
        lng,
        name: cleaned.split(',')[0] || city || 'Verified Point',
        address: cleaned,
        city,
        state,
      } : null,
      validation: {
        pincode_valid,
        city_state_consistent,
        geocode_verified,
        conflict_warning,
      },
    };
  },
};
