/**
 * Seed script — sets up taxonomy scaffold in a Sanity dataset.
 * Creates countries, categories, and marketplaces with deterministic IDs.
 * Products are managed directly in Sanity Studio — not seeded here.
 *
 * Usage:
 *   $env:SANITY_TOKEN="<write-token>"; $env:SANITY_DATASET="dev"; node seed-sanity.js
 *
 * Generate a write token at: https://sanity.io/manage → your project → API → Tokens (Editor role)
 */

require('dotenv').config();
const { createClient } = require('@sanity/client');

const token = process.env.SANITY_TOKEN || process.argv[2];
if (!token) {
  console.error('\nError: SANITY_TOKEN not set.\n');
  console.error('  PowerShell: $env:SANITY_TOKEN="<token>"; node seed-sanity.js\n');
  process.exit(1);
}

const dataset = process.env.SANITY_DATASET || 'dev';

const client = createClient({
  projectId: '2qbe726s',
  dataset,
  useCdn: false,
  apiVersion: '2026-06-26',
  token,
});

// ── Scaffold data ─────────────────────────────────────────────────────────────

const COUNTRIES = [
  { _id: 'country-us', name: 'United States', code: 'us', isDefault: true },
  { _id: 'country-ca', name: 'Canada',        code: 'ca', isDefault: false },
  { _id: 'country-in', name: 'India',         code: 'in', isDefault: false },
];

const CATEGORIES = [
  { _id: 'category-home',   name: 'Home' },
  { _id: 'category-health', name: 'Health' },
  { _id: 'category-tech',   name: 'Tech' },
  { _id: 'category-travel', name: 'Travel' },
];

const MARKETPLACES = [
  { _id: 'marketplace-amazon-us', name: 'Amazon US', domain: 'amazon.com',    slug: 'amazon-us', countryId: 'country-us' },
  { _id: 'marketplace-amazon-ca', name: 'Amazon CA', domain: 'amazon.ca',     slug: 'amazon-ca', countryId: 'country-ca' },
  { _id: 'marketplace-amazon-in', name: 'Amazon IN', domain: 'amazon.in',     slug: 'amazon-in', countryId: 'country-in' },
  { _id: 'marketplace-temu',      name: 'Temu',      domain: 'temu.com',      slug: 'temu',      countryId: 'country-us' },
  { _id: 'marketplace-flipkart',  name: 'Flipkart',  domain: 'flipkart.com',  slug: 'flipkart',  countryId: 'country-in' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function ref(id) {
  return { _type: 'reference', _ref: id };
}

// ── Seed functions ────────────────────────────────────────────────────────────

async function seedCountries() {
  console.log('\nSeeding countries...');
  for (const c of COUNTRIES) {
    await client.createOrReplace({ _type: 'country', ...c });
    console.log(`  ✓ ${c.name} (${c.code})`);
  }
}

async function seedCategories() {
  console.log('\nSeeding categories...');
  for (const c of CATEGORIES) {
    await client.createOrReplace({ _type: 'category', ...c });
    console.log(`  ✓ ${c.name}`);
  }
}

async function seedMarketplaces() {
  console.log('\nSeeding marketplaces...');
  for (const mp of MARKETPLACES) {
    await client.createOrReplace({
      _type: 'marketplace',
      _id: mp._id,
      name: mp.name,
      domain: mp.domain,
      slug: { _type: 'slug', current: mp.slug },
      country: ref(mp.countryId),
    });
    console.log(`  ✓ ${mp.name}  (${mp.domain})`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`FindsRadar — seed scaffold  (dataset: ${dataset})`);
  console.log('Products are added via Sanity Studio, not seeded here.\n');

  await seedCountries();
  await seedCategories();
  await seedMarketplaces();

  console.log('\nScaffold ready. Open Sanity Studio to add products:');
  console.log('  localhost:8080/cms/dev   (local)\n');
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
