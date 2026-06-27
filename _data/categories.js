const client = require('../lib/sanityClient');

module.exports = async function () {
  const all = await client.fetch(`
    *[_type == "category"] | order(name asc) {
      name
    }
  `);
  // Deduplicate by lowercased name
  const seen = new Set();
  return all.filter((c) => {
    const key = (c.name || '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
