# Plesk Deployment Notes for Next.js 16 + Prisma 7

## 1) Plesk Node.js + Passenger + `output: "standalone"`
Plesk’s Node.js screen lets you set **Application Root**, **Application Startup File**, and custom env vars; the startup file must live inside the app root. For a Next.js build with `output: "standalone"`, Next.js writes a minimal `server.js` into `.next/standalone`, which can run directly with `node .next/standalone/server.js` (Plesk docs: Node.js Support / Hosting Node.js Applications; Next.js docs: `output`).

**Recommended Plesk mapping:**
- **Application Root:** the deployed standalone folder, usually `.next/standalone`.
- **Application Startup File:** `server.js`.
- **Env vars in Plesk UI:** set production config here (for example `NODE_ENV=production`, database vars, LIFF secrets). Plesk Linux exposes “Custom environment variables”; use those rather than hardcoding secrets in code.

**VERIFIED (2026-07-02):** confirmed working in production, not theoretical — the team's `homework-next` project (Next.js 16 + Prisma 7 + MySQL) is deployed live on Hostatom "Titan" Plesk exactly this way: build `output: "standalone"` locally, git-push to Plesk, start with `node .next/standalone/server.js`. Passenger runs it fine as a long-running Node process.

**Two real Passenger-specific bugs hit in that deployment — avoid repeating them here:**
1. **`redirect()` inside a Next.js Server Component crashes Passenger.** Passenger treats the internal redirect exception as a real error and takes the site down. Do NOT use server-side `redirect()` for any lineup-nextjs page/route that must survive on Plesk — return a normal 200 page and redirect client-side with `window.location.replace(...)` instead.
2. **Passenger's MySQL/MariaDB driver silently stringifies negative numeric column values** (e.g. `-1` becomes the string `"-1"`). Any strict-equality check against a negative number from a DB column (`=== -1`) will silently fail — coerce with `Number(...)` before comparing.

## 2) HTTPS / Let’s Encrypt for a subdomain
For LINE LIFF, use HTTPS on the subdomain. Plesk’s standard flow is:
1. **Websites & Domains > Add Subdomain**.
2. Open the subdomain card and go to **SSL/TLS Certificates** (or **Let’s Encrypt**).
3. Issue/install a Let’s Encrypt cert for the subdomain, then enable **Redirect from HTTP to HTTPS**.

Plesk docs note that subdomains have the same toolset as domains, and Let’s Encrypt can secure both; if auto-secure is enabled, new subdomains can be secured automatically (Plesk docs: Adding Subdomains; Let’s Encrypt).

## 3) DATABASE_URL for existing Plesk MySQL/MariaDB
Plesk shows the DB host, user, and password under **Connection Info**; Prisma 7 uses `DATABASE_URL`, and MySQL/MariaDB both use Prisma’s `mysql` provider (Prisma docs: MySQL connector; Plesk docs: Accessing Databases).

**Safer migration choice:** use a **separate database or schema** for the Next.js app during parallel run. **NEEDS VERIFICATION:** reusing the exact live legacy database is only safe if both apps intentionally share the same schema and write model; otherwise migrations and concurrent writes can collide.

## 4) Prisma 7 + WASM client + MariaDB adapter gotchas
Prisma 7 requires a **driver adapter** and ESM (`"type": "module"`). For MySQL/MariaDB, use `@prisma/adapter-mariadb` with the `mysql` provider; Prisma says it supports self-hosted MySQL/MariaDB and that the adapter manages the connection pool.

Gotchas under Passenger:
- Keep **one `PrismaClient` instance per app process**; multiple instances create multiple pools and can hit DB connection limits.
- First query may be slower because the pool is created on the first connection.
- **VERIFIED (2026-07-02):** `homework-next` confirmed Prisma 7 (WASM client + `@prisma/adapter-mariadb`, no Rust binary engine, no `binaryTargets` needed) generates and runs cleanly on this same Plesk/Passenger setup — this was the main open risk on Prisma 5 (which needed `binaryTargets` matching the host's Linux/OpenSSL) and Prisma 7 avoids it entirely.
- Cold-start / worker-recycle latency after deploy was not specifically flagged as a problem in the `homework-next` deployment, but budget for it as a possibility on first request after a Passenger restart.

## 5) Rollback plan
Fast rollback in Plesk:
- **Disable Node.js** on the Next.js hostname/subdomain, or switch its **Application Root/Document Root** back to the legacy PHP site.
- If the legacy PHP app lives on the same subdomain, keep its files intact in a separate directory and restore the old root instantly.

Plesk docs say disabling Node.js does **not** erase settings, so you can re-enable it later.

## Sources
- Plesk Node.js Support: https://docs.plesk.com/en-US/obsidian/customer-guide/nodejs-support.76652/
- Plesk Hosting Node.js Applications: https://docs.plesk.com/en-US/obsidian/administrator-guide/website-management/hosting-nodejs-applications.76652/
- Plesk Adding Subdomains / Let’s Encrypt / Databases: https://docs.plesk.com/en-US/obsidian/customer-guide/websites-and-domains/domains-and-dns/adding-subdomains.65180/ ; https://docs.plesk.com/en-US/obsidian/customer-guide/websites-and-domains/securing-connections-with-ssltls-certificates/getting-free-ssltls-certificate-from-let%E2%80%99s-encrypt.77233/ ; https://docs.plesk.com/en-US/obsidian/customer-guide/website-databases/accessing-databases.71841/
- Next.js `output: "standalone"`: https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
- Prisma MySQL/MariaDB connector: https://www.prisma.io/docs/orm/core-concepts/supported-databases/mysql
- Prisma driver adapters / Prisma 7: https://www.prisma.io/docs/orm/core-concepts/supported-databases/database-drivers and https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/introduction
