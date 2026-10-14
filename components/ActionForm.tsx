'use client';
import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState } from 'react';
import type { Result } from '@/lib/specs';

type Action = (prev: Result | null, fd: FormData) => Promise<Result>;

// Pending state shared with the buttons inside an ActionForm.
const Pending = createContext(false);

export function Submit({ children, className = 'primary', disabled }: { children: React.ReactNode; className?: string; disabled?: boolean }) {
  const pending = useContext(Pending);
  return <button type="submit" className={className} disabled={pending || disabled}>{pending ? 'Saving…' : children}</button>;
}

export function ResultNote({ r }: { r: Result | null }) {
  if (!r?.message) return null;
  return (
    <div className={`note ${r.ok ? (r.warnings?.length ? 'warn' : 'ok') : 'bad'}`} role={r.ok ? 'status' : 'alert'}>
      {r.message}
      {!!r.warnings?.length && <ul>{r.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
    </div>
  );
}

/** A form bound to a server action, with inline success/error feedback. */
export default function ActionForm({ action, children, className, resetOnSuccess, onSuccess, id }: {
  action: Action; children: React.ReactNode; className?: string; resetOnSuccess?: boolean; onSuccess?: (r: Result) => void; id?: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const [shown, setShown] = useState<Result | null>(null);
  useEffect(() => {
    if (!state) return;
    setShown(state);
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
      if (!state.warnings?.length) { const t = setTimeout(() => setShown(null), 3500); return () => clearTimeout(t); }
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    // Submitting through onSubmit (not the action prop) keeps what the user typed when a save fails;
    // React resets uncontrolled inputs after an action-prop submission.
    <form ref={ref} className={className} id={id} onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
      startTransition(() => run(fd));
    }}>
      <Pending.Provider value={pending}>{children}</Pending.Provider>
      {shown && <div style={{ marginTop: 10 }}><ResultNote r={shown} /></div>}
    </form>
  );
}

/** Delete-style button: first click arms it, second click submits. */
export function ConfirmButton({ label = 'Delete', confirm = 'Click again to delete', className = 'danger' }: { label?: string; confirm?: string; className?: string }) {
  const [armed, setArmed] = useState(false);
  const pending = useContext(Pending);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return (
    <button type={armed ? 'submit' : 'button'} className={`${className}${armed ? ' armed' : ''}`} disabled={pending}
      onClick={(e) => { if (!armed) { e.preventDefault(); setArmed(true); } }}>
      {pending ? 'Working…' : armed ? confirm : label}
    </button>
  );
}
