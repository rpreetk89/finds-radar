// DATA-SOURCE: sanity
const client = require('../lib/sanityClient')

module.exports = async function () {
  const all = await client.fetch(`
    *[_type == "category"] | order(name asc) { name, "slug": slug.current }
  `)
  const seen = new Set()
  return all.filter((c) => {
    const key = (c.slug || '').toLowerCase().trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
