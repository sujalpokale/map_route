import os
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from ml.data.synthetic_gen import generate_synthetic_trip_dataset


def train_and_evaluate_models():
    print("Generating synthetic training dataset...")
    df = generate_synthetic_trip_dataset(num_samples=8000)

    # Features
    categorical_cols = ["traffic_level", "weather_condition", "road_type", "vehicle_type"]
    numerical_cols = ["distance_km", "base_duration_min", "hour_of_day", "day_of_week", "is_rush_hour", "payload_kg"]

    X = df[categorical_cols + numerical_cols]
    y_eta = df["actual_duration_min"]
    y_fuel = df["actual_fuel_litres"]

    # Preprocessing pipeline
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numerical_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_cols)
        ]
    )

    X_train, X_test, y_eta_train, y_eta_test, y_fuel_train, y_fuel_test = train_test_split(
        X, y_eta, y_fuel, test_size=0.2, random_state=42
    )

    print("\n--- Training ETA Prediction Regressor (Gradient Boosting) ---")
    eta_pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", GradientBoostingRegressor(n_estimators=120, max_depth=5, learning_rate=0.08, random_state=42))
    ])
    eta_pipeline.fit(X_train, y_eta_train)

    y_eta_pred = eta_pipeline.predict(X_test)
    eta_mae = mean_absolute_error(y_eta_test, y_eta_pred)
    eta_rmse = np.sqrt(mean_squared_error(y_eta_test, y_eta_pred))
    eta_r2 = r2_score(y_eta_test, y_eta_pred)
    eta_mape = np.mean(np.abs((y_eta_test - y_eta_pred) / y_eta_test)) * 100

    print(f"ETA Model Metrics:")
    print(f"  MAE  : {eta_mae:.2f} minutes")
    print(f"  RMSE : {eta_rmse:.2f} minutes")
    print(f"  MAPE : {eta_mape:.2f}%")
    print(f"  R²   : {eta_r2:.4f}")

    print("\n--- Training Fuel Consumption Regressor (Random Forest) ---")
    fuel_pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42, n_jobs=-1))
    ])
    fuel_pipeline.fit(X_train, y_fuel_train)

    y_fuel_pred = fuel_pipeline.predict(X_test)
    fuel_mae = mean_absolute_error(y_fuel_test, y_fuel_pred)
    fuel_rmse = np.sqrt(mean_squared_error(y_fuel_test, y_fuel_pred))
    fuel_r2 = r2_score(y_fuel_test, y_fuel_pred)

    print(f"Fuel Model Metrics:")
    print(f"  MAE  : {fuel_mae:.3f} litres")
    print(f"  RMSE : {fuel_rmse:.3f} litres")
    print(f"  R²   : {fuel_r2:.4f}")

    # Save artifacts
    models_dir = os.path.join(os.path.dirname(__file__), "..", "models")
    os.makedirs(models_dir, exist_ok=True)

    eta_model_path = os.path.join(models_dir, "eta_model.joblib")
    fuel_model_path = os.path.join(models_dir, "fuel_model.joblib")

    joblib.dump(eta_pipeline, eta_model_path)
    joblib.dump(fuel_pipeline, fuel_model_path)
    print(f"\nModel artifacts successfully saved to {models_dir}")


if __name__ == "__main__":
    train_and_evaluate_models()
