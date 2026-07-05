/**
 * One-time cleanup: strips the stray `type` field from media[] array items.
 * That field was written by old Bulk Import / Fetch-from-URL code but was
 * never part of the mediaItem schema, causing "Unknown field found" warnings.
 *
 * Safe to run multiple times — only touches products that still have it.
 *
 * Run: node scripts/cleanup-media-type-field.js
 * Dry run (preview only, no writes): node scripts/cleanup-media-type-field.js --dry
 */

'use strict'

require('dotenv').config()
const client = require('../lib/sanityClient')

const DRY = process.argv.includes('--dry')

async function main() {
  console.log(`Dataset: ${client.config().dataset}`)
  console.log(DRY ? '[DRY RUN] No writes will happen.\n' : '')

  const products = await client.fetch(`
    *[_type == "product" && count(media[defined(type)]) > 0]{_id, name, media}
  `)

  console.log(`Products with a stray media[].type field: ${products.length}`)
  for (const p of products) {
    const cleanedMedia = (p.media || []).map(({type, ...rest}) => rest)
    console.log(`${DRY ? '[DRY] ' : ''}${p.name || p._id} — stripping type from ${p.media.length} media item(s)`)
    if (!DRY) {
      await client.patch(p._id).set({media: cleanedMedia}).commit()
    }
  }

  console.log('\nDone.')
  if (DRY) console.log('Run without --dry to apply changes.')
}

main().catch((e) => {
  console.error('Cleanup failed:', e.message)
  process.exit(1)
})
