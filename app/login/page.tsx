import { login } from './actions';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div style={{ maxWidth: 380, margin: '10vh auto', padding: '0 16px' }}>
      <div className="card">
        <div className="bd stack">
          <div>
            <div className="brand" style={{ border: 0, padding: 0, margin: 0 }}><span>SignCore</span>Spec Manager</div>
            <p className="sub">Sign in to edit component and product specs. Your name is recorded with each change.</p>
          </div>
          <LoginForm action={login} next={next || '/'} />
        </div>
      </div>
    </div>
  );
}
