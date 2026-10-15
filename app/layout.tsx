import './globals.css';
import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import { currentActor, authMode } from '@/lib/auth';

export const metadata: Metadata = { title: 'SignCore Spec Manager', description: 'Manage SignCore component and product specifications.' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let actor = '';
  try { actor = await currentActor(); } catch {}
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Nav actor={actor} signOut={authMode() === 'cloudflare-access' ? '/cdn-cgi/access/logout' : '/login/logout'} />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
