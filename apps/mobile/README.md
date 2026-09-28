# Route Intelligence — Mobile Client

[![Expo SDK](https://img.shields.io/badge/Expo%20SDK-52-blue.svg)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

The official **Route Intelligence Mobile Application** built with **React Native, Expo, TypeScript, and Expo Router**.

---

## 📱 Features

1. **Intelligent Route Scoring (IRS)**:
   - Real-time 9-factor route scoring incorporating travel time, physics fuel consumption, toll fees, corridor weather, road quality, and safety.
2. **2-Opt Multi-Stop VRP Optimizer**:
   - Solves multi-stop delivery sequencing with urgent priorities, time window constraints, and stop locking.
3. **Live Turn-by-Turn Head-Up Navigation**:
   - Speedometer HUD, speed limit indicators, GPS accuracy telematics, and countdown turn maneuvers.
4. **Dynamic Deviation & Detour Rerouting**:
   - Detects when vehicle leaves the corridor and proposes faster alternative detours with exact time/fuel savings.
5. **Conversational AI Transportation Assistant**:
   - Hands-free voice commands, grounded tool execution, and physics-based route explanations.
6. **Computer Vision & OCR Address Scanner**:
   - Extract street addresses and drop-off waypoints directly from delivery invoices and shipping labels.
7. **Delivery Manifest & Proof of Delivery (POD)**:
   - Geotagged photo proof, digital signatures, and customer contact actions.
8. **Commercial Telematics & Fleet Garage**:
   - Fuel savings analytics, CO₂ emissions tracking, vehicle profiles (Car, Van, Truck, and EV state of charge).

---

## 🛠️ Architecture & Structure

```text
apps/mobile/
├── app/                            # Expo Router file-based screens
│   ├── _layout.tsx                 # Root layout & providers
│   ├── index.tsx                   # Splash & onboarding screen
│   ├── (auth)/                     # Driver / Fleet Authentication
│   │   └── login.tsx
│   ├── (tabs)/                     # 5 Primary Bottom Tabs
│   │   ├── home.tsx                # Command Center & Live Vector Map
│   │   ├── routes.tsx              # Multi-Stop Route Optimizer & VRP
│   │   ├── trips.tsx               # Journey Logs & Telematics Analytics
│   │   ├── assistant.tsx           # Conversational AI Copilot & Voice
│   │   └── profile.tsx             # Driver Profile & Vehicle Garage
│   ├── navigation/                 # Active Turn-by-Turn HUD
│   │   ├── [routeId].tsx
│   │   └── active-trip.tsx
│   ├── route/details.tsx           # 9-Factor IRS Score Deep Inspection
│   ├── deliveries/index.tsx        # Delivery Manifest & Proof of Delivery
│   ├── vehicles/index.tsx          # Vehicle Garage & EV SOC Manager
│   ├── ocr/scan.tsx                # Camera Waybill & Invoice Scanner
│   └── settings/index.tsx          # Settings, Units, and Audio Guidance
├── components/
│   ├── ui/                         # Design System (Button, Card, Badge, Input, Header, Modal)
│   ├── map/                        # Abstracted Map View, Pins & Traffic Overlay
│   ├── route/                      # RouteCard, IRSScoreBreakdown, StopList, OptimizationSelector
│   ├── navigation/                 # TurnManeuverCard, SpeedometerHUD, TripProgressBar, DeviationBanner
│   ├── delivery/                   # DeliveryCard, ProofOfDeliveryModal
│   ├── assistant/                  # AIChatBubble, VoiceWaveform, QuickActionChips
│   └── analytics/                  # ROICard & Telematics Stats
├── services/api/                   # Typed API Clients (Routes, Geocode, ML Predict, AI, OCR, Fleet)
├── stores/                         # Modular Zustand Stores (Auth, Location, Route, Nav, Vehicle, AI, Trip)
├── constants/theme.ts              # Midnight Navy / Cyber Cyan Theme Design System
└── types/index.ts                  # Comprehensive TypeScript Definitions
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd apps/mobile
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Start Expo Development Server
```bash
npx expo start
```

Press `a` for Android Emulator, `i` for iOS Simulator, or `w` for Web Browser.
