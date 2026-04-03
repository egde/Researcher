# Research Wiki

Investment research knowledge base for credit analysts. Browse documents, vote on company convictions, and search across broker research, earnings transcripts, and analyst notes.

## Quick Start

```bash
# Prerequisites: Node.js 22+, PostgreSQL 16+

# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# 3. Generate Prisma client
npx prisma generate

# 4. Run migrations
npx prisma migrate dev

# 5. Seed demo data
npx tsx prisma/seed.ts

# 6. Start dev server
npm run dev
# → http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Random string for session encryption |
| `NEXTAUTH_URL` | Yes | App base URL (e.g., `http://localhost:3000`) |

## Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| alice@fund.com | password123 | Senior Analyst |
| bob@fund.com | password123 | Analyst |
| admin@fund.com | password123 | Admin |

API keys for Obsidian plugin: `ak_alice_demo_key_001`, `ak_bob_demo_key_002`, `ak_admin_demo_key_003`
