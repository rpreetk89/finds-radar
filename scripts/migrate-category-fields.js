/**
 * One-time migration for the category schema field swap:
 *   - OLD: name = backend matching key + URL slug, display_name = catchy public label (optional)
 *   - NEW: name = catchy public label, slug ("Short Code") = backend matching key + URL slug
 *
 * For every category document:
 *   new name  = old display_name if set, else old name   (public label carries over unchanged)
 *   new slug  = slugify(old name)                         (matches today's URL/matching key exactly —
 *                                                           the old slug value, if any, is intentionally
 *                                                           discarded so live URLs do not change here)
 * Then removes the now-unused display_name field.
 *
 * Two categories whose names slugify to the same value would violate the new Short Code
 * uniqueness rule — these are reported and skipped rather than silently colliding.
 *
 * Safe to run multiple times.
 * Run against both datasets: SANITY_DATASET=dev / SANITY_DATASET=production
 *
 * Run: node scripts/migrate-category-fields.js
 * Dry run (preview only, no writes): node scripts/migrate-category-fields.js --dry
 */

'use strict'

require('dotenv').config()
const client = require('../lib/sanityClient')

const DRY = process.argv.includes('--dry')

function slugify(value) {
  return (value || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

async function main() {
  console.log(`Dataset: ${client.config().dataset}`)
  console.log(DRY ? '[DRY RUN] No writes will happen.\n' : '')

  const categories = await client.fetch(`*[_type == "category"]{_id, name, display_name, "slug": slug.current}`)
  console.log(`Categories found: ${categories.length}\n`)

  const seenSlugs = new Map() // newSlug -> category _id that claimed it
  const plans = []

  for (const cat of categories) {
    const newName = (cat.display_name || cat.name || '').trim()
    const newSlug = slugify(cat.name)

    if (!newName || !newSlug) {
      console.log(`  [SKIP] "${cat.name || cat._id}" — missing name, cannot derive a Short Code.`)
      continue
    }
    if (seenSlugs.has(newSlug)) {
      console.log(
        `  [COLLISION] "${cat.name}" → Short Code "${newSlug}" already claimed by "${seenSlugs.get(newSlug)}". ` +
        `Skipped — resolve manually in Studio (rename one, then re-run).`,
      )
      continue
    }
    seenSlugs.set(newSlug, cat.name)
    plans.push({cat, newName, newSlug})
  }

  for (const {cat, newName, newSlug} of plans) {
    const changingName = newName !== cat.name
    const changingSlug = newSlug !== cat.slug
    console.log(
      `${DRY ? '[DRY] ' : ''}${cat.name}` +
      `${changingName ? ` → name: "${newName}"` : ''}` +
      `${changingSlug ? ` → slug: "${newSlug}"` : ' (slug unchanged)'}`,
    )
    if (!DRY) {
      await client
        .patch(cat._id)
        .set({name: newName, slug: {_type: 'slug', current: newSlug}})
        .unset(['display_name'])
        .commit()
    }
  }

  console.log('\nDone.')
  if (DRY) console.log('Run without --dry to apply changes.')
}

main().catch((e) => {
  console.error('Migration failed:', e.message)
  process.exit(1)
})
