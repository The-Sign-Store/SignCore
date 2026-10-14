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

## 1. Create the database on Neon

1. Sign in at neon.tech and create a project named `signcore` in the region closest to you (US East).
2. Click **Connect**, turn on **Connection pooling**, and copy the connection string. It looks like `postgresql://…-pooler….neon.tech/neondb?sslmode=require`.
3. Load the tables and data. From this folder, on any computer with Node.js 20+:
   ```
   npm install
   DATABASE_URL="paste-the-connection-string" npm run db:setup
   ```
   On Windows PowerShell: `$env:DATABASE_URL="…"; npm run db:setup`

   If you'd rather not use the command line, connect the Neon connector in Claude and Claude can load the data for you.

## 2a. Deploy on Cloudflare (recommended)

The free plan allows business use.

1. Put this folder in a GitHub repository.
2. In the Cloudflare dashboard, go to **Workers & Pages › Create › Import a repository** and pick the repo.
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
3. In the Worker's **Settings › Variables and Secrets**, add three secrets:
   - `DATABASE_URL`: the Neon string from step 1
   - `APP_PASSWORD`: the team password for signing in
   - `SESSION_SECRET`: any long random string (40+ characters)
4. Redeploy. The app runs at `signcore.<your-subdomain>.workers.dev`.

If you prefer the command line: run `npx wrangler login`, then `npx wrangler secret put DATABASE_URL` (and the same for the other two secrets), then `npm run cf:deploy`.

**Optional: shop-email login with Cloudflare Access.** Access is free for teams under 50 people. In the Worker's **Settings › Domains & Routes**, turn on Cloudflare Access for the workers.dev address. Then, in Zero Trust › Access, set the policy to allow emails ending in `@signstoremacon.com`. Finally, change `AUTH_MODE` in `wrangler.jsonc` to `cloudflare-access` and redeploy. People then sign in with a one-time code sent to their email, and Change History records their email address. Only make this switch after Access is protecting the whole site.

## 2b. Or deploy on Vercel

Import the GitHub repo in Vercel; it detects Next.js on its own. Add the same three environment variables, plus `AUTH_MODE=password`, and deploy. Vercel's free Hobby plan is for non-commercial use only, so a business tool needs the Pro plan.

## 3. Keep SignCore's Google Sheet in sync

SignCore still reads the Google Sheet. After editing, open **Export**, download the CSV for each tab you changed, and in the Sheet use **File › Import › Upload › Replace current sheet** with "Convert text to numbers, dates, and formulas" set to **No**. Don't rename tabs or headers, because Code.gs reads them by name.

The long-term fix is for SignCore to read from Neon directly, or for the app to write to the Sheet automatically. Both are possible next steps.

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
