import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ApiError, DEFAULT_API_BASE_URL, normalizeApiBaseUrl } from '../services/apiClient';
import { fetchCurrentUser, signInWithPassword, signOutFromApi, type User } from '../services/auth';
import { clearOfflineGateManifests } from '../services/offlineManifestStore';
import { clearStudentTicketCache } from '../services/studentTicketStorage';
import { sessionStorage } from '../services/sessionStorage';

type SecuritySession = {
  user: User | null;
  token: string | null;
  serverUrl: string;
  isRestoring: boolean;
  signIn: (identifier: string, password: string, expectedRole: 'student' | 'security_staff') => Promise<void>;
  signOut: () => Promise<void>;
  updateServerUrl: (url: string) => Promise<boolean>;
};

const SecuritySessionContext = createContext<SecuritySession | null>(null);

function isMobileRole(role: string): boolean {
  return role === 'security_staff' || role === 'student';
}

export function SecuritySessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState(DEFAULT_API_BASE_URL);
  const [isRestoring, setIsRestoring] = useState(true);
  const sessionTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [savedUrl, savedToken, savedUser] = await Promise.all([
          sessionStorage.readApiBaseUrl(),
          sessionStorage.readToken(),
          sessionStorage.readUser(),
        ]);
        const restoredServerUrl = savedUrl ? normalizeApiBaseUrl(savedUrl) : DEFAULT_API_BASE_URL;

        if (active) {
          sessionTokenRef.current = savedToken;
          setServerUrl(restoredServerUrl);

          if (savedToken && savedUser && isMobileRole(savedUser.role)) {
            setToken(savedToken);
            setUser(savedUser);
            setIsRestoring(false);
          } else if (!savedToken) {
            setIsRestoring(false);
          }
        }

        if (savedToken) {
          try {
            const payload = await fetchCurrentUser(savedToken);
            if (!active || sessionTokenRef.current !== savedToken) return;

            if (isMobileRole(payload.user.role)) {
              await sessionStorage.saveUser(payload.user);
              if (!active || sessionTokenRef.current !== savedToken) return;
              setToken(savedToken);
              setUser(payload.user);
            } else {
              sessionTokenRef.current = null;
              setToken(null);
              setUser(null);
              await Promise.all([sessionStorage.clearToken(), sessionStorage.clearUser()]);
              await clearOfflineGateManifests().catch(() => undefined);
              if (savedUser?.role === 'student') {
                await clearStudentTicketCache(restoredServerUrl, savedUser.id).catch(() => undefined);
              }
            }
          } catch (error) {
            if (!active || sessionTokenRef.current !== savedToken) return;

            if (error instanceof ApiError && error.status === 401) {
              sessionTokenRef.current = null;
              setToken(null);
              setUser(null);
              await Promise.all([sessionStorage.clearToken(), sessionStorage.clearUser()]);
              await clearOfflineGateManifests().catch(() => undefined);
              if (savedUser?.role === 'student') {
                await clearStudentTicketCache(restoredServerUrl, savedUser.id).catch(() => undefined);
              }
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

  const signIn = useCallback(async (identifier: string, password: string, expectedRole: 'student' | 'security_staff') => {
    const payload = await signInWithPassword(identifier, password, expectedRole);
    await Promise.all([
      sessionStorage.saveToken(payload.token),
      sessionStorage.saveUser(payload.user),
    ]);
    sessionTokenRef.current = payload.token;
    setToken(payload.token);
    setUser(payload.user);
  }, []);

  const signOut = useCallback(async () => {
    const currentToken = token;
    const currentUser = user;
    sessionTokenRef.current = null;
    setUser(null);
    setToken(null);
    try {
      if (currentToken) await signOutFromApi(currentToken);
    } catch {
      // Clear the local session even when the event server cannot be reached.
    } finally {
      await Promise.all([sessionStorage.clearToken(), sessionStorage.clearUser()]);
      await clearOfflineGateManifests().catch(() => undefined);
      if (currentUser?.role === 'student') {
        await clearStudentTicketCache(serverUrl, currentUser.id).catch(() => undefined);
      }
    }
  }, [serverUrl, token, user]);

  const updateServerUrl = useCallback(async (value: string) => {
    const nextUrl = normalizeApiBaseUrl(value);
    if (nextUrl === serverUrl) return false;

    // A Sanctum token belongs to the server that issued it.
    await sessionStorage.saveApiBaseUrl(nextUrl);
    sessionTokenRef.current = null;
    await Promise.all([sessionStorage.clearToken(), sessionStorage.clearUser()]);
    await clearOfflineGateManifests().catch(() => undefined);
    if (user?.role === 'student') {
      await clearStudentTicketCache(serverUrl, user.id).catch(() => undefined);
    }
    setServerUrl(nextUrl);
    setToken(null);
    setUser(null);
    return true;
  }, [serverUrl, user]);

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
