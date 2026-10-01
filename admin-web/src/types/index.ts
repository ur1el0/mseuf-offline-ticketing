export type UserRole = 'student' | 'security_staff' | 'administrator';

export interface User {
  id: number;
  name: string;
  student_number: string | null;
  role: UserRole;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface GateMetric {
  gate_id: number;
  name: string | null;
  admitted: number;
  capacity: number | null;
}

export interface Anomaly {
  id: number;
  ticket_id: number;
  anomaly_type: string;
  device_id: string;
  server_received_at: string | null;
}

export interface AdminMetrics {
  total_issued: number;
  total_admitted: number;
  pending_sync_estimate: number | null;
  gates: GateMetric[];
  anomalies_count: number;
  recent_anomalies: Anomaly[];
}
