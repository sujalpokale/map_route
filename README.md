# AERO-ROUTE — Production-Grade Route Intelligence Platform

[![CI Pipeline](https://github.com/sujalpokale/route-intelligence-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/sujalpokale/route-intelligence-platform/actions)
[![Python Version](https://img.shields.io/badge/python-3.12%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16%20(React%2019)-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **"What is the best route for this vehicle, at this time, considering traffic, distance, fuel cost, road conditions, weather, vehicle constraints, delivery requirements, and business objectives?"**

AERO-ROUTE is an enterprise-grade transportation decision and route optimization platform. Unlike standard navigation tools that merely return the shortest or fastest turn-by-turn path, AERO-ROUTE calculates a multi-dimensional **Intelligent Route Score (IRS)** incorporating real-time traffic speeds, vehicle aerodynamics and payload physics, EV battery state-of-charge, localized weather hazards, road surface quality, and commercial toll economics.

---

## HERE Traffic-Aware Routing Setup

The FastAPI backend can use HERE Routing v8 and Traffic v7. HERE credentials stay server-side. Copy `.env.example` to `.env`, set `HERE_API_KEY`, then install backend dependencies and start the API from the repository root:

```powershell
Copy-Item .env.example .env
python -m pip install -r apps/api/requirements.txt
python -m uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000 --reload
```

The HERE-backed endpoints are `POST /api/v1/routes/calculate`, `POST /api/v1/routes/matrix`, `POST /api/v1/routes/reroute`, and `GET /api/v1/traffic/status?lat=...&lng=...`. Open `/docs` on the API host for request schemas. If HERE is unset or unavailable, route and matrix requests fall back to OSRM and explicitly mark live traffic unavailable. Copy `apps/mobile/.env.example` to `apps/mobile/.env` to tune the app's reroute-check interval; the app asks before switching routes.

The multi-stop planner consumes HERE travel-time matrices when available but remains the repository's existing nearest-neighbor/2-opt heuristic; this repository does not currently include OR-Tools. Reroute cooldown state is process-local, so use one API worker for consistent cooldown behavior until shared storage is added.

Run the focused tests with `python -m pytest apps/api/tests/test_here_provider.py apps/api/tests/test_reroute_policy.py apps/api/tests/test_vrp.py -q`. Check the mobile app with `cd apps/mobile` followed by `npm run typecheck`. With the backend running, use `/docs` to try each endpoint; no HERE key is committed or required by the mobile build.

## Accounts, Sessions, and Premium

FastAPI owns identity data in MongoDB Atlas; PostgreSQL/PostGIS remains the route/location store. The backend reads `MONGODB_URI`, `MONGODB_DATABASE`, and JWT settings from the repository `.env` and `apps/api/.env`. The latter is ignored by Git. Copy `.env.example` for the template, then set a long random `JWT_SECRET` and a valid Atlas URI. Credentials containing reserved URI characters must be percent-encoded. Do not put MongoDB credentials in the mobile environment.

The backend creates `users`, `sessions`, `subscriptions`, `user_preferences`, and `password_resets` collections on first connection and installs unique/indexed keys, including TTL expiry for sessions and reset records. Passwords are Argon2id hashes. JWTs contain a user ID and session ID; each protected request also checks the live session and active user, so logout/revocation takes effect before token expiry. PostgreSQL initialization is unchanged.

Optional access-rule overrides use `FEATURE_ACCESS_OVERRIDES` as semicolon-separated entries such as `advanced_traffic=free,premium;route_analytics=premium`; only known features and `free`/`premium` plan names are accepted.

Account endpoints:

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Public; creates user, Free plan, preferences, and session |
| `POST` | `/api/v1/auth/login` | Public; email/password |
| `POST` | `/api/v1/auth/logout` | Current session |
| `POST` | `/api/v1/auth/logout-all` | All current user's sessions |
| `POST` | `/api/v1/auth/forgot-password` | Public generic response |
| `POST` | `/api/v1/auth/reset-password` | One-time hashed token |
| `GET`, `PATCH` | `/api/v1/users/me` | Authenticated profile |
| `GET`, `PATCH` | `/api/v1/users/me/preferences` | Authenticated, user-scoped preferences |
| `GET` | `/api/v1/subscriptions/me` | Authenticated subscription |
| `GET` | `/api/v1/subscriptions/plans` | Public prices/features |
| `GET` | `/api/v1/subscriptions/premium/check/{feature}` | Authenticated access check |

Basic route planning and the grounded local assistant are available on the free plan. Premium unlocks external AI responses, advanced traffic, route analytics, and multi-stop optimization. Premium pricing is ₹199/month or ₹1,499/year. New accounts are always `user`; assign `admin` only through a trusted database-operator workflow after verifying the person. In development, an administrator can create a timed test plan with `POST /api/v1/subscriptions/admin/users/{user_id}/test-premium` and body `{"billing_cycle":"monthly"}` or `{"billing_cycle":"yearly"}`. This endpoint is disabled outside `APP_ENV=development`. It is not a payment flow. No payment processor is configured, so the mobile Premium screen shows the prices but cannot complete checkout.

Email delivery and SMS/phone verification providers are not configured. Forgot-password therefore returns a non-enumerating response without sending mail; profile email/phone changes are refused until verification delivery exists. The reset-token storage/consume service is ready for a real provider integration. Reset tokens are not logged or returned by API responses.

To test:

```powershell
python -m pip install -r apps/api/requirements.txt
python -m uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000 --reload
python -m pytest apps/api/tests/test_auth_system.py apps/api/tests/test_ai_route_intent.py -q
cd apps/mobile
npm run typecheck
```

Register via `/docs`, then use the returned bearer token for `GET /api/v1/users/me`, `PATCH /api/v1/users/me`, `GET /api/v1/users/me/preferences`, and `GET /api/v1/subscriptions/me`. After assigning an admin role through a trusted database-operator workflow, create a dev-only test subscription and verify that Free users receive `403 Premium subscription required` for gated APIs. Login returns a JWT for 60 minutes; native clients keep it in Expo SecureStore, while browser sessions remain memory-only. Authentication rate limits are per-process; use a shared limiter before running multiple production workers.

---

## Architecture Overview

```
                      +-------------------------------------------------+
                      |          Next.js 16 Web Application            |
                      |   (MapLibre/Leaflet, Tailwind, Framer Motion)   |
                      +-----------------------+-------------------------+
                                              | REST / WebSockets
                                              v
                      +-------------------------------------------------+
                      |            FastAPI Backend Gateway              |
                      +-------+-------------------+---------------------+
                              |                   |
            +-----------------+                   +-----------------+
            v                                                       v
+-----------------------+                               +-----------------------+
| Route Intelligence    |                               | AI Assistant & Agent  |
| - Multi-Candidate Gen |                               | - Tool Calling Engine |
| - 9-Factor IRS Scoring|                               | - Grounded Reasoning  |
| - Physics Fuel Model  |                               | - Web Speech Voice AI |
| - 2-Opt VRP Optimizer |                               +-----------------------+
| - Dynamic Rerouting   |                                           |
+-----------+-----------+                                           |
            |                                                       v
            v                                           +-----------------------+
+-----------------------+                               | ML Prediction Engine  |
| Provider Abstraction  |                               | - LightGBM ETA Model  |
| - OSRM (OpenStreet)   |                               | - Random Forest Fuel  |
| - Open-Meteo Weather  |                               | - Drift Evaluator     |
| - Nominatim Geocoding |                               +-----------------------+
| - Mapbox/Google (Opt) |
+-----------+-----------+
            |
            v
+-----------------------+
| Persistence & Cache   |
| - PostgreSQL + PostGIS|
| - Redis Pub/Sub Cache |
+-----------------------+
```

---

## Key Platform Features

### 1. Intelligent Route Scoring (IRS) Engine
Evaluates candidate routes against 9 normalized sub-scores $\in [0, 100]$:
$$S_{\text{overall}} = w_t S_{\text{time}} + w_f S_{\text{fuel}} + w_c S_{\text{cost}} + w_{\text{tr}} S_{\text{traffic}} + w_d S_{\text{distance}} + w_w S_{\text{weather}} + w_r S_{\text{road}} + w_s S_{\text{safety}} + w_v S_{\text{vehicle}}$$

- **Dynamic Optimization Modes**:
  - `Fastest`: Prioritizes travel duration and bypasses congestion bottlenecks.
  - `Cheapest`: Strongly weights fuel consumption, toll fees, driver wages, and maintenance wear.
  - `Fuel Efficient`: Optimizes for aerodynamic cruising speeds and minimizes stop-and-go idle penalties.
  - `Balanced`: Harmonizes cost, arrival time, and highway safety.
  - `Fleet Optimized`: Balances delivery payload constraints, driver hourly wages, and vehicle preservation.
  - `EV Optimal`: Maximizes regenerative braking and estimates battery state of charge (SOC).

### 2. Vehicle Dynamics & Energy Physics
- Calibrated aerodynamic drag ($C_d$), frontal area ($A$), curb weight, and rolling resistance ($C_{rr}$).
- Explicit payload mass scaling ($M_{\text{total}} = M_{\text{curb}} + M_{\text{payload}}$).
- Idle congestion penalty modeling kinetic braking loss and engine idling.
- Support for **Cars, Delivery Vans, Heavy Trucks, Bikes, and Electric Vehicles (EVs)**.

### 3. Machine Learning ETA & Fuel Regressors
- **ETA Predictor (Gradient Boosting)**:
  - $R^2 = 0.9930$, $\text{MAE} = 2.01\text{ min}$, $\text{MAPE} = 6.09\%$.
  - Corrects naive map routing times using hour-of-day rush patterns, weather severity, vehicle payload, and real-time congestion indices.
- **Fuel Regressor (Random Forest)**:
  - $R^2 = 0.9788$, $\text{MAE} = 0.201\text{ litres}$.
  - Estimates fuel and $\text{CO}_2$ emissions across terrain gradients.

### 4. 2-Opt Multi-Stop Delivery Sequencer (VRP)
- Solves the Vehicle Routing Problem for urban delivery fleets.
- Accounts for urgent delivery priorities, payload capacities, and time windows.

### 5. AI Transportation Assistant & Voice Interface
- Agentic tool-calling loop invoking backend endpoints (`get_route`, `compare_routes`, `calculate_cost`, `get_weather`, `optimize_stops`).
- 100% grounded explanations—never hallucinates numerical statistics.
- Hands-free Web Speech API integration (voice dictation + text-to-speech audio feedback).

### 6. Computer Vision & OCR Location Parser
- Upload shipping invoices, delivery slips, or GPS coordinate stamps.
- Automatically normalizes street addresses, isolates pincodes, and geocodes drop-off points onto the map.

### 7. Fleet Telematics & Executive Analytics
- Real-time fleet overview: vehicle speeds, assigned drivers, capacity utilization, and EV charge rings.
- Executive ROI charts: monthly fuel cost trends, strategy adoption percentages, and ETA error distributions.

---

## Getting Started & Local Development

### Prerequisites
- Node.js 20+
- Python 3.12+
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/sujalpokale/route-intelligence-platform.git
cd route-intelligence-platform
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Out of the box, the platform runs 100% free with zero API keys required, using OSRM, OpenStreetMap, and Open-Meteo).*

### 3. Start Backend Server
```bash
# Install dependencies
pip install -r apps/api/requirements.txt
pip install -r ml/requirements.txt

# Run automated tests
python -m pytest apps/api/tests -v

# Train ML models
python -m ml.training.train

# Start FastAPI server
python -m uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000 --reload
```
The API is available on this computer at `http://127.0.0.1:8000/docs` and to devices on the same Wi-Fi at `http://<computer-lan-ip>:8000/docs`. The mobile app uses the Expo development server host to reach the API, so start Expo and the API on the same network. For a standalone mobile build, set `EXPO_PUBLIC_API_URL` to the deployed API base URL before building.

### 4. Start Web Application
```bash
cd apps/web
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Docker Deployment

To launch the complete multi-container stack (PostgreSQL + PostGIS, Redis, API, and Next.js Web):

```bash
docker compose up -d --build
```

---

## REST API Specification

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/routes/calculate` | Generate multi-candidate routes with 9-factor IRS scoring |
| `POST` | `/api/v1/routes/optimize-stops` | Solve 2-Opt Vehicle Routing Problem for multi-stop delivery |
| `POST` | `/api/v1/routes/reroute` | Dynamic traffic/incident re-evaluation and diversion check |
| `POST` | `/api/v1/predict/eta` | ML-driven journey duration inference |
| `POST` | `/api/v1/predict/fuel` | Physics-augmented fuel and CO2 emissions prediction |
| `POST` | `/api/v1/ai/chat` | Conversational transportation assistant with tool execution |
| `POST` | `/api/v1/ocr/parse-location` | Extract address & geocode from unstructured text/receipt |
| `GET` | `/api/v1/fleet/vehicles` | Fleet inventory with live telematics & battery states |
| `GET` | `/api/v1/analytics/dashboard` | Enterprise ROI, fuel saved, and model accuracy KPIs |
| `GET` | `/health` | Kubernetes / container health check |

---

## Project Structure

```
route-intelligence-platform/
│
├── apps/
│   ├── web/                         # Next.js 16 (React 19, TypeScript, Tailwind, Leaflet)
│   │   ├── app/                     # Next.js App Router
│   │   ├── components/              # Interactive Map, RouteCard, Modals, VRP, Fleet
│   │   ├── lib/                     # Typed API client
│   │   └── package.json
│   │
│   └── api/                         # FastAPI Application
│       ├── app/
│       │   ├── api/v1/endpoints/    # REST routes (routes, predict, ai, ocr, fleet)
│       │   ├── core/                # App configuration, security, JWT
│       │   ├── db/                  # Async session, SQLAlchemy models
│       │   ├── engine/              # Scoring formula, physics, VRP, dynamic rerouter
│       │   ├── providers/           # OSRM, Open-Meteo, Nominatim, Mapbox adapters
│       │   ├── schemas/             # Pydantic v2 schemas
│       │   └── main.py              # App entrypoint & middleware
│       ├── requirements.txt
│       └── tests/                   # Pytest test suite (scoring, physics, VRP, API)
│
├── ml/                              # Machine Learning Pipeline
│   ├── data/                        # Synthetic & historical dataset generators
│   ├── models/                      # Serialized LightGBM & Random Forest estimators
│   ├── training/                    # Model training, cross-validation & evaluation
│   └── requirements.txt
│
├── infrastructure/
│   ├── docker/                      # Dockerfile.api & Dockerfile.web
│   └── docker-compose.yml           # PostgreSQL+PostGIS, Redis, API, Web
│
├── .github/workflows/ci.yml         # GitHub Actions CI pipeline
├── .env.example                     # Environment template
├── pytest.ini                       # Test configuration
└── README.md                        # Platform documentation
```

---

## License
MIT License. Built by Sujal Pokale.
