# SignCore

SignCore is the system of record for The Sign Store's products, components, specifications, design rules, detail drawings and color libraries. It is a Postgres database (Neon) plus a web admin (the Spec Manager) for editing it. It is the foundation for the rest of the Sign family of tools.

```
modules/             product and component modules, Design Guide rules, detail drawings (the source; see docs/MODULE_FORMAT.md)
schemas/             JSON Schemas for the module files
scripts/modules/     check, publish, round-trip test, one-time export
db/schema.sql        tables (run once on an empty database)
db/seed.sql          your data, from the Google Sheet export of 2026-10-14 (K06 added; G02, G03, G04, G08, G09, F02 removed)
db/migrations/       later schema changes, applied in order
scripts/db-setup.mjs runs schema, seed and migrations against DATABASE_URL
app/                 the screens
lib/                 database, login, SignCore conventions, exports
```

## What it does

| Screen | What you can do |
| --- | --- |
| Components | Add, rename or delete components. Edit fields grouped by preview column: proof label, input type, default, options (one per line), Show If, Required, don't-print values, SignOS reference, notes. Move fields up and down. Each component lists the products, rules and drawings that use it, plus a "Check these" list of broken references. |
| Products | Add sections (components), reorder them, and set Include, Repeatable, Page Group and product-specific defaults. A preview shows how the proof pages will split. |
| Design Guide | Edit, add, deactivate or delete rules. Pick which components a rule applies to. New rules get the next ID in their section (K07 after K06). |
| Detail Drawings | Edit drawing settings and SVG markup with a live preview. |
| Change History | Every edit, with who made it and the values before and after. |
| Export | CSV files with the same tab names and headers as the Google Sheet, plus a full SQL backup. |

Built-in checks:
- Renaming a field variable also updates the Show If conditions, calc formulas and product defaults that use it. The app warns you about Design Guide rules or drawings that mention the old name.
- You get a warning when Show If or a product default refers to a field that doesn't exist, or when a dropdown's default isn't one of its options.
- Duplicate variables and IDs are refused.
- Delete buttons ask you to click a second time.

## Deploy

SignCore runs on **Cloudflare Workers**, keeps its data in **Neon** Postgres, and signs people in through **Authentik**, with **Cloudflare Access** acting as the gate in front of the app. The step-by-step guide is [docs/DEPLOY.md](docs/DEPLOY.md).

SignCore's Export page can still produce CSVs in the Google Sheet's tab layout, for as long as anything reads the Sheet.

## Modules

Products, components, Design Guide rules and detail drawings are defined as files in `modules/` and reviewed through pull requests. Merging publishes them into the database with `npm run modules:publish`. The format is described in [docs/MODULE_FORMAT.md](docs/MODULE_FORMAT.md).

> Until the Spec Manager's Save button opens pull requests (next step), don't edit modules in the Spec Manager on a database that modules are published to. The next publish would overwrite those edits.

## Run it locally

```
cp .env.example .env.local   # fill in DATABASE_URL, APP_PASSWORD, SESSION_SECRET
npm install
npm run dev                  # http://localhost:3000
```

## Notes

- If two people save the same item at the same moment, the later save wins. Change History shows both versions.
- Colors, SignOS reference, ADA pictograms and the proof template are in the database and in the SQL backup, but the app doesn't edit them yet.
- Neon can restore the database to an earlier point in time, within a window that depends on your Neon plan. The Export page's SQL backup is a second safety net.
