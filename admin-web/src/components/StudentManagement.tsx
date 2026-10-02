import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, GraduationCap, Loader2, Search, UserPlus, Users } from 'lucide-react';
import { apiRequest } from '../services/apiClient';

interface StudentAccount {
  id: number;
  name: string;
  email: string;
  student_number: string;
  created_at: string | null;
}

interface StudentPage {
  students: StudentAccount[];
  meta: {
    current_page: number;
    per_page: number;
    last_page: number;
    total: number;
  };
}

interface StudentCreateResponse {
  student: StudentAccount;
}

interface StudentManagementProps {
  token: string;
}

const PAGE_SIZE = 25;

export function StudentManagement({ token }: StudentManagementProps) {
  const [students, setStudents] = useState<StudentAccount[]>([]);
  const [meta, setMeta] = useState<StudentPage['meta'] | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  useEffect(() => {
    let isCurrent = true;

    async function loadStudents(): Promise<void> {
      setIsLoading(true);
      setError(null);
      const query = new URLSearchParams({ page: String(page), per_page: String(PAGE_SIZE) });
      if (activeSearch) query.set('search', activeSearch);

      try {
        const result = await apiRequest<StudentPage>('/admin/students?' + query.toString(), { token });
        if (isCurrent) {
          setStudents(result.students);
          setMeta(result.meta);
        }
      } catch (cause) {
        if (isCurrent) setError(cause instanceof Error ? cause.message : 'Could not load student accounts.');
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    void loadStudents();
    return () => { isCurrent = false; };
  }, [token, page, activeSearch]);

  function searchStudents(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPage(1);
    setActiveSearch(searchInput.trim());
  }

  async function createStudentAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (password !== passwordConfirmation) {
      setError('The passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await apiRequest<StudentCreateResponse>('/admin/students', {
        method: 'POST',
        token,
        body: {
          name: name.trim(),
          student_number: studentNumber.trim(),
          email: email.trim().toLowerCase(),
          password,
          password_confirmation: passwordConfirmation,
        },
      });

      setName('');
      setStudentNumber('');
      setEmail('');
      setPassword('');
      setPasswordConfirmation('');
      setNotice('Student account created. Share its initial password through your approved private channel.');

      if (activeSearch || page !== 1) {
        setSearchInput('');
        setActiveSearch('');
        setPage(1);
      } else {
        setStudents((current) => [result.student, ...current.filter((student) => student.id !== result.student.id)]
          .sort((first, second) => first.name.localeCompare(second.name))
          .slice(0, PAGE_SIZE));
        setMeta((current) => current ? {
          ...current,
          total: current.total + 1,
          last_page: Math.max(1, Math.ceil((current.total + 1) / current.per_page)),
        } : current);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the student account.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="student-management-view" aria-labelledby="students-page-title">
      <header className="dashboard-header staff-page-header">
        <div>
          <p className="eyebrow">STUDENT ACCESS</p>
          <h1 id="students-page-title">Student accounts</h1>
          <p className="dashboard-subtitle">Create student sign-ins before issuing their event tickets.</p>
        </div>
        <div className="staff-total-pill"><Users size={16} /><span>{meta?.total ?? '—'} accounts</span></div>
      </header>

      {error && <div className="notice notice--error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <div className="notice notice--success" role="status"><GraduationCap size={18} /><span>{notice}</span></div>}

      <div className="students-layout">
        <section className="surface-card panel student-create-panel" aria-labelledby="student-create-title">
          <div className="panel-heading">
            <div><span className="eyebrow">New account</span><h2 id="student-create-title">Add a student</h2></div>
            <span className="panel-icon"><UserPlus size={19} /></span>
          </div>
          <form className="student-form" onSubmit={(event) => void createStudentAccount(event)}>
            <label htmlFor="student-name">Full name</label>
            <input id="student-name" autoComplete="name" maxLength={255} required value={name}
              onChange={(event) => setName(event.target.value)} />

            <label htmlFor="student-number">Student number</label>
            <input id="student-number" autoComplete="off" maxLength={32} required value={studentNumber}
              onChange={(event) => setStudentNumber(event.target.value)} />

            <label htmlFor="student-email">Institutional email</label>
            <input id="student-email" type="email" autoComplete="email" maxLength={255} required value={email}
              onChange={(event) => setEmail(event.target.value)} />

            <label htmlFor="student-password">Initial password</label>
            <input id="student-password" type="password" autoComplete="new-password" minLength={12} required value={password}
              onChange={(event) => setPassword(event.target.value)} />

            <label htmlFor="student-password-confirmation">Confirm initial password</label>
            <input id="student-password-confirmation" type="password" autoComplete="new-password" minLength={12} required value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)} />

            <p className="student-form-hint">At least 12 characters. EUEvent assigns the Student role automatically. Password change and reset flows are not available yet.</p>
            <button className="button-primary student-submit" type="submit" disabled={isSaving}>
              {isSaving ? <><Loader2 size={17} className="spin" /> Creating account…</> : <><UserPlus size={17} /> Create student account</>}
            </button>
          </form>
        </section>

        <section className="surface-card panel student-directory-panel" aria-labelledby="student-directory-title">
          <div className="panel-heading">
            <div><span className="eyebrow">Ticket eligibility</span><h2 id="student-directory-title">Registered students</h2></div>
            <span className="count-pill count-pill--amber">{meta?.total ?? 0} total</span>
          </div>

          <form className="student-search" onSubmit={searchStudents}>
            <label className="visually-hidden" htmlFor="student-search-input">Search students</label>
            <Search size={16} aria-hidden="true" />
            <input id="student-search-input" value={searchInput} maxLength={120} placeholder="Search name, email, or student number"
              onChange={(event) => setSearchInput(event.target.value)} />
            <button type="submit">Search</button>
          </form>

          {isLoading ? (
            <div className="staff-loading" role="status"><Loader2 size={20} className="spin" /> Loading student accounts…</div>
          ) : students.length > 0 ? (
            <>
              <ul className="students-list">
                {students.map((student) => (
                  <li className="students-list-item" key={student.id}>
                    <span className="staff-avatar">{student.name.trim().slice(0, 1).toUpperCase()}</span>
                    <span className="staff-person-copy"><strong>{student.name}</strong><span>{student.email}</span></span>
                    <span className="student-number-badge">{student.student_number}</span>
                  </li>
                ))}
              </ul>
              {meta && meta.last_page > 1 ? (
                <div className="student-pagination">
                  <span>Page {meta.current_page} of {meta.last_page}</span>
                  <div>
                    <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button>
                    <button type="button" onClick={() => setPage((current) => Math.min(meta.last_page, current + 1))} disabled={page >= meta.last_page}>Next</button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="staff-empty-state">
              <span className="staff-empty-icon"><GraduationCap size={21} /></span>
              <strong>{activeSearch ? 'No matching students' : 'No student accounts yet'}</strong>
              <p>{activeSearch ? 'Try a different name, email, or student number.' : 'Create an account before issuing the student’s event ticket.'}</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
