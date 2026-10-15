'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['/', 'Overview'],
  ['/components', 'Components'],
  ['/products', 'Products'],
  ['/guide', 'Design Guide'],
  ['/drawings', 'Detail Drawings'],
  ['/history', 'Change History'],
  ['/export', 'Export'],
];

export default function Nav({ actor, signOut }: { actor: string; signOut: string }) {
  const path = usePathname();
  if (path.startsWith("/login")) return <div className="noside" />;
  return (
    <nav className="side" aria-label="Main">
      <div className="brand"><span>SignCore</span>Spec Manager</div>
      {LINKS.map(([href, label]) => {
        const on = href === '/' ? path === '/' : path.startsWith(href);
        return <Link key={href} href={href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>{label}</Link>;
      })}
      {actor && actor !== 'unknown' && (
        <div className="who">Signed in as <b>{actor}</b><br /><a href={signOut}>Sign out</a></div>
      )}
    </nav>
  );
}
