import { useState, type FormEvent } from 'react';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';

export function LoginPage({ onLogin }: { onLogin: (identifier: string, password: string) => Promise<void> }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onLogin(identifier.trim(), password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-brand-panel">
        <img src="/brand/euevent-512.png" alt="EUEvent" className="login-brand-mark" />
        <div>
          <p className="login-kicker">MSEUF event operations</p>
          <h1>Every gate, in sync.</h1>
          <p className="login-brand-copy">A clear view of admissions, gate activity, and event operations.</p>
        </div>
        <span className="login-brand-footer">EUEvent · Administrator portal</span>
      </section>
      <section className="login-form-panel">
        <div className="login-card surface-card">
          <div className="login-card__heading">
            <img src="/brand/euevent-192.png" alt="" /><span>Administrator sign in</span>
          </div>
          <h2>Welcome back</h2>
          <p className="login-instructions">Use your institutional administrator account.</p>
          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="identifier">Institutional email</label>
            <div className="input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input id="identifier" type="email" autoComplete="username" placeholder="name@mseuf.edu.ph"
                value={identifier} onChange={(event) => setIdentifier(event.target.value)} required />
            </div>
            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input id="password" type="password" autoComplete="current-password" placeholder="Enter your password"
                value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button-primary login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>
          <p className="login-security-note">Only administrator accounts can access this dashboard.</p>
        </div>
      </section>
    </main>
  );
}
