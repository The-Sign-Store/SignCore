// Publishes the modules/ folder into a SignCore database, in one transaction. Run by CI when a pull request merges.
//   DATABASE_URL=... npm run modules:publish
import { connect } from './db';
import { validate, toDatabase } from './lib';

async function main() {
  const { errors, set } = await validate();
  if (errors.length) { for (const e of errors) console.error(`error ${e.file}: ${e.message}`); console.error('Not published: fix the errors above.'); process.exit(1); }
  const db = await connect();
  try {
    await db.q('BEGIN');
    const n = await toDatabase(db.q, set, process.env.GITHUB_SHA);
    await db.q('COMMIT');
    console.log('Published:', n);
  } catch (e) {
    await db.q('ROLLBACK').catch(() => {});
    console.error('Not published:', (e as Error).message); process.exit(1);
  } finally { await db.end(); }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
