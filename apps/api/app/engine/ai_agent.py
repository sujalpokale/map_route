import json
import re
from typing import Dict, Any, List, Optional
import httpx
import logging

from apps.api.app.core.config import settings
from apps.api.app.schemas import (
    GeoPoint, RouteCalculateRequest, OptimizationMode,
    VehicleTypeEnum, FuelTypeEnum, StopItem, OptimizeStopsRequest
)
from apps.api.app.providers.geocoding import get_geocoding_provider
from apps.api.app.providers.routing import get_routing_provider
from apps.api.app.providers.weather import get_weather_provider
from apps.api.app.engine.scoring import ScoringEngine
from apps.api.app.engine.physics import PhysicsEngine
from apps.api.app.engine.vrp_optimizer import VRPOptimizer
from apps.api.app.engine.ml_predictor import MLInferenceService
from apps.api.app.schemas import PredictETARequest

logger = logging.getLogger(__name__)


# -------------------------------------------------------------
# Tool Execution Registry
# -------------------------------------------------------------
async def tool_get_route(origin_query: str, dest_query: str, mode: str = "Balanced", vehicle: str = "CAR") -> Dict[str, Any]:
    geo = get_geocoding_provider()
    orig_pts = await geo.search(origin_query, limit=1)
    dest_pts = await geo.search(dest_query, limit=1)

    if not orig_pts or not dest_pts:
        return {"error": f"Could not resolve locations for '{origin_query}' or '{dest_query}'"}

    p1, p2 = orig_pts[0], dest_pts[0]
    opt_mode = OptimizationMode.BALANCED
    for m in OptimizationMode:
        if m.value.lower() in mode.lower():
            opt_mode = m
            break

    v_type = VehicleTypeEnum.CAR
    try:
        v_type = VehicleTypeEnum(vehicle.upper())
    except Exception:
        pass

    req = RouteCalculateRequest(
        origin=p1,
        destination=p2,
        vehicle_type=v_type,
        optimization_mode=opt_mode
    )

    routing = get_routing_provider()
    weather_prov = get_weather_provider()
    raw_candidates = await routing.get_routes(p1, p2, vehicle_type=v_type)
    weather = await weather_prov.get_weather(p1.lat, p1.lng)
    routes = ScoringEngine.evaluate_candidates(raw_candidates, req, weather)

    if not routes:
        return {"error": "No viable routes found"}

    best = routes[0]
    return {
        "recommended_route": best.label,
        "overall_score": best.overall_score,
        "distance_km": best.distance_km,
        "duration_min": best.duration_min,
        "fuel_litres": best.fuel_litres,
        "total_cost_inr": best.total_cost_inr,
        "traffic_level": best.traffic_level,
        "weather": best.weather_condition,
        "reason": best.recommendation_reason,
        "alternatives_count": len(routes) - 1,
        "coordinates_count": len(best.coordinates)
    }


async def tool_compare_routes(origin_query: str, dest_query: str) -> Dict[str, Any]:
    geo = get_geocoding_provider()
    orig_pts = await geo.search(origin_query, limit=1)
    dest_pts = await geo.search(dest_query, limit=1)
    if not orig_pts or not dest_pts:
        return {"error": "Both locations must be resolved by the geocoding service before route comparison."}
    p1, p2 = orig_pts[0], dest_pts[0]

    req = RouteCalculateRequest(origin=p1, destination=p2, optimization_mode=OptimizationMode.BALANCED)
    raw = await get_routing_provider().get_routes(p1, p2)
    weather = await get_weather_provider().get_weather(p1.lat, p1.lng)
    routes = ScoringEngine.evaluate_candidates(raw, req, weather)

    comparison_table = []
    for r in routes:
        comparison_table.append({
            "route": r.label,
            "score": r.overall_score,
            "distance": f"{r.distance_km} km",
            "time": f"{r.duration_min} min",
            "fuel": f"{r.fuel_litres} L",
            "cost": f"₹{r.total_cost_inr}",
            "traffic": r.traffic_level,
            "recommended": r.is_recommended
        })

    return {
        "routes": comparison_table,
        "recommendation": routes[0].recommendation_reason if routes else "None"
    }


async def tool_get_weather(query: str) -> Dict[str, Any]:
    geo = get_geocoding_provider()
    pts = await geo.search(query, limit=1)
    if not pts:
        return {"error": f"Weather location '{query}' could not be geocoded."}
    p = pts[0]
    weather = await get_weather_provider().get_weather(p.lat, p.lng)
    return weather.to_dict()


