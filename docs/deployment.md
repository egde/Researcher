# Deployment

## Prerequisites

- Node.js 22+
- PostgreSQL 16+ (or a hosted Postgres like Neon, Supabase, etc.)

## Environment Variables

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
NEXTAUTH_SECRET="random-secret-string"
NEXTAUTH_URL="https://your-domain.com"
```

## Production Build

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

---

## CI/CD via GitHub Actions

Two workflows are included in `.github/workflows/`:

### `ci.yml` — Runs on every push and PR to `main`

| Job | What it does |
|-----|-------------|
| **Lint** | Runs `npm run lint` (ESLint) |
| **Type Check** | Runs `tsc --noEmit` |
| **Build** | Runs `next build` (depends on lint + typecheck passing) |
| **Validate Migrations** | Spins up a PostgreSQL 16 service container, runs `prisma migrate deploy` and `seed.ts` against it |

### `deploy.yml` — Runs on push to `main` only

| Job | What it does |
|-----|-------------|
| **Migrate** | Runs `prisma migrate deploy` against the Neon production database |
| **Deploy** | Uses Vercel CLI to build and deploy to production (depends on migration succeeding) |

Uses `concurrency` to cancel in-progress deploys when a new push arrives.

---

## GitHub Repository Settings

### Required Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Value | Where to get it |
|--------|-------|-----------------|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require` | Neon dashboard → Connection Details → Connection string (pooled) |
| `VERCEL_TOKEN` | `vercel_xxx...` | vercel.com → Settings → Tokens → Create Token |

### Required Vercel Project Linking

The deploy workflow uses `vercel pull` which requires the repo to be linked to a Vercel project. Two options:

**Option A: Link via Vercel dashboard (recommended)**
1. Go to vercel.com → Add New Project → Import the `egde/Researcher` repo
2. Set environment variables in Vercel:
   - `DATABASE_URL` — same Neon connection string
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your Vercel domain (e.g., `https://researcher-wiki.vercel.app`)
3. Vercel auto-links to the repo. The GitHub Action will deploy using the CLI.

**Option B: Link via CLI locally**
```bash
npm i -g vercel
vercel link
# Follow prompts → select your Vercel org and project
# This creates .vercel/project.json — commit it
```

### Branch Protection Rules (recommended)

Go to **Settings → Branches → Add rule** for `main`:

| Setting | Value |
|---------|-------|
| Require a pull request before merging | Yes |
| Require status checks to pass | Yes |
| Required status checks | `Lint`, `Type Check`, `Build`, `Validate Migrations` |
| Require branches to be up to date | Yes |

This prevents merging PRs that fail CI.

---

## Neon Setup (step by step)

1. Go to [neon.tech](https://neon.tech) → Create a new project
2. Choose a region close to your Vercel deployment (e.g., `us-east-1` for `iad1`)
3. Copy the **pooled connection string** from Connection Details
4. Add it as `DATABASE_URL` in both GitHub Secrets and Vercel Environment Variables
5. Run initial migration:
   ```bash
   DATABASE_URL="your-neon-string" npx prisma migrate deploy
   ```
6. Seed (optional):
   ```bash
   DATABASE_URL="your-neon-string" npx tsx prisma/seed.ts
   ```

### Prisma 7 + Neon Adapter

The current setup uses `@prisma/adapter-pg` with a `pg.Pool`. For Neon's serverless driver (better for Vercel cold starts), switch to `@prisma/adapter-neon`:

```bash
npm install @prisma/adapter-neon @neondatabase/serverless
```

Then update `src/lib/prisma.ts`:

```typescript
import { neon } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const sql = neon(process.env.DATABASE_URL!);
const adapter = new PrismaNeon(sql);
const prisma = new PrismaClient({ adapter });
```

This enables HTTP-based queries that work well in serverless environments.

---

## Vercel Environment Variables

Set these in Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Environment | Value |
|----------|-------------|-------|
| `DATABASE_URL` | Production, Preview, Development | Neon pooled connection string |
| `NEXTAUTH_SECRET` | Production, Preview, Development | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Production | Your production URL |
| `NEXTAUTH_URL` | Preview | `https://$VERCEL_URL` (auto-populated) |

---

## Docker (alternative)

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

Pair with a PostgreSQL container or external database.
