import uuid
import datetime
import json
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship

from apps.api.app.db.session import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    vehicles = relationship("Vehicle", back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), default="USER")  # USER, DRIVER, FLEET_MANAGER, ADMIN
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    organization = relationship("Organization", back_populates="users")
    trips = relationship("Trip", back_populates="user", cascade="all, delete-orphan")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    license_plate = Column(String(50), nullable=True)
    vehicle_type = Column(String(50), default="CAR")  # BIKE, CAR, VAN, TRUCK, BUS, EV
    fuel_type = Column(String(50), default="PETROL")  # PETROL, DIESEL, CNG, ELECTRIC
    fuel_efficiency = Column(Float, default=15.0)  # km/L or km/kWh
    max_payload_kg = Column(Float, default=500.0)
    current_payload_kg = Column(Float, default=0.0)
    max_speed_kmh = Column(Float, default=100.0)
    battery_capacity_kwh = Column(Float, default=0.0)
    current_battery_pct = Column(Float, default=100.0)
    is_active = Column(Boolean, default=True)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    organization = relationship("Organization", back_populates="vehicles")
    trips = relationship("Trip", back_populates="vehicle")


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    license_number = Column(String(100), nullable=True)
    safety_score = Column(Float, default=95.0)
    status = Column(String(50), default="AVAILABLE")  # AVAILABLE, ON_TRIP, OFF_DUTY
    hourly_wage = Column(Float, default=150.0)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    trips = relationship("Trip", back_populates="driver")


class Trip(Base):
    __tablename__ = "trips"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    vehicle_id = Column(String(36), ForeignKey("vehicles.id"), nullable=True)
    driver_id = Column(String(36), ForeignKey("drivers.id"), nullable=True)

    status = Column(String(50), default="PLANNED")  # PLANNED, ACTIVE, COMPLETED, REROUTED, CANCELLED
    origin_name = Column(String(255), nullable=False)
    destination_name = Column(String(255), nullable=False)
    origin_lat = Column(Float, nullable=False)
    origin_lng = Column(Float, nullable=False)
    destination_lat = Column(Float, nullable=False)
    destination_lng = Column(Float, nullable=False)

    optimization_mode = Column(String(50), default="Balanced")
    planned_distance_km = Column(Float, default=0.0)
    planned_duration_min = Column(Float, default=0.0)
    actual_duration_min = Column(Float, nullable=True)
    planned_fuel_l = Column(Float, default=0.0)
    actual_fuel_l = Column(Float, nullable=True)
    planned_cost_inr = Column(Float, default=0.0)
    actual_cost_inr = Column(Float, nullable=True)

    selected_route_label = Column(String(100), default="Route A")
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="trips")
    vehicle = relationship("Vehicle", back_populates="trips")
    driver = relationship("Driver", back_populates="trips")
    waypoints = relationship("Waypoint", back_populates="trip", cascade="all, delete-orphan", order_by="Waypoint.sequence_order")
    evaluations = relationship("RouteEvaluation", back_populates="trip", cascade="all, delete-orphan")


class Waypoint(Base):
    __tablename__ = "waypoints"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    trip_id = Column(String(36), ForeignKey("trips.id"), nullable=False)
    sequence_order = Column(Integer, default=0)
    address = Column(String(255), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    package_weight_kg = Column(Float, default=10.0)
    time_window_start = Column(String(50), nullable=True)
    time_window_end = Column(String(50), nullable=True)
    delivery_status = Column(String(50), default="PENDING")  # PENDING, DELIVERED, FAILED
    priority = Column(Integer, default=1)  # 1 (Normal), 2 (High), 3 (Urgent)

    trip = relationship("Trip", back_populates="waypoints")


class RouteEvaluation(Base):
    __tablename__ = "route_evaluations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    trip_id = Column(String(36), ForeignKey("trips.id"), nullable=True)
    route_label = Column(String(100), nullable=False)
    polyline = Column(Text, nullable=False)  # Encoded polyline or GeoJSON string
    distance_km = Column(Float, nullable=False)
    duration_min = Column(Float, nullable=False)
    fuel_consumption_l = Column(Float, default=0.0)
    estimated_cost = Column(Float, default=0.0)
    traffic_delay_min = Column(Float, default=0.0)
    overall_score = Column(Float, default=0.0)
    sub_scores_json = Column(Text, default="{}")  # JSON string of individual scores
    recommendation_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    trip = relationship("Trip", back_populates="evaluations")


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    title = Column(String(255), default="Route Inquiry")
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="AIMessage.created_at")


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("ai_conversations.id"), nullable=False)
    role = Column(String(50), nullable=False)  # user, assistant, system, tool
    content = Column(Text, nullable=False)
    tool_calls_json = Column(Text, nullable=True)
    tool_results_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    conversation = relationship("AIConversation", back_populates="messages")
