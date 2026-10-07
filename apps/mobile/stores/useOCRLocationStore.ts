import { create } from 'zustand';
import { ValidationDetails } from '@/services/api/ocr';

export interface OCRLocationResult {
  rawExtractedText: string;
  cleanedAddress: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  confidenceScore: number;
  validation: ValidationDetails | null;
}

interface OCRLocationState {
  result: OCRLocationResult | null;
  setResult: (result: OCRLocationResult) => void;
  clearResult: () => void;
}

export const useOCRLocationStore = create<OCRLocationState>((set) => ({
  result: null,
  setResult: (result) => set({ result }),
  clearResult: () => set({ result: null }),
}));
