const { createClient } = require('@sanity/client');

const client = createClient({
  projectId: '2qbe726s',
  dataset: 'dev', // Switch to 'production' once you import your data
  useCdn: true,
  apiVersion: '2026-06-26'
});

module.exports = async function() {
  // This query gets products and "joins" the referenced fields
  return await client.fetch(`
    *[_type == "product"]{
      name,
      description,
      affiliate_link,
      "marketplace": marketplace->name,
      "country": country->name,
      "categories": categories[]->name,
      media
    }
  `);
};