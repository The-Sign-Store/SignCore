// Proves publish and export are exact opposites: modules/ -> database -> modules gives back the same data.
// Runs inside a transaction that is rolled back, so the database is left untouched.
// Also checks that the validator catches typical mistakes.
//   DATABASE_URL=... npm run modules:roundtrip
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { connect } from './db';
import { readFolder, toDatabase, fromDatabase, validate, MODULES, type ModuleSet } from './lib';

function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter((k) => (v as any)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canon((v as any)[k])}`).join(',')}}`;
  return JSON.stringify(typeof v === 'number' ? String(v) : v);
}
function diff(a: ModuleSet, b: ModuleSet) {
  const problems: string[] = [];
  const keyed = (s: ModuleSet) => new Map<string, unknown>([
    ...s.components.map((c) => [`component ${c.id}`, c] as const), ...s.products.map((p) => [`product ${p.name}`, p] as const),
    ...s.rules.map((r) => [`rule ${r.id}`, r] as const), ...s.drawings.map((d) => [`drawing ${d.id}`, d] as const),
    ...s.departments.map((d) => [`department ${d.key}`, d] as const)]);
  const A = keyed(a), B = keyed(b);
  for (const [k, v] of A) if (!B.has(k)) problems.push(`${k} is missing after the round trip`); else if (canon(v) !== canon(B.get(k))) problems.push(`${k} changed:\n   before ${canon(v).slice(0, 300)}\n   after  ${canon(B.get(k)).slice(0, 300)}`);
  for (const k of B.keys()) if (!A.has(k)) problems.push(`${k} appeared from nowhere`);
  return problems;
}

async function selfTest() {
  const dir = await mkdtemp(path.join(tmpdir(), 'modules-'));
  await cp(MODULES, dir, { recursive: true });
  const f = path.join(dir, 'components/CHANNEL_LETTERS_FL/component.yaml');
  let s = await readFile(f, 'utf8');
  s = s.replace('show_if: MOUNTING=Raceway\n', 'show_if: MOUNTNG=Raceway\n').replace('type: autoqty', 'type: autoqtty');
  await writeFile(f, s);
  const p = path.join(dir, 'products/lighted-cabinets.yaml');
  await writeFile(p, (await readFile(p, 'utf8')).replace('MOUNTING: Wall Mount', 'MOUNTIN: Wall Mount'));
  const { errors } = await validate(dir);
  await rm(dir, { recursive: true, force: true });
  const expect = ['MOUNTNG', '/fields/', 'MOUNTIN'];
  const missed = expect.filter((e) => !errors.some((x) => x.message.includes(e)));
  return missed.length ? [`validator missed: ${missed.join(', ')}`] : [];
}

async function main() {
  const { set, errors } = await readFolder();
  if (errors.length) throw new Error(errors.map((e) => `${e.file}: ${e.message}`).join('\n'));
  const db = await connect();
  let problems: string[] = [];
  try {
    await db.q('BEGIN');
    await toDatabase(db.q, set);
    problems = diff(set, await fromDatabase(db.q));
  } finally { await db.q('ROLLBACK').catch(() => {}); await db.end(); }
  problems.push(...await selfTest());
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log(`Round trip OK: ${set.components.length} components, ${set.products.length} products, ${set.rules.length} rules, ${set.drawings.length} drawings, ${set.departments.length} departments. Validator self-test OK.`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
