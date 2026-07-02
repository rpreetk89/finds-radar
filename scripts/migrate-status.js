/**
 * One-time migration: converts published/auto_unpublished boolean fields
 * to the new status enum (draft | published | inactive).
 *
 * Safe to run multiple times — skips products that already have a status field.
 *
 * Run: node scripts/migrate-status.js
 * Dry run (preview only, no writes): node scripts/migrate-status.js --dry
 */

'use strict'

require('dotenv').config()
const client = require('../lib/sanityClient')

const DRY = process.argv.includes('--dry')

async function main() {
  console.log(DRY ? '[DRY RUN] No writes will happen.\n' : '')

  // Fetch all products that still use the old boolean schema
  const products = await client.fetch(`
    *[_type == "product" && !defined(status)] {
      _id, name, published, auto_unpublished, unpublish_reason, _updatedAt
    }
  `)

  console.log(`Found ${products.length} products to migrate.\n`)
  if (products.length === 0) {
    console.log('Nothing to do — all products already have a status field.')
  }

  let published = 0, inactive = 0, draft = 0

  for (const p of products) {
    let newStatus, inactiveReason, changedBy, inactiveSince

    if (p.auto_unpublished === true) {
      newStatus = 'inactive'
      inactiveReason = 'broken_link'
      changedBy = 'system:link-checker'
      inactiveSince = p._updatedAt
      inactive++
    } else if (p.published === false) {
      newStatus = 'inactive'
      inactiveReason = 'manual'
      changedBy = 'operator'
      inactiveSince = p._updatedAt
      inactive++
    } else {
      // published == true or published is undefined (default was live)
      newStatus = 'published'
      changedBy = 'operator'
      published++
    }

    const patch = {
      status: newStatus,
      changed_by: changedBy,
      ...(inactiveReason ? {inactive_reason: inactiveReason} : {}),
      ...(inactiveSince ? {inactive_since: inactiveSince} : {}),
    }

    console.log(
      `${DRY ? '[DRY] ' : ''}${p.name?.slice(0, 50) || p._id} → ${newStatus}${inactiveReason ? ` (${inactiveReason})` : ''}`,
    )

    if (!DRY) {
      await client.patch(p._id).set(patch).unset(['published', 'auto_unpublished', 'unpublish_reason']).commit()
    }
  }

  // Second pass: products already migrated but still carrying old boolean fields
  const stale = await client.fetch(`
    *[_type == "product" && defined(status) && (defined(published) || defined(auto_unpublished))] {
      _id, name
    }
  `)

  if (stale.length > 0) {
    console.log(`\nCleaning up legacy fields from ${stale.length} already-migrated product(s)…`)
    for (const p of stale) {
      console.log(`${DRY ? '[DRY] ' : ''}Unsetting old fields on: ${p.name?.slice(0, 50) || p._id}`)
      if (!DRY) {
        await client.patch(p._id).unset(['published', 'auto_unpublished', 'unpublish_reason']).commit()
      }
    }
  }

  console.log(`\nDone.`)
  console.log(`  → published: ${published}`)
  console.log(`  → inactive:  ${inactive}`)
  console.log(`  → draft:     ${draft}`)
  if (stale.length > 0) console.log(`  → cleaned up legacy fields: ${stale.length}`)

  if (DRY) console.log('\nRun without --dry to apply changes.')
}

main().catch((e) => {
  console.error('Migration failed:', e.message)
  process.exit(1)
})
