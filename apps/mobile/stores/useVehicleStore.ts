import { create } from 'zustand';
import { VehicleProfile, VehicleType, FuelType } from '@/types';

interface VehicleState {
  vehicles: VehicleProfile[];
  selectedVehicleId: string;
  isLoading: boolean;

  getSelectedVehicle: () => VehicleProfile;
  selectVehicle: (id: string) => void;
  addVehicle: (vehicle: VehicleProfile) => void;
  updateVehicleEconomics: (id: string, efficiency_kmpl: number, fuel_price_inr: number) => void;
  resetVehicles: () => void;
  updateBattery: (pct: number) => void;
}

const DEFAULT_VEHICLES: VehicleProfile[] = [
  {
    id: 'veh_bike_01',
    name: 'Hero Splendor / Pulsar (Two-Wheeler)',
    vehicle_type: 'BIKE',
    fuel_type: 'PETROL',
    license_plate: 'MH 12 BK 3321',
    efficiency_kmpl: 45.0,
    fuel_price_inr: 105.0,
    curb_weight_kg: 118,
    max_payload_kg: 140,
    is_default: false,
  },
  {
    id: 'veh_car_02',
    name: 'Hyundai i20 Turbo (Personal Car)',
    vehicle_type: 'CAR',
    fuel_type: 'PETROL',
    license_plate: 'MH 12 AB 9081',
    efficiency_kmpl: 16.5,
    fuel_price_inr: 105.0,
    curb_weight_kg: 1080,
    max_payload_kg: 400,
    is_default: true,
  },
  {
    id: 'veh_truck_03',
    name: 'Ashok Leyland Ecomet (Heavy Truck)',
    vehicle_type: 'TRUCK',
    fuel_type: 'DIESEL',
    license_plate: 'MH 12 QX 1109',
    efficiency_kmpl: 5.5,
    fuel_price_inr: 92.5,
    curb_weight_kg: 4200,
    max_payload_kg: 7500,
    is_default: false,
  },
  {
    id: 'veh_bus_04',
    name: 'Tata Starbus Urban (Transit Coach)',
    vehicle_type: 'BUS',
    fuel_type: 'DIESEL',
    license_plate: 'MH 14 TR 7810',
    efficiency_kmpl: 4.8,
    fuel_price_inr: 92.5,
    curb_weight_kg: 6800,
    max_payload_kg: 4500,
    is_default: false,
  },
  {
    id: 'veh_ev_05',
    name: 'Tata Nexon EV Long Range',
    vehicle_type: 'EV',
    fuel_type: 'ELECTRIC',
    license_plate: 'MH 12 GR 7720',
    efficiency_kmpl: 7.2, // km/kWh equivalent
    fuel_price_inr: 9.0, // INR / kWh
    curb_weight_kg: 1400,
    max_payload_kg: 450,
    ev_battery_capacity_kwh: 40.5,
    ev_current_battery_pct: 84,
    ev_range_km: 312,
    is_default: false,
  },
];

export const useVehicleStore = create<VehicleState>((set, get) => ({
  vehicles: DEFAULT_VEHICLES,
  selectedVehicleId: 'veh_car_02',
  isLoading: false,

  getSelectedVehicle: () => {
    const { vehicles, selectedVehicleId } = get();
    return vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];
  },

  selectVehicle: (id) => set({ selectedVehicleId: id }),

  addVehicle: (vehicle) =>
    set((state) => ({ vehicles: [...state.vehicles, vehicle] })),

  updateVehicleEconomics: (id, efficiency_kmpl, fuel_price_inr) =>
    set((state) => ({
      vehicles: state.vehicles.map((vehicle) =>
        vehicle.id === id ? { ...vehicle, efficiency_kmpl, fuel_price_inr } : vehicle
      ),
    })),

  resetVehicles: () => set({ vehicles: DEFAULT_VEHICLES, selectedVehicleId: 'veh_car_02' }),

  updateBattery: (pct) =>
    set((state) => ({
      vehicles: state.vehicles.map((v) =>
        v.id === state.selectedVehicleId ? { ...v, ev_current_battery_pct: pct } : v
      ),
    })),
}));
