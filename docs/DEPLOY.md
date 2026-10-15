# Deploying SignCore: Neon, Authentik and Cloudflare

This guide takes SignCore from this repository to a live, sign-in-protected address such as `https://core.<your-domain>`.

**How the pieces fit**

```
Browser ──▶ Cloudflare Access ──(sign in)──▶ Authentik  auth.<your-domain>  (your server, via Cloudflare Tunnel)
                │  only signed-in staff in the right group get past
                ▼
        SignCore on Cloudflare Workers  core.<your-domain>
                │  checks the Access token on every request
                ▼
        Neon Postgres  (database "signcore")
                ▲
GitHub ── merge to main ──▶ Workers Builds deploys the app
       └─ Actions ─▶ applies migrations and publishes modules/ into Neon
```

- **Neon** holds the data.
- **Authentik** is the one login, with MFA and groups.
- **Cloudflare Access** puts that login in front of SignCore. You don't change any app code to use it.
- **Workers** runs the app.
- **GitHub** deploys and publishes on every merge.

**Who does what.** Every step happens in your own accounts. Connection strings and secrets go into Cloudflare and GitHub settings only. Never paste them into chat, code or an AI tool.

Dashboard menu names change from time to time. If a label below doesn't match exactly, look for the nearest equivalent.

---

## 0. Before you start

- [ ] **Pick two hostnames.** In this guide: `core.<your-domain>` for SignCore and `auth.<your-domain>` for Authentik.
- [ ] **Put the domain's DNS on Cloudflare.** Cloudflare must manage DNS for the domain (free plan is fine).
  - **Moving DNS affects the company website and email**, so copy every existing record first, especially MX for email, before changing nameservers.
  - If the main domain is risky to move today, a separate domain just for the tools works the same way.
- [ ] **Have the accounts ready:** Neon (neon.com), Cloudflare (with Zero Trust turned on; the free plan covers up to 50 users), and GitHub admin on `The-Sign-Store/SignCore`.
- [ ] **Have a server for Authentik.** Authentik is self-hosted, so it needs a small Linux server with Docker, such as the Hostinger VPS. If Authentik already runs there, skip to step 2b.
- [ ] **Have a computer with Node.js 22 and `psql`** to load the database once.

## 1. Neon: the database

1. **Create the project.** Create a project named `signcore`. Choose Postgres 17 and the AWS region nearest Macon (US East).
2. **Create the database.** Under **Databases**, create a database named `signcore`, owned by `neondb_owner`.
3. **Copy the owner connection.** Click **Connect**, pick database `signcore` and role `neondb_owner`, and turn **Connection pooling off** (direct connection). Copy the string. This is the **owner connection**: it creates and changes tables. Only you and GitHub Actions use it.
4. **Load the data** on your computer:
   ```bash
   git clone https://github.com/The-Sign-Store/SignCore && cd SignCore
   npm ci
   DATABASE_URL="<owner connection>" npm run db:setup
   ```
   It prints `Loaded: { components: '26', fields: '350', rules: '87' }`.
5. **Create the app's own login.** The app gets a login that can read and change rows but cannot alter tables or erase the change history. Use a random password of 30+ characters; Neon rejects weak ones.
   ```bash
   psql "<owner connection>" -v app_password="'<random password>'" -f db/roles.sql
   ```
6. **Build the app connection.** In **Connect**, pick role `signcore_app` (it appears after step 5) and turn **Connection pooling on**. That pooled string is the **app connection**. It goes only into Cloudflare (step 4).

**Done when:** `psql "<app connection>" -c "select count(*) from components"` returns 26.

> Neon's IP allow-list is a paid (Scale) feature, and Workers don't use fixed addresses anyway. Protection here comes from TLS, strong passwords and the app login's limited rights.

## 2. Authentik: the one login

### 2a. Run Authentik (skip if it already runs)

1. Install Authentik on the server with Docker Compose, following goauthentik.io › Docs › Installation › Docker Compose. Its web port is 9000.
2. In Cloudflare **Zero Trust › Networks › Tunnels**, create a tunnel. Run the `cloudflared` command it gives you on the server.
3. In that tunnel, add a **public hostname**: `auth.<your-domain>` pointing to `http://localhost:9000`, or to the Authentik container's address. No ports are opened on the server.
4. Open `https://auth.<your-domain>/if/flow/initial-setup/` and create the admin account.
5. **Turn on MFA.** In **Flows and Stages**, make the default authentication flow require an authenticator (TOTP or a security key), as Authentik's MFA guide describes.

### 2b. Groups and the Cloudflare connection

1. **Groups.** Under **Directory › Groups**, create `signcore-admins` for people who may edit specs, and add yourself. More groups (sales, design, departments) can come later.
2. **Provider.** Under **Applications › Providers › Create**, choose **OAuth2/OpenID Provider**:
   - **Name:** `Cloudflare Access`
   - **Client type:** Confidential
   - **Redirect URI:** `https://<team-name>.cloudflareaccess.com/cdn-cgi/access/callback`. The team name comes from Cloudflare Zero Trust › **Settings › Team name and domain**.
   - **Signing key:** `authentik Self-signed Certificate`
   - **Scopes:** keep `openid`, `email` and `profile`. Authentik's `profile` scope also sends the user's **groups**.
3. **Application.** Under **Applications › Applications › Create**:
   - **Name:** `Cloudflare Access`
   - **Slug:** `cloudflare-access`
   - **Provider:** the one from step 2
4. **Copy what Cloudflare needs.** Copy the **Client ID** and **Client Secret**. Then open `https://auth.<your-domain>/application/o/cloudflare-access/.well-known/openid-configuration` and copy `authorization_endpoint`, `token_endpoint` and `jwks_uri`.

