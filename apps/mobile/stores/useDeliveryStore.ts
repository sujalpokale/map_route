import { create } from 'zustand';
import { DeliveryPriority, DeliveryStatus } from '@/types';

export interface DeliveryManifestItem {
  id: string;
  tracking_number: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  lat: number;
  lng: number;
  time_window: string;
  priority: DeliveryPriority;
  status: DeliveryStatus;
  package_type: string;
  weight_kg: number;
  proof_signature?: string;
  proof_photo_url?: string;
  delivery_notes?: string;
  completed_at?: string;
}

interface DeliveryState {
  deliveries: DeliveryManifestItem[];
  selectedDeliveryId: string | null;

  updateDeliveryStatus: (id: string, status: DeliveryStatus, proof?: { photoUrl?: string; signature?: string; notes?: string }) => void;
  selectDelivery: (id: string | null) => void;
  addDeliveryFromOCR: (item: Partial<DeliveryManifestItem>) => void;
}

const INITIAL_DELIVERIES: DeliveryManifestItem[] = [
  {
    id: 'del_01',
    tracking_number: 'AERO-77129-IN',
    customer_name: 'Rahul Deshmukh',
    customer_phone: '+91 98220 12345',
    address: 'High Street Business Center, 4th Floor, Baner, Pune',
    lat: 18.559,
    lng: 73.7868,
    time_window: '10:00 AM – 12:00 PM',
    priority: 'URGENT',
    status: 'EN_ROUTE',
    package_type: 'Express Medical / Perishable',
    weight_kg: 3.5,
  },
  {
    id: 'del_02',
    tracking_number: 'AERO-88431-IN',
    customer_name: 'Priya Kulkarni',
    customer_phone: '+91 97654 88712',
    address: 'Ganesh Imperial Towers, B-Wing 902, Wakad, Pune',
    lat: 18.598,
    lng: 73.765,
    time_window: '11:30 AM – 01:30 PM',
    priority: 'NORMAL',
    status: 'PENDING',
    package_type: 'Consumer Electronics Box',
    weight_kg: 8.2,
  },
  {
    id: 'del_03',
    tracking_number: 'AERO-99320-IN',
    customer_name: 'Anand Sharma (Tech Corp)',
    customer_phone: '+91 99231 66540',
    address: 'Quadron Business Park, Phase 2, Hinjewadi, Pune',
    lat: 18.5987,
    lng: 73.7178,
    time_window: '02:00 PM – 04:00 PM',
    priority: 'HIGH',
    status: 'PENDING',
    package_type: 'Server Hardware Enclosure',
    weight_kg: 22.0,
  },
];

export const useDeliveryStore = create<DeliveryState>((set) => ({
  deliveries: INITIAL_DELIVERIES,
  selectedDeliveryId: 'del_01',

  updateDeliveryStatus: (id, status, proof) => {
    set((state) => ({
      deliveries: state.deliveries.map((d) =>
        d.id === id
          ? {
              ...d,
              status,
              proof_photo_url: proof?.photoUrl || d.proof_photo_url,
              proof_signature: proof?.signature || d.proof_signature,
              delivery_notes: proof?.notes || d.delivery_notes,
              completed_at: status === 'COMPLETED' ? new Date().toLocaleTimeString() : d.completed_at,
            }
          : d
      ),
    }));
  },

  selectDelivery: (id) => set({ selectedDeliveryId: id }),

  addDeliveryFromOCR: (item) => {
    const newDelivery: DeliveryManifestItem = {
      id: `del_${Date.now()}`,
      tracking_number: `AERO-${Math.floor(10000 + Math.random() * 90000)}-IN`,
      customer_name: item.customer_name || 'Recipient from Invoice',
      customer_phone: item.customer_phone || '+91 98000 00000',
      address: item.address || 'Scanned Waybill Address',
      lat: item.lat || 18.5204,
      lng: item.lng || 73.8567,
      time_window: '01:00 PM – 03:00 PM',
      priority: item.priority || 'HIGH',
      status: 'PENDING',
      package_type: item.package_type || 'Commercial Parcel',
      weight_kg: item.weight_kg || 5.0,
    };
    set((state) => ({ deliveries: [...state.deliveries, newDelivery] }));
  },
}));
