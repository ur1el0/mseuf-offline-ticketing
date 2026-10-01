import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { apiRequest } from '../services/apiClient';
import type { SecurityStaff } from '../types';

interface StaffListResponse {
  staff: SecurityStaff[];
}

interface StaffCreateResponse {
  staff: SecurityStaff;
}

interface SecurityStaffManagementProps {
  token: string;
}

export function SecurityStaffManagement({ token }: SecurityStaffManagementProps) {
  const [staff, setStaff] = useState<SecurityStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  useEffect(() => {
    let isCurrent = true;

    async function loadStaff(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiRequest<StaffListResponse>('/admin/security-staff', { token });
        if (isCurrent) {
          setStaff(result.staff);
        }
      } catch (cause) {
        if (isCurrent) {
          setError(cause instanceof Error ? cause.message : 'Could not load security staff.');
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadStaff();

    return () => {
      isCurrent = false;
    };
  }, [token]);

  async function createStaffAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (password !== passwordConfirmation) {
      setError('The passwords do not match.');
      return;
    }

    setIsSaving(true);

    try {
      const result = await apiRequest<StaffCreateResponse>('/admin/security-staff', {
        method: 'POST',
        token,
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          password_confirmation: passwordConfirmation,
        },
      });

      setStaff((current) => [...current, result.staff].sort((first, second) => first.name.localeCompare(second.name)));
      setName('');
      setEmail('');
      setPassword('');
      setPasswordConfirmation('');
      setNotice('Staff account created. Share the initial password with the staff member through your approved channel.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the staff account.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="staff-view" aria-labelledby="staff-page-title">
      <header className="dashboard-header staff-page-header">
        <div>
          <p className="eyebrow">ACCESS MANAGEMENT</p>
          <h1 id="staff-page-title">Security staff</h1>
          <p className="dashboard-subtitle">Create accounts for staff who use the offline scanner app.</p>
        </div>
        <div className="staff-total-pill"><Users size={16} /><span>{staff.length} accounts</span></div>
      </header>

      {error && <div className="notice notice--error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <div className="notice notice--success" role="status"><ShieldCheck size={18} /><span>{notice}</span></div>}

      <div className="staff-grid">
        <section className="surface-card panel staff-create-panel" aria-labelledby="staff-create-title">
          <div className="panel-heading">
            <div><span className="eyebrow">New account</span><h2 id="staff-create-title">Add security staff</h2></div>
            <span className="panel-icon"><UserPlus size={19} /></span>
          </div>
          <form className="staff-form" onSubmit={(event) => void createStaffAccount(event)}>
            <label htmlFor="staff-name">Full name</label>
            <input id="staff-name" autoComplete="name" maxLength={255} required value={name}
              onChange={(event) => setName(event.target.value)} />

            <label htmlFor="staff-email">Institutional email</label>
            <input id="staff-email" type="email" autoComplete="email" maxLength={255} required value={email}
              onChange={(event) => setEmail(event.target.value)} />

            <label htmlFor="staff-password">Initial password</label>
            <input id="staff-password" type="password" autoComplete="new-password" minLength={12} required value={password}
              onChange={(event) => setPassword(event.target.value)} />

            <label htmlFor="staff-password-confirmation">Confirm initial password</label>
            <input id="staff-password-confirmation" type="password" autoComplete="new-password" minLength={12} required value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)} />

            <p className="staff-form-hint">Use at least 12 characters. The scanner account is created with the Security Staff role.</p>
            <button className="button-primary staff-submit" type="submit" disabled={isSaving}>
              {isSaving ? <><Loader2 size={17} className="spin" /> Creating account…</> : <><UserPlus size={17} /> Create staff account</>}
            </button>
          </form>
        </section>

        <section className="surface-card panel staff-directory-panel" aria-labelledby="staff-directory-title">
          <div className="panel-heading">
            <div><span className="eyebrow">Scanner access</span><h2 id="staff-directory-title">Registered staff</h2></div>
            <span className="count-pill count-pill--amber">{staff.length} total</span>
          </div>

          {isLoading ? (
            <div className="staff-loading" role="status"><Loader2 size={20} className="spin" /> Loading staff accounts…</div>
          ) : staff.length > 0 ? (
            <ul className="staff-list">
              {staff.map((person) => (
                <li className="staff-list-item" key={person.id}>
                  <span className="staff-avatar">{person.name.trim().slice(0, 1).toUpperCase()}</span>
                  <span className="staff-person-copy"><strong>{person.name}</strong><span>{person.email}</span></span>
                  <span className="staff-role-badge"><ShieldCheck size={14} /> Staff</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="staff-empty-state">
              <span className="staff-empty-icon"><Users size={21} /></span>
              <strong>No staff accounts yet</strong>
              <p>Create a security-staff account to allow scanner sign-in.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
