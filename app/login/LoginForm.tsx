'use client';
import ActionForm, { Submit } from '@/components/ActionForm';
import type { Result } from '@/lib/specs';

export default function LoginForm({ action, next }: { action: (p: Result | null, fd: FormData) => Promise<Result>; next: string }) {
  return (
    <ActionForm action={action} className="stack">
      <input type="hidden" name="next" value={next} />
      <label className="f">Your name<input type="text" name="name" id="login-name" autoComplete="name" required /></label>
      <label className="f">Team password<input type="password" name="password" id="login-password" autoComplete="current-password" required /></label>
      <Submit>Sign in</Submit>
    </ActionForm>
  );
}
