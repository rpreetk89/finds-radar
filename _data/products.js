// DATA-SOURCE: sanity
const client = require('../lib/sanityClient')

module.exports = async function () {
  const all = await client.fetch(`
    *[_type == "product" &&
      (status == "published" || (!defined(status) && published != false)) &&
      !defined(deleted_at)
    ] | order(name asc) {
      _id,
      _createdAt,
      name,
      description,
      price,
      affiliate_link,
      featured,
      "categories": categories[]->name,
      "marketplace": marketplace->{ name, "slug": slug.current },
      "country": country->{ name, code, flag },
      media[] { "url": coalesce(asset->url, url), type }
    }
  `)
  // Prefer seed IDs (start with "product-"), deduplicate by name
  all.sort((a, b) => {
    const aIsSeed = a._id.startsWith('product-') ? -1 : 1
    const bIsSeed = b._id.startsWith('product-') ? -1 : 1
    return aIsSeed - bIsSeed
  })
  const nameSeen = new Set()
  const products = all.filter((p) => {
    const key = (p.name || '').toLowerCase().trim()
    if (!key || nameSeen.has(key)) return false
    nameSeen.add(key)
    return true
  })
  return {products}
}
