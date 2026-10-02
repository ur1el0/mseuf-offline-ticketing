import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ApiError, DEFAULT_API_BASE_URL, normalizeApiBaseUrl } from '../services/apiClient';
import { fetchCurrentUser, signInWithPassword, signOutFromApi, type User } from '../services/auth';
import { clearOfflineGateManifests } from '../services/offlineManifestStore';
import { sessionStorage } from '../services/sessionStorage';

type SecuritySession = {
  user: User | null;
  token: string | null;
  serverUrl: string;
  isRestoring: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateServerUrl: (url: string) => Promise<boolean>;
};

const SecuritySessionContext = createContext<SecuritySession | null>(null);

export function SecuritySessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState(DEFAULT_API_BASE_URL);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [savedUrl, savedToken, savedUser] = await Promise.all([
          sessionStorage.readApiBaseUrl(),
          sessionStorage.readToken(),
          sessionStorage.readUser(),
        ]);
        if (active && savedUrl) setServerUrl(normalizeApiBaseUrl(savedUrl));
        if (savedToken) {
          try {
            const payload = await fetchCurrentUser(savedToken);
            if (active && payload.user.role === 'security_staff') {
              await sessionStorage.saveUser(payload.user);
              setToken(savedToken);
              setUser(payload.user);
            } else if (active) {
              await Promise.all([sessionStorage.clearToken(), sessionStorage.clearUser()]);
              await clearOfflineGateManifests().catch(() => undefined);
            }
          } catch (error) {
            if (active && error instanceof ApiError && error.status === 401) {
              await Promise.all([sessionStorage.clearToken(), sessionStorage.clearUser()]);
              await clearOfflineGateManifests().catch(() => undefined);
            } else if (active
              && (!(error instanceof ApiError) || error.status >= 500)
              && savedUser?.role === 'security_staff') {
              setToken(savedToken);
              setUser(savedUser);
            }
          }
        }
      } catch {
        // Keep the app on the sign-in screen if secure storage cannot be read.
      } finally {
        if (active) setIsRestoring(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const payload = await signInWithPassword(email, password);
    await Promise.all([
      sessionStorage.saveToken(payload.token),
      sessionStorage.saveUser(payload.user),
    ]);
    setToken(payload.token);
    setUser(payload.user);
  }, []);

  const signOut = useCallback(async () => {
    const currentToken = token;
    setUser(null);
    setToken(null);
    try {
      if (currentToken) await signOutFromApi(currentToken);
    } catch {
      // Clear the local session even when the event server cannot be reached.
    } finally {
      await Promise.all([sessionStorage.clearToken(), sessionStorage.clearUser()]);
      await clearOfflineGateManifests().catch(() => undefined);
    }
  }, [token]);

  const updateServerUrl = useCallback(async (value: string) => {
    const nextUrl = normalizeApiBaseUrl(value);
    if (nextUrl === serverUrl) return false;

    // A Sanctum token belongs to the server that issued it.
    await sessionStorage.saveApiBaseUrl(nextUrl);
    await Promise.all([sessionStorage.clearToken(), sessionStorage.clearUser()]);
    await clearOfflineGateManifests().catch(() => undefined);
    setServerUrl(nextUrl);
    setToken(null);
    setUser(null);
    return true;
  }, [serverUrl]);

  return (
    <SecuritySessionContext.Provider value={{ user, token, serverUrl, isRestoring, signIn, signOut, updateServerUrl }}>
      {children}
    </SecuritySessionContext.Provider>
  );
}

export function useSecuritySession() {
  const context = useContext(SecuritySessionContext);
  if (!context) throw new Error('useSecuritySession must be used inside SecuritySessionProvider.');
  return context;
}
