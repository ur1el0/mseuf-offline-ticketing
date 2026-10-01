import { apiRequest, ApiError } from './apiClient';
import type { AuthSession, User } from '../types';

interface LoginResponse {
  token: string;
  user: User;
}

export async function authenticate(identifier: string, password: string): Promise<AuthSession> {
  const result = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { identifier, password, device_name: 'euevent-admin-web' },
  });

  if (result.user.role !== 'administrator') {
    try {
      await apiRequest('/auth/logout', { method: 'POST', token: result.token });
    } catch {
      throw new Error('This dashboard requires an administrator account. Ask an administrator to revoke this device session.');
    }
    throw new Error('This dashboard is for administrator accounts.');
  }

  return { token: result.token, user: result.user };
}

export async function signOut(token: string): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST', token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return;
    throw error;
  }
}
