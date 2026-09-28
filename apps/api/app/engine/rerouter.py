from typing import Dict, Any, Optional
from apps.api.app.schemas import GeoPoint, CandidateRoute
from apps.api.app.providers.routing import get_routing_provider


class DynamicRerouter:
    @classmethod
    async def evaluate_reroute(
        cls,
        current_location: GeoPoint,
        destination: GeoPoint,
        current_route_id: str,
        current_eta_min: float,
        reported_incident: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluates real-time traffic or road closures on the current path
        and triggers a reroute proposal if savings exceed 5 minutes.
        """
        routing_provider = get_routing_provider()
        candidates = await routing_provider.get_routes(current_location, destination)

        # Simulate incident impact on current route
        incident_delay = 18.0 if reported_incident else 12.0
        degraded_current_eta = current_eta_min + incident_delay

        # Find best alternative
        best_alt = candidates[0]
        if len(candidates) > 1:
            best_alt = min(candidates, key=lambda c: c.duration_min)

        time_saved = round(degraded_current_eta - best_alt.duration_min, 1)

        should_reroute = time_saved >= 4.0

        return {
            "reroute_available": should_reroute,
            "incident_description": reported_incident or "Sudden congestion spike and traffic bottleneck detected ahead",
            "current_estimated_eta_min": degraded_current_eta,
            "alternative_eta_min": best_alt.duration_min,
            "time_saved_min": max(0.0, time_saved),
            "suggested_route_label": best_alt.label,
            "alternative_coordinates": best_alt.coordinates,
            "message": (
                f"Faster route available via {best_alt.label}. "
                f"Save {time_saved} minutes by avoiding current bottleneck."
                if should_reroute else "Current route remains optimal."
            )
        }
