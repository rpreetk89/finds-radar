// DATA-SOURCE: sanity
const client = require('../lib/sanityClient')

module.exports = async function () {
  const all = await client.fetch(`
    *[_type == "country"] | order(isDefault desc, name asc) {
      name, code, flag, isDefault, showInNav
    }
  `)
  const seen = new Set()
  return all
    .map((c) => ({...c, code: (c.code || '').toLowerCase()}))
    .filter((c) => {
      if (!c.code || seen.has(c.code)) return false
      seen.add(c.code)
      return true
    })
}
