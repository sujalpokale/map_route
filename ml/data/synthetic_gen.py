import numpy as np
import pandas as pd
import random
import os

np.random.seed(42)
random.seed(42)


def generate_synthetic_trip_dataset(num_samples: int = 5000) -> pd.DataFrame:
    """
    Generates a realistic historical transportation dataset.
    Features:
      - distance_km (2 to 120 km)
      - base_duration_min
      - traffic_level (Low, Moderate, High, Severe)
      - weather_condition (Clear, Rain, Heavy Rain, Fog)
      - road_type (highway, arterial, urban, mixed)
      - hour_of_day (0 to 23)
      - day_of_week (0 to 6)
      - vehicle_type (BIKE, CAR, VAN, TRUCK, EV)
      - payload_kg
      - actual_duration_min (target 1)
      - actual_fuel_litres (target 2)
    """
    distances = np.random.exponential(scale=22.0, size=num_samples) + 3.0
    distances = np.clip(distances, 2.0, 150.0)

    hours = np.random.randint(0, 24, size=num_samples)
    days = np.random.randint(0, 7, size=num_samples)

    road_types = np.random.choice(["highway", "arterial", "urban", "mixed"], size=num_samples, p=[0.35, 0.30, 0.20, 0.15])
    weather_conds = np.random.choice(["Clear", "Rain", "Heavy Rain", "Fog"], size=num_samples, p=[0.70, 0.18, 0.07, 0.05])
    vehicle_types = np.random.choice(["BIKE", "CAR", "VAN", "TRUCK", "EV"], size=num_samples, p=[0.15, 0.45, 0.20, 0.15, 0.05])

    data = []

    for i in range(num_samples):
        dist = distances[i]
        hr = hours[i]
        day = days[i]
        road = road_types[i]
        weather = weather_conds[i]
        veh = vehicle_types[i]

        # Is rush hour? (8-10 AM or 5-8 PM on weekdays)
        is_rush = (day < 5) and (8 <= hr <= 10 or 17 <= hr <= 20)

        # Traffic determination
        if is_rush:
            traffic = np.random.choice(["Moderate", "High", "Severe"], p=[0.3, 0.5, 0.2])
        else:
            traffic = np.random.choice(["Low", "Moderate", "High"], p=[0.65, 0.25, 0.10])

        traffic_multiplier = {"Low": 1.0, "Moderate": 1.25, "High": 1.60, "Severe": 2.10}[traffic]
        weather_delay_pct = {"Clear": 0.0, "Rain": 0.12, "Heavy Rain": 0.30, "Fog": 0.22}[weather]

        # Free-flow average speeds by road type
        speed_map = {"highway": 75.0, "arterial": 45.0, "urban": 28.0, "mixed": 48.0}
        base_speed = speed_map[road]

        # Vehicle max speed cap
        if veh == "TRUCK":
            base_speed = min(base_speed, 55.0)
        elif veh == "BIKE":
            base_speed = min(base_speed, 45.0)

        base_duration = (dist / base_speed) * 60.0

        # Target: actual duration with stochastic noise
        actual_duration = base_duration * traffic_multiplier * (1.0 + weather_delay_pct)
        actual_duration += np.random.normal(loc=0, scale=max(actual_duration * 0.05, 1.0))
        actual_duration = max(actual_duration, 2.0)

        # Payload determination
        max_load_map = {"BIKE": 20.0, "CAR": 250.0, "VAN": 1200.0, "TRUCK": 8000.0, "EV": 300.0}
        payload = np.random.uniform(0.0, max_load_map[veh])

        # Fuel consumption modeling
        base_eff_map = {"BIKE": 45.0, "CAR": 16.0, "VAN": 12.0, "TRUCK": 4.5, "EV": 6.5}
        base_eff = base_eff_map[veh]
        eff_drop = (traffic_multiplier - 1.0) * 0.25 + (payload / max_load_map[veh]) * 0.15
        actual_eff = base_eff * max(0.45, (1.0 - eff_drop))
        actual_fuel = dist / actual_eff
        actual_fuel += np.random.normal(loc=0, scale=max(actual_fuel * 0.03, 0.05))
        actual_fuel = max(actual_fuel, 0.1)

        data.append({
            "distance_km": round(dist, 2),
            "base_duration_min": round(base_duration, 1),
            "traffic_level": traffic,
            "weather_condition": weather,
            "road_type": road,
            "hour_of_day": hr,
            "day_of_week": day,
            "is_rush_hour": 1 if is_rush else 0,
            "vehicle_type": veh,
            "payload_kg": round(payload, 1),
            "actual_duration_min": round(actual_duration, 1),
            "actual_fuel_litres": round(actual_fuel, 2)
        })

    df = pd.DataFrame(data)
    return df


if __name__ == "__main__":
    os.makedirs("ml/data/raw", exist_ok=True)
    df = generate_synthetic_trip_dataset(6000)
    out_path = "ml/data/raw/historical_trips.csv"
    df.to_csv(out_path, index=False)
    print(f"Generated {len(df)} synthetic trip records to {out_path}")
