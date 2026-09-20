# VPP — Electricity Sales and Settlement Demo

VPP is a Persian-language, right-to-left application for managing power-plant sales requests, technical and legal reviews, pricing proposals, contracts, meter readings, settlements, invoices, payments, and multi-plant netting. It has separate workspaces for sellers/representatives and internal staff.

The application uses Next.js 16, React 19, TypeScript, Prisma 5, and MySQL. The UI uses the Jalali calendar; Prisma migrations create the database tables and relationships.

## Requirements

- Node.js 20.9 or newer (see `.nvmrc`) and npm
- MySQL 8 or a compatible MySQL server
- A MySQL account permitted to create and alter tables in the application database

## Local installation from a fresh clone

1. Clone the repository and install the locked dependencies:

   ```bash
   git clone <your-repository-url>
   cd vpp
   npm ci
   ```

   `npm ci` also generates the Prisma client through the `postinstall` script.

2. Create an **empty** MySQL database. For example, run the following as a MySQL administrator, replacing the password with a unique local password:

   ```sql
   CREATE DATABASE vpp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'vpp_app'@'localhost' IDENTIFIED BY 'replace-with-a-strong-password';
   GRANT ALL PRIVILEGES ON vpp.* TO 'vpp_app'@'localhost';
   ```

   If the database or account already exists, adapt these statements instead of recreating it. Use a separate database for this application. Do not point the setup commands at a database containing data you want to keep.

3. Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`; Bash: `cp .env.example .env`) and edit at least these values:

   ```dotenv
   DATABASE_URL="mysql://vpp_app:replace-with-a-strong-password@localhost:3306/vpp"
   NEXTAUTH_URL="http://localhost:3000"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   NEXTAUTH_SECRET="replace-with-at-least-32-random-characters"
   ADMIN_SEED_MOBILE="09190000000"
   ADMIN_SEED_PASSWORD="choose-a-private-admin-password"
   SEED_PASSWORD="choose-a-different-demo-password-at-least-12-characters"
   APP_ENV="development"
   RELEASE_ID="local-development"
   UPLOAD_DIR="./storage/uploads"
   ```

   `ADMIN_SEED_MOBILE` must be an 11-digit Iranian mobile number beginning with `09`. Use **your own** number if you want to log in with it; the example number is only a placeholder. You can generate `NEXTAUTH_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. If your MySQL password contains URL-reserved characters, percent-encode them in `DATABASE_URL`. Keep `.env` private; it is Git-ignored. The remaining options in `.env.example` are optional for a basic local run.

4. Validate the configuration and apply **all committed migrations** to the empty database:

   ```bash
   npm run runtime:validate
   npm run db:validate
   npm run db:migrate:deploy
   npm run db:migrate:status
   ```

   `db:migrate:deploy` creates the full schema: users, parties, representatives, requests, assets, documents, proposals, pricing plans, contracts, readings, settlements, invoices, payments, notifications, netting records, and their relationships. The first active migration is a full baseline; older historical migrations are kept under `docs/deployment/migrations-legacy-20260913` and are **not** run by Prisma. Do not replace migrations with `db:push` for a reproducible installation.

5. Seed the eight demo user roles:

   ```bash
   npm run db:seed
   ```

   The seed creates or updates **users only**. It does not create companies, representative assignments, power plants, requests, contracts, or financial records. It is safe to rerun in a development database. On an existing local database, omitting `ADMIN_SEED_MOBILE` preserves the mobile number of the existing seeded administrator; a fresh database requires it. Seeding is intentionally disabled when `NODE_ENV=production`.

6. Start the app:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000/cards` to enter the local demo by role, or `http://localhost:3000/login` to use mobile number and password. If you run Next.js on a different port, update both `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to match it before starting the app.

## Seeded roles

| Role | Purpose | Login mobile |
| --- | --- | --- |
| `ADMIN` | System administrator | `ADMIN_SEED_MOBILE` from `.env` |
| `STAFF_SUPPLY` | Supply review and contracts | `09191111111` |
| `STAFF_TECHNICAL` | Technical review and metering | `09192222222` |
| `STAFF_LEGAL` | Legal review | `09193333333` |
| `STAFF_FINANCIAL` | Finance, settlements, and payments | `09194444444` |
| `MANAGER` | Management dashboard and reports | `09195555555` |
| `CUSTOMER` | Electricity seller | `09191234567` |
| `CUSTOMER_REPRESENTATIVE` | Seller representative | `09196666666` |

The administrator uses `ADMIN_SEED_PASSWORD`; all other seeded accounts use `SEED_PASSWORD`. Passwords are hashed by the seed and are never stored in the repository. The one-click `/cards` login is available in development and is **not** a production authentication mechanism. A seller creates its party through onboarding on first use; an administrator can later create companies and assign a representative. On a clean installation, all domain screens start empty until users perform these workflows.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the local development server |
| `npm run typecheck` | Generate Next.js route types and check TypeScript |
| `npm run test:seed` | Verify the eight-role seed contract without changing the database |
| `npm test` | Run the test suites |
| `npm run verify` | Run lint, types, tests, schema validation, and build |
| `npm run db:migrate:deploy` | Apply committed migrations to an existing empty or older database |
| `npm run db:migrate:status` | Inspect migration status |
| `npm run db:seed` | Create/update development users only |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | **Destructive:** drop and rebuild the configured database, then seed |

Avoid `db:reset` on a database with records you want to retain. Uploaded documents are stored under `UPLOAD_DIR`, outside the public web directory, and are not included in the Git repository.

## Repository hygiene

Commit the source code, `prisma/schema.prisma`, **all** files under `prisma/migrations`, `.env.example`, and the documentation. Do not commit `.env`, local database backups, uploaded documents, generated PDFs, temporary browser files, or build output; `.gitignore` excludes these. Before publishing, review `git status --short` and the files you stage, especially if you previously committed private data to Git history. The example environment file contains placeholders, not usable credentials.

## Deployment notes

Apply `npm run db:migrate:deploy` before starting a release. Provide production environment variables through your hosting platform, use an HTTPS `NEXTAUTH_URL`, and keep `ENABLE_DEMO_LOGIN=false`. `npm run prod:build` builds the standalone application; `npm run prod:start` validates the runtime environment and starts it. The Dockerfile packages the application but does **not** run migrations or seed production users automatically. Production bootstrap of real users must be handled separately; the development seed refuses to run under `NODE_ENV=production`.

The `.github/workflows/quality.yml` workflow checks lint, types, tests, schema, build, dependency audit, and a container build. Further operational details are in [`docs/deployment`](./docs/deployment/README.md).


Created with ❤️ by *Bahar* and *GPT-5.6 Sol*
