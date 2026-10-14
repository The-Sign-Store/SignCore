import Link from 'next/link';
export default function NotFound() {
  return <div className="stack"><h1>Not found</h1><p className="sub">That item does not exist. It may have been renamed or deleted. Check <Link href="/history">Change History</Link>.</p></div>;
}
