import { apiRequest, ApiError } from './apiClient';

type User = {
  id: number;
  name: string;
  student_number: string | null;
  role: string;
};

type LoginPayload = { token: string; user: User };
type UserPayload = { user: User };

export async function signInWithPassword(email: string, password: string) {
  const payload = await apiRequest<LoginPayload>('/auth/login', {
    method: 'POST',
    body: { identifier: email.trim(), password, device_name: 'euevent-security-scanner' },
  });

  if (payload.user.role !== 'security_staff') {
    try {
      await apiRequest('/auth/logout', { method: 'POST', token: payload.token });
    } catch {
      // Keep the rejection message useful even if token cleanup cannot reach the API.
    }
    throw new Error('This account is not assigned the Security Staff role.');
  }

  return payload;
}

export async function fetchCurrentUser(token: string) {
  return apiRequest<UserPayload>('/auth/me', { token });
}

export async function signOutFromApi(token: string) {
  try {
    await apiRequest('/auth/logout', { method: 'POST', token });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error;
  }
}

export type { User };
