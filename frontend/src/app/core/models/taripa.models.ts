// ─── Fare Models ──────────────────────────────────────────────────
export interface FareOrdinance {
  id: number;
  ordinance_no: string;
  lgu: string;
  effective_date: string;
  base_fare: number;
  per_km_rate: number;
  min_fare: number;
  passenger_type: 'regular' | 'student' | 'senior' | 'pwd';
  notes: string;
  is_active: boolean;
}

export interface FareCalculationRequest {
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  passenger_type?: 'regular' | 'student' | 'senior' | 'pwd' | 'solo_parent';
  origin_name?: string;
  dest_name?: string;
  /** Actual road distance in km from OSRM; if provided, used instead of haversine */
  road_distance_km?: number;
}

export interface ExactChangeDenom {
  denom: number;
  count: number;
}

export interface FareCalculationResult {
  calculation_id: number;
  ordinance_no: string;
  lgu: string;
  passenger_type: string;
  distance_km: number;
  succeeding_km: number;
  base_fare: number;
  per_km_rate: number;
  computed_fare: number;
  regular_fare: number | null;
  discount_amount: number | null;
  exact_change: ExactChangeDenom[];
  origin_name: string;
  dest_name: string;
  ordinance_cite: string;
  generated_at: string;
}

// ─── Terminal / Bantay Batas ──────────────────────────────────────
export interface Terminal {
  id: number;
  name: string;
  lat: number;
  lng: number;
  barangay: string;
  radius_m: number;
  reports_last_7d: number;
}

// ─── Driver / Pasaway Models ──────────────────────────────────────
export interface TricycleReport {
  id: number;
  reported_fare: number;
  calculated_fare: number;
  overcharge_amount: number;
  origin_name: string;
  destination_name: string;
  distance_km: number;
  reported_at: string;
  description: string;
  passenger_count: number;
}

export interface DriverStats {
  total_reports: number;
  total_overcharge: number;
  avg_overcharge: number;
  last_reported: string;
}

export interface DriverLookupResult {
  body_number: string;
  toda_name: string | null;
  flagged: boolean;
  report_count_30d: number;
  stats: DriverStats;
  recent_reports: TricycleReport[];
}

// ─── Report Submission ────────────────────────────────────────────
export interface ReportSubmission {
  body_number: string;
  reported_fare: number;
  calculated_fare: number;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  origin_name?: string;
  destination_name?: string;
  distance_km?: number;
  passenger_count?: number;
  description?: string;
  user_current_lat?: number;
  user_current_lng?: number;
}

// ─── Safe Ride ────────────────────────────────────────────────────
export interface SafeRidePayload {
  body_number?: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  origin_name?: string;
  destination_name?: string;
  trusted_contact_name?: string;
  trusted_contact_phone?: string;
}

// ─── Auth ─────────────────────────────────────────────────────────
export interface User {
  id: number;
  email: string;
  display_name: string;
  role: 'commuter' | 'admin';
  account_age: number;
  trusted_contact_name?: string;
  trusted_contact_phone?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ─── GPS ──────────────────────────────────────────────────────────
export interface LatLng {
  lat: number;
  lng: number;
}

// ─── Resibo History ───────────────────────────────────────────────
export interface ResiboHistory {
  id: number;
  passenger_type: string;
  origin_name: string;
  dest_name: string;
  distance_km: number;
  computed_fare: number;
  resibo_generated: boolean;
  created_at: string;
}

// ─── Admin ────────────────────────────────────────────────────────
export interface AdminStats {
  total_users: number;
  total_reports: number;
  pending_reports: number;
  total_calcs: number;
  active_terminals: number;
  flagged_tricycles: number;
  recent_reports: AdminReport[];
  daily_reports_7d?: { date: string; count: number }[];
}

export interface AdminReport {
  id: number;
  body_number: string;
  reported_fare: number;
  calculated_fare: number;
  overcharge_amount: number;
  origin_name: string;
  destination_name: string;
  distance_km: number;
  passenger_count: number;
  description: string;
  status: 'pending' | 'approved' | 'dismissed';
  gps_validated: boolean;
  reported_at: string;
  display_name: string;
  email: string;
}

export interface AdminUser {
  id: number;
  email: string;
  display_name: string;
  role: string;
  account_age: number;
  created_at: string;
  report_count: number;
  calc_count: number;
}

export interface AdminTerminal {
  id: number;
  name: string;
  lat: number;
  lng: number;
  barangay: string;
  radius_m: number;
  active: boolean;
  reports_last_7d: number;
}

export interface PtroReport {
  id: number;
  sent_at: string;
  period_start: string;
  period_end: string;
  report_count: number;
  recipient_email: string;
}
