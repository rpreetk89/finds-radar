require('dotenv').config();
const { createClient } = require('@sanity/client');

module.exports = createClient({
  projectId: '2qbe726s',
  dataset: process.env.SANITY_DATASET || 'dev',
  useCdn: false,
  apiVersion: '2026-06-26',
  token: process.env.SANITY_TOKEN,
});