async def tool_calculate_cost(
    fuel_litres: float,
    distance_km: float,
    duration_min: float,
    tolls_inr: float = 0.0,
    fuel_price_inr: Optional[float] = None,
) -> Dict[str, Any]:
    f_cost = fuel_litres * (fuel_price_inr or settings.DEFAULT_PETROL_PRICE_INR)
    breakdown = PhysicsEngine.calculate_total_route_cost(
        fuel_cost_inr=f_cost,
        toll_cost_inr=tolls_inr,
        duration_min=duration_min,
        distance_km=distance_km
    )
    return breakdown


# -------------------------------------------------------------
# AI Agent Orchestrator
# -------------------------------------------------------------
class AIAssistantAgent:
    @classmethod
    async def process_user_query(
        cls,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
        context: Optional[Dict[str, Any]] = None,
        allow_external: bool = True,
    ) -> Dict[str, Any]:
        msg_lower = message.lower()
        tools_executed = []

        # Check if user has an external LLM configured (Gemini, OpenAI, Anthropic, etc.)
        if allow_external and settings.LLM_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
            try:
                return await cls._call_gemini(message, history, context)
            except Exception as e:
                logger.warning(f"Gemini agent call failed: {e}. Using deterministic reasoning engine.")

        if allow_external and settings.LLM_PROVIDER == "openai" and settings.OPENAI_API_KEY:
            try:
                return await cls._call_openai(message, history, context)
            except Exception as e:
                logger.warning(f"OpenAI agent call failed: {e}. Using deterministic reasoning engine.")

        # ---------------------------------------------------------
        # Deterministic Grounded Agent (100% Offline / Zero Cost)
        # ---------------------------------------------------------

        # 1. Weather inquiry
        if any(w in msg_lower for w in ["weather", "rain", "rainy", "fog", "storm", "temperature"]):
            target = None
            for city in ["mumbai", "pune", "delhi", "bangalore", "bengaluru", "hyderabad", "hinjawadi"]:
                if city in msg_lower:
                    target = city.capitalize()
                    break
            if not target:
                return {"reply": "Which city or place should I check the weather for?", "tool_calls_made": []}
            w_res = await tool_get_weather(target)
            if "error" in w_res:
                return {"reply": w_res["error"], "tool_calls_made": []}
            tools_executed.append({"tool": "get_weather", "input": {"location": target}, "output": w_res})
            reply = (
                f"🌤️ **Weather Intelligence for {target}**:\n\n"
                f"- **Condition**: {w_res['condition']}\n"
                f"- **Temperature**: {w_res['temperature_c']}°C\n"
                f"- **Precipitation**: {w_res['precipitation_mm']} mm\n"
                f"- **Wind**: {w_res['wind_speed_kmh']} km/h\n"
                f"- **Visibility**: {w_res['visibility_km']} km (Route Weather Safety Score: {w_res['weather_score']}/100)\n\n"
                f"{'⚠️ Road grip may be affected by rain; drive with caution.' if w_res['precipitation_mm'] > 0 else 'Road conditions are dry and favorable.'}"
            )
            return {"reply": reply, "tool_calls_made": tools_executed}

        # 2. Compare routes inquiry
        elif any(w in msg_lower for w in ["compare", "difference", "which route", "options", "alternatives"]):
            match = re.search(r"\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s+and\s+compare|$)", message, re.IGNORECASE)
            if not match:
                return {"reply": "Name both places to compare routes, for example: compare Kothrud to Pune Airport.", "tool_calls_made": []}
            orig, dest = match.group(1).strip(), match.group(2).strip()
            comp_res = await tool_compare_routes(orig, dest)
            if "error" in comp_res:
                return {"reply": comp_res["error"], "tool_calls_made": []}
            tools_executed.append({"tool": "compare_routes", "input": {"origin": orig, "destination": dest}, "output": comp_res})

            lines = [f"📊 **Route Comparison Matrix ({orig} ➔ {dest})**:\n"]
            for r in comp_res["routes"]:
                rec_badge = " ⭐ (Recommended)" if r["recommended"] else ""
                lines.append(f"- **{r['route']}**{rec_badge}: Score **{r['score']}**/100 | {r['distance']} | {r['time']} | Fuel: {r['fuel']} | Cost: {r['cost']} | Traffic: {r['traffic']}")
            lines.append(f"\n💡 **Intelligence Justification**:\n{comp_res['recommendation']}")

            return {"reply": "\n".join(lines), "tool_calls_made": tools_executed}

        # 3. Cost inquiry
        elif any(w in msg_lower for w in ["cost", "how much", "expense", "toll", "price", "rupees", "inr"]):
            route = (context or {}).get("current_route") if isinstance(context, dict) else None
            if not isinstance(route, dict):
                return {"reply": "Calculate or select a route first so I can estimate its actual distance, time, and fuel cost.", "tool_calls_made": []}
            vehicle = (context or {}).get("selected_vehicle", {}) if isinstance(context, dict) else {}
            fuel_price = float(vehicle.get("fuel_price_inr") or settings.DEFAULT_PETROL_PRICE_INR)
            fuel_unit = "kWh" if vehicle.get("fuel_type") == "ELECTRIC" else "L"
            cost_res = await tool_calculate_cost(
                fuel_litres=float(route.get("fuel_litres") or 0),
                distance_km=float(route.get("distance_km") or 0),
                duration_min=float(route.get("duration_min") or 0),
                tolls_inr=float(route.get("toll_cost_inr") or 0),
                fuel_price_inr=fuel_price,
            )
            tools_executed.append({"tool": "calculate_cost", "input": {"fuel_litres": 3.5, "distance_km": 42.0, "duration_min": 50.0}, "output": cost_res})
            reply = (
                f"💰 **Total Trip Cost Breakdown** (Calculated with dynamic commercial rates):\n\n"
                f"- **Fuel Cost**: ₹{cost_res['fuel_cost_inr']} (at ₹{fuel_price}/{fuel_unit})\n"
                f"- **Toll Charges**: ₹{cost_res['toll_cost_inr']}\n"
                f"- **Driver Time Cost**: ₹{cost_res['driver_cost_inr']} (at ₹{settings.DEFAULT_DRIVER_HOURLY_WAGE_INR}/hr)\n"
                f"- **Vehicle Wear & Maintenance**: ₹{cost_res['maintenance_cost_inr']} (at ₹{settings.DEFAULT_MAINTENANCE_PER_KM_INR}/km)\n"
                f"---\n"
                f"**Total Trip Economic Cost**: **₹{cost_res['total_cost_inr']}**"
            )
            return {"reply": reply, "tool_calls_made": tools_executed}

        # 4. Multi-delivery optimization inquiry
        elif any(w in msg_lower for w in ["deliveries", "delivery", "optimize stops", "vrp", "stops", "packages"]):
            reply = (
                f"📦 **Multi-Stop Logistics Optimization Ready**:\n\n"
                f"I can optimize stop sequences using the 2-Opt Vehicle Routing Problem (VRP) engine. "
                f"It considers package weights, priority levels (Urgent/Normal), and delivery time windows.\n\n"
                f"👉 Switch to the **Multi-Stop Optimizer** tab or provide a list of drop locations to compute the lowest-fuel delivery sequence immediately."
            )
            return {
                "reply": reply,
                "suggested_action": {"type": "navigate", "tab": "optimize"}
            }

        # Route creation uses POST /ai/route so it can validate intent and geocoding.
        else:
            return {"reply": "Tell me the destination and, if you are not at the start, the starting place. I will resolve both places before calculating a real route.", "tool_calls_made": []}

    @classmethod
    async def _call_openai(cls, message: str, history: Optional[List[Dict[str, str]]], context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        # OpenAI tool calling implementation
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        messages = [{"role": "system", "content": "You are the Route Intelligence AI Assistant. Always be concise, data-driven, and reference actual calculations."}]
        if history:
            for h in history[-4:]:
                messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
        messages.append({"role": "user", "content": message})

        payload = {
            "model": settings.LLM_MODEL,
            "messages": messages,
            "temperature": 0.2
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                reply_text = data["choices"][0]["message"]["content"]
                return {"reply": reply_text, "tool_calls_made": []}
            raise RuntimeError(f"OpenAI error {resp.status_code}: {resp.text}")

    @classmethod
    async def _call_gemini(
        cls, message: str, history: Optional[List[Dict[str, str]]], context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        model = settings.LLM_MODEL if "gemini" in settings.LLM_MODEL.lower() else "gemini-3.6-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.GEMINI_API_KEY}"

        system_instruction = (
            "You are the Route Intelligence AI Assistant. You provide clear, concise, data-driven "
            "logistics and navigation advice, route comparisons, fuel economics, and weather-aware suggestions."
        )
        if context:
            system_instruction += f"\nCurrent Session / Route Context:\n{json.dumps(context)}"

        contents = []
        if history:
            for h in history[-4:]:
                role = "model" if h.get("role") in ["assistant", "model"] else "user"
                c_text = h.get("content", "")
                if c_text:
                    contents.append({"role": role, "parts": [{"text": c_text}]})

        contents.append({"role": "user", "parts": [{"text": message}]})

        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": contents,
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 600
            }
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    reply_text = "".join([p.get("text", "") for p in parts]).strip()
                    if reply_text:
                        return {"reply": reply_text, "tool_calls_made": []}
            raise RuntimeError(f"Gemini API returned empty response or error: {resp.status_code}")

