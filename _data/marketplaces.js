// DATA-SOURCE: sanity
const client = require('../lib/sanityClient')

module.exports = async function () {
  const all = await client.fetch(`
    *[_type == "marketplace"] | order(country->code asc, name asc) {
      name,
      display_name,
      domain,
      "slug": slug.current,
      "country": country->{ name, code, flag }
    }
  `)
  const seen = new Set()
  return all
    .map((mp) => ({...mp, slug: (mp.slug || '').toLowerCase()}))
    .filter((mp) => {
      if (!mp.slug || seen.has(mp.slug)) return false
      seen.add(mp.slug)
      return true
    })
}
