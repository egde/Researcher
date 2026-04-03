import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hash } from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Regions
  const northAmerica = await prisma.region.upsert({
    where: { slug: "north-america" },
    update: {},
    create: { name: "North America", slug: "north-america" },
  });
  const europe = await prisma.region.upsert({
    where: { slug: "europe" },
    update: {},
    create: { name: "Europe", slug: "europe" },
  });
  const asiaPacific = await prisma.region.upsert({
    where: { slug: "asia-pacific" },
    update: {},
    create: { name: "Asia Pacific", slug: "asia-pacific" },
  });

  // Sectors
  const technology = await prisma.sector.upsert({
    where: { slug: "technology" },
    update: {},
    create: { name: "Technology", slug: "technology", regionId: northAmerica.id },
  });
  const healthcare = await prisma.sector.upsert({
    where: { slug: "healthcare" },
    update: {},
    create: { name: "Healthcare", slug: "healthcare", regionId: northAmerica.id },
  });
  const financials = await prisma.sector.upsert({
    where: { slug: "financials" },
    update: {},
    create: { name: "Financials", slug: "financials", regionId: northAmerica.id },
  });
  const energy = await prisma.sector.upsert({
    where: { slug: "energy" },
    update: {},
    create: { name: "Energy", slug: "energy", regionId: northAmerica.id },
  });
  const euTech = await prisma.sector.upsert({
    where: { slug: "eu-technology" },
    update: {},
    create: { name: "EU Technology", slug: "eu-technology", regionId: europe.id },
  });
  const euFinancials = await prisma.sector.upsert({
    where: { slug: "eu-financials" },
    update: {},
    create: { name: "EU Financials", slug: "eu-financials", regionId: europe.id },
  });
  const apacTech = await prisma.sector.upsert({
    where: { slug: "apac-technology" },
    update: {},
    create: { name: "APAC Technology", slug: "apac-technology", regionId: asiaPacific.id },
  });

  // Companies
  const companies = [
    { name: "Apple Inc", slug: "apple", sectorId: technology.id },
    { name: "Microsoft", slug: "microsoft", sectorId: technology.id },
    { name: "NVIDIA", slug: "nvidia", sectorId: technology.id },
    { name: "Alphabet", slug: "alphabet", sectorId: technology.id },
    { name: "Amazon", slug: "amazon", sectorId: technology.id },
    { name: "Pfizer", slug: "pfizer", sectorId: healthcare.id },
    { name: "UnitedHealth", slug: "unitedhealth", sectorId: healthcare.id },
    { name: "Johnson & Johnson", slug: "johnson-johnson", sectorId: healthcare.id },
    { name: "JPMorgan Chase", slug: "jpmorgan", sectorId: financials.id },
    { name: "Goldman Sachs", slug: "goldman-sachs", sectorId: financials.id },
    { name: "Bank of America", slug: "bank-of-america", sectorId: financials.id },
    { name: "ExxonMobil", slug: "exxonmobil", sectorId: energy.id },
    { name: "Chevron", slug: "chevron", sectorId: energy.id },
    { name: "ASML", slug: "asml", sectorId: euTech.id },
    { name: "SAP", slug: "sap", sectorId: euTech.id },
    { name: "Deutsche Bank", slug: "deutsche-bank", sectorId: euFinancials.id },
    { name: "HSBC", slug: "hsbc", sectorId: euFinancials.id },
    { name: "Samsung", slug: "samsung", sectorId: apacTech.id },
    { name: "TSMC", slug: "tsmc", sectorId: apacTech.id },
    { name: "Sony", slug: "sony", sectorId: apacTech.id },
  ];

  for (const company of companies) {
    await prisma.company.upsert({
      where: { slug: company.slug },
      update: {},
      create: company,
    });
  }

  // Tags
  const tagNames = [
    "earnings", "megacap", "growth", "value", "dividend",
    "ai", "semiconductor", "pharma", "banking", "oil-gas",
    "macro", "credit", "equity", "fixed-income", "esg",
  ];

  for (const name of tagNames) {
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Demo users
  const passwordHash = await hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "alice@fund.com" },
    update: {},
    create: {
      name: "Alice Chen",
      email: "alice@fund.com",
      passwordHash,
      role: "SENIOR_ANALYST",
      apiKey: "ak_alice_demo_key_001",
    },
  });

  await prisma.user.upsert({
    where: { email: "bob@fund.com" },
    update: {},
    create: {
      name: "Bob Martinez",
      email: "bob@fund.com",
      passwordHash,
      role: "ANALYST",
      apiKey: "ak_bob_demo_key_002",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@fund.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@fund.com",
      passwordHash,
      role: "ADMIN",
      apiKey: "ak_admin_demo_key_003",
    },
  });

  // Demo documents
  const alice = await prisma.user.findUnique({ where: { email: "alice@fund.com" } });
  const bob = await prisma.user.findUnique({ where: { email: "bob@fund.com" } });
  const apple = await prisma.company.findUnique({ where: { slug: "apple" } });
  const nvidia = await prisma.company.findUnique({ where: { slug: "nvidia" } });
  const jpmorgan = await prisma.company.findUnique({ where: { slug: "jpmorgan" } });
  const earningsTag = await prisma.tag.findUnique({ where: { name: "earnings" } });
  const aiTag = await prisma.tag.findUnique({ where: { name: "ai" } });

  if (alice && bob && apple && nvidia && jpmorgan && earningsTag && aiTag) {
    await prisma.document.upsert({
      where: { slug: "apple-q4-2025-analysis" },
      update: {},
      create: {
        slug: "apple-q4-2025-analysis",
        title: "Apple Q4 2025 Earnings Analysis",
        type: "COMPANY_RESEARCH",
        source: "obsidian",
        authorId: alice.id,
        content: `# Apple Q4 2025 Earnings Analysis

## Summary

Apple reported Q4 FY2025 revenue of $94.9B, beating consensus estimates of $93.2B. iPhone revenue came in at $46.2B, up 6% YoY, driven by strong demand for the iPhone 16 Pro series.

## Key Metrics

| Metric | Q4 2025 | Q4 2024 | YoY Change |
|--------|---------|---------|------------|
| Revenue | $94.9B | $89.5B | +6.0% |
| Gross Margin | 46.2% | 45.2% | +100bps |
| EPS | $1.64 | $1.46 | +12.3% |
| iPhone Revenue | $46.2B | $43.8B | +5.5% |
| Services Revenue | $25.0B | $22.3B | +12.1% |

## Thesis

Services continues to be the margin expansion story. With 1B+ paid subscriptions, the recurring revenue base provides significant downside protection. AI features in iOS 19 could drive an upgrade supercycle in FY2026.

## Risks

- China market share erosion from Huawei
- Regulatory pressure on App Store fees (EU DMA)
- Consumer spending slowdown in a higher-rate environment

## Conviction: 4/5

Strong buy on services growth trajectory and AI optionality.`,
        companies: {
          create: [{ companyId: apple.id }],
        },
        tags: {
          create: [{ tagId: earningsTag.id }],
        },
      },
    });

    await prisma.document.upsert({
      where: { slug: "nvidia-ai-infrastructure-deep-dive" },
      update: {},
      create: {
        slug: "nvidia-ai-infrastructure-deep-dive",
        title: "NVIDIA AI Infrastructure Deep Dive",
        type: "COMPANY_RESEARCH",
        source: "obsidian",
        authorId: alice.id,
        content: `# NVIDIA AI Infrastructure Deep Dive

## Overview

NVIDIA continues to dominate the AI accelerator market with an estimated 80%+ market share in data center GPUs. The transition from H100 to B200 architecture represents a generational leap in training efficiency.

## Data Center Revenue Trajectory

| Quarter | Data Center Revenue | QoQ Growth |
|---------|-------------------|------------|
| Q1 FY26 | $26.3B | +12% |
| Q2 FY26 | $30.0B | +14% |
| Q3 FY26 | $35.1B | +17% |
| Q4 FY26E | $41.0B | +17% |

## Competitive Moat

1. **CUDA ecosystem lock-in** — 4M+ developers, 15 years of software stack
2. **Networking (Mellanox)** — InfiniBand dominance in hyperscaler interconnects
3. **Full-stack offering** — DGX, HGX, Grace Hopper, NVLink, networking

## Key Risk

Customer concentration: Top 4 hyperscalers represent ~50% of data center revenue. Any capex pullback would have outsized impact.

## Valuation

Trading at 35x forward P/E, which looks reasonable given 50%+ revenue growth expectations. DCF suggests $180 fair value.`,
        companies: {
          create: [{ companyId: nvidia.id }],
        },
        tags: {
          create: [{ tagId: aiTag.id }],
        },
      },
    });

    await prisma.document.upsert({
      where: { slug: "jpmorgan-credit-outlook-2026" },
      update: {},
      create: {
        slug: "jpmorgan-credit-outlook-2026",
        title: "JPMorgan Credit Outlook 2026",
        type: "BROKER_RESEARCH",
        source: "databricks",
        sourceRef: "silver/broker-research/jpmorgan/credit-outlook-2026.md",
        authorId: bob.id,
        content: `# JPMorgan Credit Outlook 2026

## Executive Summary

JPMorgan's credit research team projects a benign credit environment for 2026, with default rates expected to remain below long-term averages. Investment grade spreads are tight but justified by strong corporate fundamentals.

## Key Forecasts

| Metric | 2025A | 2026E |
|--------|-------|-------|
| IG Default Rate | 0.3% | 0.4% |
| HY Default Rate | 2.1% | 2.5% |
| IG Spread (OAS) | 95bps | 105bps |
| HY Spread (OAS) | 350bps | 380bps |

## Sector Views

- **Technology**: Overweight — strong free cash flow generation, low leverage
- **Healthcare**: Neutral — patent cliffs offset by M&A activity
- **Energy**: Underweight — commodity price volatility, transition risks
- **Financials**: Overweight — robust capital positions, NIM expansion

## Risks to Outlook

1. Geopolitical escalation (Middle East, Taiwan Strait)
2. Fed policy error (too tight for too long)
3. Commercial real estate refinancing wave

*Source: JPMorgan Credit Research, March 2026*`,
        companies: {
          create: [{ companyId: jpmorgan.id }],
        },
      },
    });

    // Demo votes
    await prisma.vote.upsert({
      where: { userId_companyId: { userId: alice.id, companyId: apple.id } },
      update: {},
      create: {
        userId: alice.id,
        companyId: apple.id,
        conviction: 4,
        rationale: "Strong services growth, AI optionality underpriced",
      },
    });

    await prisma.vote.upsert({
      where: { userId_companyId: { userId: alice.id, companyId: nvidia.id } },
      update: {},
      create: {
        userId: alice.id,
        companyId: nvidia.id,
        conviction: 5,
        rationale: "Dominant AI infrastructure position, multi-year growth runway",
      },
    });

    await prisma.vote.upsert({
      where: { userId_companyId: { userId: bob.id, companyId: apple.id } },
      update: {},
      create: {
        userId: bob.id,
        companyId: apple.id,
        conviction: 3,
        rationale: "Fair value, limited upside from current levels",
      },
    });
  }

  console.log("Seed completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
