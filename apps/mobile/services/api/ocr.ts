import { apiClient } from './client';
import { GeoPoint } from '@/types';

export interface ParsedLocationItem {
  raw_extracted_text: string;
  cleaned_address: string;
  city?: string;
  pincode?: string;
  confidence_score: number;
  geocoded_point?: GeoPoint;
}

export interface OCRParseResult {
  locations: ParsedLocationItem[];
  status: string;
  processing_time_ms: number;
}

export const ocrService = {
  async parseImage(imageBase64: string): Promise<OCRParseResult | null> {
    const response = await apiClient.post<OCRParseResult>('/ocr/parse', {
      image_base64: imageBase64,
    });
    return response.data;
  },

  async parseRawText(text: string): Promise<OCRParseResult | null> {
    const response = await apiClient.post<OCRParseResult>('/ocr/parse', {
      raw_text: text,
    });
    return response.data;
  },
};
