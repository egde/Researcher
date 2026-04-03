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

## Vercel + Neon Deployment

### 1. Set up Neon database

1. Create a Neon project at neon.tech
2. Copy the connection string (pooled endpoint recommended)
3. Note: Neon provides a serverless PostgreSQL compatible with Prisma

### 2. Deploy to Vercel

1. Push code to GitHub
2. Import the repository in Vercel
3. Set environment variables:
   - `DATABASE_URL` — Neon connection string
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your Vercel domain
4. Vercel will auto-detect Next.js and configure the build

### 3. Run migrations

After the first deploy, run migrations against Neon:

```bash
DATABASE_URL="your-neon-connection-string" npx prisma migrate deploy
```

### 4. Seed data (optional)

```bash
DATABASE_URL="your-neon-connection-string" npx tsx prisma/seed.ts
```

## Prisma 7 + Neon Considerations

Prisma 7 uses an adapter-based client. The current setup uses `@prisma/adapter-pg` with a `pg.Pool`. For Neon's serverless driver, you may want to switch to `@prisma/adapter-neon`:

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

This enables HTTP-based queries that work well in serverless environments (Vercel Edge/Serverless Functions).

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
