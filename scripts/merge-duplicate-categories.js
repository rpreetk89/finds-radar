/**
 * One-time cleanup: merges duplicate category documents that were created by the old
 * bulk-import matching bug (exact Name match only — "tech" didn't match "Technology",
 * "Wellness" didn't match "Health", so a stray duplicate category got created each time).
 *
 * For each {duplicate, canonical} pair below (matched by current `name` field):
 *   - Every product referencing `duplicate` is repointed to `canonical` instead
 *     (de-duplicated if a product somehow already referenced both).
 *   - The `duplicate` category document (and its draft, if any) is deleted.
 *
 * Run this BEFORE scripts/migrate-category-fields.js, so the field-shape migration
 * only has to deal with the surviving, de-duplicated set of categories.
 *
 * Run against both datasets: SANITY_DATASET=dev / SANITY_DATASET=production
 *
 * Run: node scripts/merge-duplicate-categories.js
 * Dry run (preview only, no writes): node scripts/merge-duplicate-categories.js --dry
 */

'use strict'

require('dotenv').config()
const client = require('../lib/sanityClient')

const DRY = process.argv.includes('--dry')

const MERGES = [
  {duplicate: 'Tech', canonical: 'Technology'},
  {duplicate: 'Wellness', canonical: 'Health'},
]

async function findByName(name) {
  return client.fetch(`*[_type == "category" && name == $name][0]{_id, name}`, {name})
}

async function main() {
  console.log(`Dataset: ${client.config().dataset}`)
  console.log(DRY ? '[DRY RUN] No writes will happen.\n' : '')

  for (const {duplicate, canonical} of MERGES) {
    const dupDoc = await findByName(duplicate)
    const canonDoc = await findByName(canonical)

    if (!dupDoc) {
      console.log(`[SKIP] No category named "${duplicate}" found — already merged?`)
      continue
    }
    if (!canonDoc) {
      console.log(`[SKIP] Canonical category "${canonical}" not found — cannot merge "${duplicate}" into it.`)
      continue
    }

    const dupId = dupDoc._id
    const canonId = canonDoc._id

    const referencingProducts = await client.fetch(
      `*[_type == "product" && references($dupId)]{_id, categories}`,
      {dupId},
    )

    console.log(`\n"${duplicate}" (${dupId}) → "${canonical}" (${canonId})`)
    console.log(`  Products referencing "${duplicate}": ${referencingProducts.length}`)

    for (const product of referencingProducts) {
      const seenRefs = new Set()
      const newCategories = []
      for (const c of product.categories || []) {
        const ref = c._ref === dupId ? canonId : c._ref
        if (seenRefs.has(ref)) continue
        seenRefs.add(ref)
        newCategories.push({...c, _ref: ref})
      }
      console.log(`  ${DRY ? '[DRY] ' : ''}repoint product ${product._id}`)
      if (!DRY) {
        await client.patch(product._id).set({categories: newCategories}).commit()
      }
    }

    console.log(`  ${DRY ? '[DRY] would delete' : 'deleting'} category doc "${duplicate}" (${dupId})`)
    if (!DRY) {
      for (const id of [dupId, `drafts.${dupId}`]) {
        try {
          await client.delete(id)
        } catch (e) {
          // no draft counterpart — fine
        }
      }
    }
  }

  console.log('\nDone.')
  if (DRY) console.log('Run without --dry to apply changes.')
}

main().catch((e) => {
  console.error('Merge failed:', e.message)
  process.exit(1)
})
