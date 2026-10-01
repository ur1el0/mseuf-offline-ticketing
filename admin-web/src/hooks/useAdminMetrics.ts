import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, ApiError } from '../services/apiClient';
import type { AdminMetrics } from '../types';

interface MetricsState {
  data: AdminMetrics | null;
  error: string | null;
  isLoading: boolean;
  updatedAt: Date | null;
}

export function useAdminMetrics(token: string) {
  const [state, setState] = useState<MetricsState>({ data: null, error: null, isLoading: true, updatedAt: null });
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const data = await apiRequest<AdminMetrics>('/admin/metrics', { token });
      setState({ data, error: null, isLoading: false, updatedAt: new Date() });
    } catch (error) {
      const message = error instanceof ApiError && error.status === 401
        ? 'Your administrator session expired. Sign in again.'
        : error instanceof Error ? error.message : 'Unable to refresh dashboard data.';
      setState((current) => ({ ...current, error: message, isLoading: false }));
    } finally {
      inFlight.current = false;
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { ...state, refresh };
}
