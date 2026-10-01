import { apiRequest } from './apiClient';

export type AssignedGate = {
  gate_id: number;
  gate_code: string;
  gate_name: string;
  event_id: number;
  event_name: string;
  event_status: 'draft' | 'scheduled' | 'in_progress' | 'postponed' | 'cancelled' | 'completed';
  starts_at: string;
  ends_at: string;
  manifest_version: number;
  ticket_count: number;
};

export async function fetchAssignedGates(token: string): Promise<AssignedGate[]> {
  const response = await apiRequest<{ assignments: AssignedGate[] }>('/staff/gates', { token });
  return response.assignments;
}
