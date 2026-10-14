// Validates every module file: JSON Schema plus cross-checks (show_if, calcs, product defaults, links).
//   npm run modules:check
import { validate } from './lib';

async function main() {
  const { errors, warnings, set } = await validate();
  for (const w of warnings) console.log(`warning  ${w.file}: ${w.message}`);
  for (const e of errors) console.log(`error    ${e.file}: ${e.message}`);
  console.log(`\n${set.components.length} components, ${set.products.length} products, ${set.rules.length} rules, ${set.drawings.length} drawings: ` +
    `${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
  process.exit(errors.length ? 1 : 0);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
