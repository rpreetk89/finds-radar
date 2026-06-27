const client = require('../lib/sanityClient');

module.exports = async function () {
  const all = await client.fetch(`
    *[_type == "country"] | order(isDefault desc, name asc) {
      name,
      code,
      flag,
      isDefault
    }
  `);
  // Deduplicate by code — Sanity may have duplicate documents from manual + seed entry
  const seen = new Set();
  return all
    .map((c) => ({ ...c, code: (c.code || '').toLowerCase() }))
    .filter((c) => {
      if (!c.code || seen.has(c.code)) return false;
      seen.add(c.code);
      return true;
    });
};
