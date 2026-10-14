'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { Result } from '@/lib/specs';

function Btn({ label, title, className }: { label: React.ReactNode; title: string; className: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} title={title} aria-label={title} disabled={pending}>{label}</button>;
}

/** One-button form for small actions (move up/down). Shows only errors. */
export default function MiniAction({ action, values, label, title, className = 'ghost' }: {
  action: (p: Result | null, fd: FormData) => Promise<Result>; values: Record<string, string | number>; label: React.ReactNode; title: string; className?: string;
}) {
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} style={{ display: 'inline' }}>
      {Object.entries(values).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Btn label={label} title={title} className={className} />
      {state && !state.ok && <span className="small" style={{ color: 'var(--bad)' }}> {state.message}</span>}
    </form>
  );
}