**Done when:** you can sign in at `https://auth.<your-domain>` with MFA.

## 3. Cloudflare Zero Trust: Authentik as the login method

1. **Add the login method.** In **Zero Trust › Settings › Authentication › Login methods › Add new**, choose **OpenID Connect**:
   - **Name:** `Authentik`
   - **App ID:** the Client ID
   - **Client secret:** the Client Secret
   - **Auth URL:** `authorization_endpoint`
   - **Token URL:** `token_endpoint`
   - **Certificate URL:** `jwks_uri`
   - **PKCE:** on
   - **OIDC Claims:** add `groups`, so policies (and SignCore) can see the user's Authentik groups.
2. **Test it.** Click **Test**. You see the Authentik login, and then a success page that lists your email and `groups`.
3. **Keep a break-glass login.** Leave the built-in **One-time PIN** method available. Step 5 limits it to a single emergency admin email, so someone can still get in if Authentik is down.

## 4. Cloudflare Workers: the app

1. **Import the repo.** Go to **Workers & Pages › Create › Import a repository**, connect GitHub and pick `The-Sign-Store/SignCore`:
   - **Production branch:** `main`
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Deploy command:** `npx opennextjs-cloudflare deploy`
2. **Add the settings.** In the Worker's **Settings › Variables and Secrets**, add:

   | Name | Type | Value |
   | --- | --- | --- |
   | `DATABASE_URL` | Secret | the **app connection** (`signcore_app`, pooled) |
   | `AUTH_MODE` | Text | `cloudflare-access` |
   | `ACCESS_TEAM_DOMAIN` | Text | `https://<team-name>.cloudflareaccess.com` |
   | `ACCESS_AUD` | Text | fill in after step 5 |
   | `ACCESS_ALLOWED_GROUPS` | Text | `signcore-admins` (optional second gate, in addition to the Access policy) |

   `wrangler.jsonc` has `keep_vars: true`, so deploys never overwrite these values.
3. **Add the custom domain.** Under **Settings › Domains & Routes › Add › Custom domain**, add `core.<your-domain>`.

Until `ACCESS_AUD` is set, the app answers every request with "Sign in through your company account". That's expected.

## 5. Cloudflare Access: the gate in front of SignCore

1. **Create the application.** Go to **Zero Trust › Access › Applications › Add an application › Self-hosted**:
   - **Name:** `SignCore`
   - **Domain:** `core.<your-domain>`. Also add the `signcore.<account>.workers.dev` address, or turn workers.dev off in the Worker's **Domains & Routes**.
   - **Login methods:** Authentik and One-time PIN. Turn on **Instant Auth** if Authentik is the only method staff use.
   - **Session duration:** 24 hours (your choice).
2. **Add the policies.**
   - **SignCore staff:** Allow. Include: *OIDC Claim* `groups` = `signcore-admins`. Require: *Login Methods* = Authentik.
   - **Break-glass:** Allow. Include: *Emails* = one emergency admin address. It uses One-time PIN. Use it only when Authentik is down.
3. **Copy the AUD tag.** Save, then open the application's **Additional settings** and copy the **Application Audience (AUD) Tag**. Paste it into the Worker's `ACCESS_AUD` setting (step 4.2) and save. The Worker picks it up immediately.

**How the app uses this.** Every request reaching the app carries a signed Access token. SignCore checks its signature against your team's keys, plus its issuer, audience and expiry. A request that skipped Access is refused, even if it fakes the email header. The verified email is what Change History records.

## 6. GitHub: protection and automatic publishing

1. **Protect `main`.** Under **Settings › Branches › Add rule** for `main`: require a pull request, require the **Checks / check** status, and block direct pushes.
2. **Create the production environment.** Under **Settings › Environments › New environment**, name it `production`:
   - add a secret `NEON_OWNER_URL` holding the **owner connection**
   - add yourself under **Required reviewers**, so each publish waits for your OK
3. **How merges work from then on.** Each merge to `main` triggers two things:
   - Workers Builds deploys the new app.
   - **Publish to production** applies any new `db/migrations` and publishes `modules/` into Neon.

## 7. Check it end to end

- [ ] A private window at `https://core.<your-domain>` sends you to Authentik and asks for MFA. Afterward you land on SignCore with your email in the sidebar.
- [ ] Someone who isn't in `signcore-admins` gets blocked by Access.
- [ ] The workers.dev address doesn't serve the app without signing in.
- [ ] Editing a field records your email in **Change History**.
- [ ] **Sign out** ends the Access session.
- [ ] After merging a pull request, the Actions tab shows **Publish to production** waiting for approval, then succeeding.

## 8. Day to day

- **Add someone:** add them to `signcore-admins` in Authentik. **Remove someone:** take them out of the group, or deactivate them in Authentik. Their access ends when their Access session expires, or immediately if you revoke it under **Zero Trust › My Team › Users**.
- **Backups:**
  - Neon can restore to any point inside your plan's restore window.
  - **Export › Full backup** in SignCore downloads a SQL copy.
  - Nightly dumps to offsite storage can be added as a scheduled GitHub Action.
- **Rotate passwords:**
  - **App login:** change `signcore_app`'s password in Neon, then update `DATABASE_URL` in the Worker.
  - **Owner login:** update `NEON_OWNER_URL` in GitHub.
- **Speed (optional):** Cloudflare Hyperdrive can keep database connections warm between Workers and Neon. It's available on the Workers free plan and is worth adding once more people use SignCore.

## Known gaps

- The Spec Manager still saves module edits straight to the database. Once **Publish to production** is running, the next publish overwrites them, so edit modules through pull requests until the Spec Manager's pull-request saving is built.
- Access currently gates SignCore as a whole. Finer roles inside the app (who can view vs. edit) can use the same `groups` claim later.
