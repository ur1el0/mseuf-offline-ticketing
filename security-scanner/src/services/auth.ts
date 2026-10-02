import { apiRequest, ApiError } from './apiClient';

export type UserRole = 'student' | 'security_staff' | 'administrator';

type User = {
  id: number;
  name: string;
  student_number: string | null;
  role: UserRole;
};

type LoginPayload = { token: string; user: User };
type UserPayload = { user: User };

export async function signInWithPassword(
  identifier: string,
  password: string,
  expectedRole: 'student' | 'security_staff',
) {
  const payload = await apiRequest<LoginPayload>('/auth/login', {
    method: 'POST',
    body: { identifier: identifier.trim(), password, device_name: 'euevent-mobile-client' },
  });

  if ((payload.user.role !== 'security_staff' && payload.user.role !== 'student')
    || payload.user.role !== expectedRole) {
    try {
      await apiRequest('/auth/logout', { method: 'POST', token: payload.token });
    } catch {
      // Keep the rejection message useful even if token cleanup cannot reach the API.
    }

    if (payload.user.role === 'administrator') {
      throw new Error('Administrators sign in through the desktop dashboard.');
    }

    throw new Error(payload.user.role === 'student'
      ? 'This is a student account. Choose Student access and sign in with your student number.'
      : 'This is a staff account. Choose Security Staff access and sign in with your staff email.');
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
