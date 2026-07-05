/**
 * One-time cleanup: removes the `price` field from existing product documents.
 * The price field was removed from the schema — FindsRadar never displays
 * price anywhere on the public site, so it was dropped entirely rather than
 * kept hidden. This clears the stray value so Studio doesn't show an
 * "Unknown field found" warning on existing products.
 *
 * Safe to run multiple times — only touches products that still have it.
 *
 * Run: node scripts/cleanup-price-field.js
 * Dry run (preview only, no writes): node scripts/cleanup-price-field.js --dry
 */

'use strict'

require('dotenv').config()
const client = require('../lib/sanityClient')

const DRY = process.argv.includes('--dry')

async function main() {
  console.log(`Dataset: ${client.config().dataset}`)
  console.log(DRY ? '[DRY RUN] No writes will happen.\n' : '')

  const products = await client.fetch(`*[_type == "product" && defined(price)]{_id, name}`)
  console.log(`Products with a price field: ${products.length}`)

  for (const p of products) {
    console.log(`${DRY ? '[DRY] ' : ''}Unsetting price on: ${p.name || p._id}`)
    if (!DRY) {
      await client.patch(p._id).unset(['price']).commit()
    }
  }

  console.log('\nDone.')
  if (DRY) console.log('Run without --dry to apply changes.')
}

main().catch((e) => {
  console.error('Cleanup failed:', e.message)
  process.exit(1)
})
