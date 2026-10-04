import { sessionStorage } from './sessionStorage';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '')
  || 'http://localhost:8000/api/v1';

export function normalizeApiBaseUrl(value: string): string {
  const url = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/?#]+(?:\/[^?#]*)?$/i.test(url) || !url.endsWith('/api/v1')) {
    throw new Error('Enter a valid server URL ending in /api/v1.');
  }
  return url;
}

export async function getApiBaseUrl(): Promise<string> {
  const saved = await sessionStorage.readApiBaseUrl();
  return saved?.trim() ? normalizeApiBaseUrl(saved) : DEFAULT_API_BASE_URL;
}

export async function apiRequest<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; token?: string; body?: unknown; baseUrl?: string } = {},
): Promise<T> {
  const baseUrl = options.baseUrl ? normalizeApiBaseUrl(options.baseUrl) : await getApiBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });
  } catch {
    throw new Error('Could not reach the event server. Check the server address and network.');
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) {
    throw new ApiError(payload.message ?? `The server returned HTTP ${response.status}.`, response.status);
  }

  return payload as T;
}

export async function testApiConnection(value: string): Promise<string> {
  const url = normalizeApiBaseUrl(value);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);
  let response: Response;

  try {
    response = await fetch(url + '/auth/me', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch {
    throw new Error('Could not reach the server. Check the LAN address and firewall.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.ok || response.status === 401) return 'The EUEvent API is reachable.';

  throw new Error('The server responded with HTTP ' + response.status + '. Check that this is the EUEvent API URL.');
}
