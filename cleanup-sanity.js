/**
 * Cleanup script — removes orphan/duplicate Sanity documents not created by
 * seed-sanity.js. Fixes broken references before deleting to avoid constraint errors.
 *
 * Usage: node cleanup-sanity.js
 */

require('dotenv').config();
const { createClient } = require('@sanity/client');

if (!process.env.SANITY_TOKEN) {
  console.error('Error: SANITY_TOKEN not set. Add it to .env');
  process.exit(1);
}

const client = createClient({
  projectId: '2qbe726s',
  dataset: process.env.SANITY_DATASET || 'dev',
  useCdn: false,
  apiVersion: '2026-06-26',
  token: process.env.SANITY_TOKEN,
});

const VALID_IDS = new Set([
  'country-us', 'country-ca', 'country-in',
  'category-home', 'category-health', 'category-tech', 'category-travel',
  'marketplace-amazon-us', 'marketplace-amazon-ca', 'marketplace-amazon-in',
  'marketplace-temu', 'marketplace-flipkart',
]);

async function cleanup() {
  console.log(`FindsRadar — Sanity cleanup  (dataset: ${process.env.SANITY_DATASET || 'dev'})\n`);

  // ── Step 1: Fix marketplace → country references ──────────────────────────
  console.log('Step 1: Fixing marketplace → country references...');
  const marketplaces = await client.fetch(`*[_type == "marketplace"]{ _id, name, "countryRef": country._ref }`);
  for (const mp of marketplaces) {
    if (mp.countryRef && !VALID_IDS.has(mp.countryRef)) {
      await client.patch(mp._id)
        .set({ country: { _type: 'reference', _ref: 'country-us' } })
        .commit();
      console.log(`  ↻ re-pointed country on marketplace: ${mp.name || mp._id}`);
    }
  }

  // ── Step 2: Fix product → marketplace / country references ────────────────
  console.log('Step 2: Fixing product → marketplace / country references...');
  const products = await client.fetch(`*[_type == "product"]{ _id, name, "mpRef": marketplace._ref, "countryRef": country._ref }`);
  for (const p of products) {
    const patch = {};
    if (p.mpRef && !VALID_IDS.has(p.mpRef)) {
      patch.marketplace = { _type: 'reference', _ref: 'marketplace-amazon-us' };
    }
    if (p.countryRef && !VALID_IDS.has(p.countryRef)) {
      patch.country = { _type: 'reference', _ref: 'country-us' };
    }
    if (Object.keys(patch).length) {
      await client.patch(p._id).set(patch).commit();
      console.log(`  ↻ fixed references on product: ${p.name || p._id}`);
    }
  }

  // ── Step 2b: Fix product → category array references ─────────────────────
  console.log('Step 2b: Fixing product → category array references...');
  const productsWithCats = await client.fetch(`*[_type == "product"]{ _id, name, "catRefs": categories[]._ref }`);
  for (const p of productsWithCats) {
    const refs = p.catRefs || [];
    const hasOrphan = refs.some((r) => !VALID_IDS.has(r));
    if (hasOrphan) {
      const cleanRefs = refs
        .filter((r) => VALID_IDS.has(r))
        .map((r) => ({ _type: 'reference', _ref: r, _key: r }));
      await client.patch(p._id).set({ categories: cleanRefs }).commit();
      console.log(`  ↻ fixed category refs on product: ${p.name || p._id}`);
    }
  }

  // ── Step 3: Delete orphans in safe order (marketplaces → categories → countries) ──
  const deleteOrder = ['marketplace', 'category', 'country'];
  for (const type of deleteOrder) {
    const docs = await client.fetch(`*[_type == $type]{ _id, name, code, "slug": slug.current }`, { type });
    const orphans = docs.filter((d) => !VALID_IDS.has(d._id));
    if (orphans.length === 0) {
      console.log(`✓ ${type} — no orphans`);
      continue;
    }
    console.log(`\nDeleting ${orphans.length} orphan ${type} document(s):`);
    for (const doc of orphans) {
      const label = doc.name || doc.code || doc.slug || doc._id;
      await client.delete(doc._id);
      console.log(`  ✗ deleted: ${doc._id}  (${label})`);
    }
  }

  // ── Step 4: Delete duplicate products (keep seed IDs, delete auto-generated) ──
  console.log('\nStep 4: Deduplicating products...');
  const allProducts = await client.fetch('*[_type == "product"]{ _id, name }');
  const grouped = {};
  allProducts.forEach((p) => {
    const key = (p.name || '').toLowerCase().trim();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });
  for (const [, group] of Object.entries(grouped)) {
    if (group.length < 2) continue;
    // Keep the seed document (id starts with "product-"), delete the rest
    const toDelete = group.filter((p) => !p._id.startsWith('product-'));
    for (const doc of toDelete) {
      await client.delete(doc._id);
      console.log(`  ✗ deleted duplicate product: ${doc._id}  (${doc.name})`);
    }
  }

  console.log('\nDone. Run npm run dev to rebuild.\n');
}

cleanup().catch((err) => {
  console.error('\nCleanup failed:', err.message);
  process.exit(1);
});
