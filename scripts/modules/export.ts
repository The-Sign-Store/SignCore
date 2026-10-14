// Writes the modules/ folder from a SignCore database.
// One-time use: turns today's catalog into module files. After that, the folder is the source and publish.ts goes the other way.
//   DATABASE_URL=... npm run modules:export [-- --out some/dir]
import { connect } from './db';
import { fromDatabase, writeFolder, MODULES } from './lib';

async function main() {
  const outIdx = process.argv.indexOf('--out');
  const out = outIdx > 0 ? process.argv[outIdx + 1] : MODULES;
  const db = await connect();
  try {
    const set = await fromDatabase(db.q);
    await writeFolder(set, out);
    console.log(`Wrote ${set.components.length} components, ${set.products.length} products, ${set.rules.length} rules, ${set.drawings.length} drawings to ${out}`);
  } finally { await db.end(); }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
