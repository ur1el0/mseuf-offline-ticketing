import { useCallback, useState } from 'react';
import { authenticate, signOut } from '../services/auth';
import type { AuthSession } from '../types';

export function useAdminAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const next = await authenticate(identifier, password);
    setSession(next);
  }, []);

  const signOutUser = useCallback(async () => {
    if (!session) return;
    setIsSigningOut(true);
    try {
      await signOut(session.token);
      setSession(null);
    } finally {
      setIsSigningOut(false);
    }
  }, [session]);

  return { session, isSigningOut, signIn, signOut: signOutUser };
}
