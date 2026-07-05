/**
 * One-time backfill: sets display_name (and slug, for categories) on existing
 * category and marketplace documents that don't have one yet.
 *
 * Safe to run multiple times — only touches documents missing the field.
 * Run against both datasets: SANITY_DATASET=dev / SANITY_DATASET=production
 *
 * Run: node scripts/backfill-display-names.js
 * Dry run (preview only, no writes): node scripts/backfill-display-names.js --dry
 */

'use strict'

require('dotenv').config()
const client = require('../lib/sanityClient')

const DRY = process.argv.includes('--dry')

const CATEGORY_DISPLAY_NAMES = {
  fashion: {slug: 'fashion', display_name: 'Fashion Finds'},
  health: {slug: 'health', display_name: 'Wellness Finds'},
  home: {slug: 'home', display_name: 'Home Finds'},
  technology: {slug: 'tech', display_name: 'Tech Finds'},
  travel: {slug: 'travel', display_name: 'Travel Finds'},
}

const MARKETPLACE_DISPLAY_NAMES = {
  'amazon us': 'Amazon',
  'amazon ca': 'Amazon',
  'amazon in': 'Amazon',
  'flipkart in': 'Flipkart',
  'temu us': 'Temu',
}

async function main() {
  console.log(`Dataset: ${client.config().dataset}`)
  console.log(DRY ? '[DRY RUN] No writes will happen.\n' : '')

  // ── Categories ──────────────────────────────────────────────────────────
  const categories = await client.fetch(`*[_type == "category" && !defined(display_name)]{_id, name}`)
  console.log(`Categories missing display_name: ${categories.length}`)
  for (const cat of categories) {
    const key = (cat.name || '').toLowerCase().trim()
    const mapped = CATEGORY_DISPLAY_NAMES[key]
    if (!mapped) {
      console.log(`  [SKIP] No suggested display name for category "${cat.name}" — add it manually in Studio.`)
      continue
    }
    console.log(`${DRY ? '[DRY] ' : ''}${cat.name} → slug: "${mapped.slug}", display_name: "${mapped.display_name}"`)
    if (!DRY) {
      await client.patch(cat._id).setIfMissing({slug: {_type: 'slug', current: mapped.slug}, display_name: mapped.display_name}).commit()
    }
  }

  // ── Marketplaces ────────────────────────────────────────────────────────
  const marketplaces = await client.fetch(`*[_type == "marketplace" && !defined(display_name)]{_id, name}`)
  console.log(`\nMarketplaces missing display_name: ${marketplaces.length}`)
  for (const mp of marketplaces) {
    const key = (mp.name || '').toLowerCase().trim()
    const displayName = MARKETPLACE_DISPLAY_NAMES[key]
    if (!displayName) {
      console.log(`  [SKIP] No suggested display name for marketplace "${mp.name}" — add it manually in Studio.`)
      continue
    }
    console.log(`${DRY ? '[DRY] ' : ''}${mp.name} → display_name: "${displayName}"`)
    if (!DRY) {
      await client.patch(mp._id).setIfMissing({display_name: displayName}).commit()
    }
  }

  console.log('\nDone.')
  if (DRY) console.log('Run without --dry to apply changes.')
}

main().catch((e) => {
  console.error('Backfill failed:', e.message)
  process.exit(1)
})
