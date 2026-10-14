'use client';
import { useEffect, useState } from 'react';

/** Filters elements marked data-filter="searchable text" inside the element with id=target. Groups marked data-group hide when empty. */
export default function Filter({ target, placeholder = 'Search', id }: { target: string; placeholder?: string; id: string }) {
  const [q, setQ] = useState('');
  useEffect(() => {
    const root = document.getElementById(target);
    if (!root) return;
    const needle = q.trim().toLowerCase();
    root.querySelectorAll<HTMLElement>('[data-filter]').forEach((el) => { el.hidden = !!needle && !el.dataset.filter!.toLowerCase().includes(needle); });
    root.querySelectorAll<HTMLElement>('[data-group]').forEach((g) => { g.hidden = !!needle && !g.querySelector('[data-filter]:not([hidden])'); });
  }, [q, target]);
  return <input type="search" id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} style={{ maxWidth: 280 }} />;
}
