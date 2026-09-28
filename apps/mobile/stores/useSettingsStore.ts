import { create } from 'zustand';
import { AppSettings, OptimizationMode } from '@/types';

interface SettingsState {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  toggleVoiceGuidance: () => void;
  toggleDarkMap: () => void;
  setDefaultOptimization: (mode: OptimizationMode) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  units: 'metric',
  currency: 'INR',
  defaultOptimization: 'Balanced',
  autoRerouteThresholdMin: 3.0,
  voiceGuidanceEnabled: true,
  darkMapEnabled: true,
  telematicsSyncIntervalSec: 5,
  hapticFeedbackEnabled: true,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,

  updateSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),

  toggleVoiceGuidance: () =>
    set((state) => ({
      settings: {
        ...state.settings,
        voiceGuidanceEnabled: !state.settings.voiceGuidanceEnabled,
      },
    })),

  toggleDarkMap: () =>
    set((state) => ({
      settings: {
        ...state.settings,
        darkMapEnabled: !state.settings.darkMapEnabled,
      },
    })),

  setDefaultOptimization: (mode) =>
    set((state) => ({
      settings: { ...state.settings, defaultOptimization: mode },
    })),
}));
