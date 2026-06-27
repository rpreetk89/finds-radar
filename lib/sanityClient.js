require('dotenv').config();
const { createClient } = require('@sanity/client');

if (!process.env.SANITY_TOKEN) {
  console.warn('\n⚠ [FindsRadar] SANITY_TOKEN is not set — Sanity queries will be unauthenticated and return empty results.\n');
}

module.exports = createClient({
  projectId: '2qbe726s',
  dataset: process.env.SANITY_DATASET || 'dev',
  useCdn: false,
  apiVersion: '2026-06-26',
  token: process.env.SANITY_TOKEN,
});
