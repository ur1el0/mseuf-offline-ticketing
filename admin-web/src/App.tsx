import { AdminDashboard } from './components/AdminDashboard';
import { LoginPage } from './components/LoginPage';
import { useAdminAuth } from './hooks/useAdminAuth';

export default function App() {
  const { session, isSigningOut, signIn, signOut } = useAdminAuth();
  if (!session) return <LoginPage onLogin={signIn} />;
  return <AdminDashboard session={session} onSignOut={signOut} isSigningOut={isSigningOut} />;
}
