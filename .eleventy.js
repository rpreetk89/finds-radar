// Build-time cache — cleared before every build so dev-mode rebuilds get fresh Sanity data
let _cache = {};
async function cached(key, fn) {
  if (!_cache[key]) _cache[key] = await fn();
  return _cache[key];
}

module.exports = function (eleventyConfig) {
  // Clear Sanity cache before every build so dev-mode rebuilds fetch fresh data
  eleventyConfig.on('eleventy.before', () => { _cache = {}; });

  // ── Filters ──────────────────────────────────────────────────────────────
  eleventyConfig.addFilter('jsonify', (value) => JSON.stringify(value));
  eleventyConfig.addFilter('limit', (array, n) => array.slice(0, n));
  eleventyConfig.addFilter('split', (value, delimiter) => value.split(delimiter));
  eleventyConfig.addFilter('filterByCountry', (products, code) =>
    (products || []).filter((p) => p.country?.code === code),
  );
  eleventyConfig.addFilter('codeToCountry', (code, countriesList) => {
    const match = (countriesList || []).find((c) => c.code === (code || '').toLowerCase());
    return match ? match.name : code;
  });

  eleventyConfig.addFilter('featuredFirst', (arr) =>
    [...(arr || [])].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)),
  );
  eleventyConfig.addFilter('currentYear', () => new Date().getFullYear());

  // Sort products by _createdAt descending (newest first)
  eleventyConfig.addFilter('newestFirst', (arr) =>
    [...(arr || [])].sort((a, b) => new Date(b._createdAt || 0) - new Date(a._createdAt || 0)),
  );

  // Filter to products added within the last N days
  eleventyConfig.addFilter('addedWithinDays', (arr, days) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return (arr || []).filter((p) => p._createdAt && new Date(p._createdAt) >= cutoff);
  });

  // Return the most recently featured product; falls back to most recently added
  eleventyConfig.addFilter('featuredProduct', (arr) => {
    const all = arr || [];
    const pool = all.filter((p) => p.featured);
    const sorted = [...(pool.length ? pool : all)].sort(
      (a, b) => new Date(b._createdAt || 0) - new Date(a._createdAt || 0),
    );
    return sorted[0] || null;
  });

  // Return up to N manually-featured products, newest first. No fallback — shows fewer than N if fewer are featured.
  eleventyConfig.addFilter('topFeatured', (arr, count) => {
    const n = count || 10;
    return [...(arr || [])]
      .filter((p) => p.featured)
      .sort((a, b) => new Date(b._createdAt || 0) - new Date(a._createdAt || 0))
      .slice(0, n);
  });

  // Look up a category's public name by its backend short code; falls back to the short code itself
  eleventyConfig.addFilter('categoryDisplayName', (slug, categoriesList) => {
    const match = (categoriesList || []).find(
      (c) => (c.slug || '').toLowerCase() === (slug || '').toLowerCase(),
    );
    return match && match.name ? match.name : slug;
  });

  // Group US products into category rows for the homepage feed
  // Returns: [{ name, slug, totalCount, products: [up to 8, newest first] }] sorted by totalCount desc
  // Skips categories with fewer than 2 products
  eleventyConfig.addFilter('categoryRows', (products) => {
    const groups = {};
    (products || []).forEach((p) => {
      (p.categories || []).forEach((cat) => {
        if (!groups[cat]) groups[cat] = { name: cat, products: [] };
        groups[cat].products.push(p);
      });
    });
    return Object.values(groups)
      .filter((g) => g.products.length >= 2)
      .sort((a, b) => b.products.length - a.products.length)
      .map((g) => {
        const slug = g.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const sorted = [...g.products].sort(
          (a, b) => new Date(b._createdAt || 0) - new Date(a._createdAt || 0),
        );
        return { name: g.name, slug, totalCount: g.products.length, products: sorted.slice(0, 8) };
      });
  });

  // ── Static assets ─────────────────────────────────────────────────────────
  eleventyConfig.addPassthroughCopy('images');
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('_redirects');
  eleventyConfig.addPassthroughCopy('manifest.json');

  // ── Collection: flat list of categories (drives category-card grid) ───────
  eleventyConfig.addCollection('customCategories', async function () {
    const cats = await cached('categories', require('./_data/categories'));
    const seen = new Set();
    return cats
      .filter((c) => c.slug)
      .map((c) => c.slug.toLowerCase().trim())
      .filter((slug) => { if (seen.has(slug)) return false; seen.add(slug); return true; });
  });

  // ── Collection: flat list of countries (drives header selector) ───────────
  eleventyConfig.addCollection('countriesList', async function () {
    return cached('countries', require('./_data/countries'));
  });

  // ── Collection: allCountryData (all countries incl. US — drives /us/ /ca/ /in/ pages) ──
  eleventyConfig.addCollection('allCountryData', async function () {
    const all = await cached('countryData', async () => {
      const [productsResult, countries, marketplaces] = await Promise.all([
        cached('products', require('./_data/products')),
        cached('countries', require('./_data/countries')),
        cached('marketplaces', require('./_data/marketplaces')),
      ]);
      const products = productsResult.products;
      return countries.map((country) => {
        const countryMarketplaces = marketplaces
          .filter((mp) => mp.country?.code === country.code)
          .map((mp) => {
            const mpProducts = products.filter(
              (p) => p.country?.code === country.code && p.marketplace?.slug === mp.slug,
            );
            const categories = {};
            mpProducts.forEach((product) => {
              (product.categories || []).forEach((cat) => {
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(product);
              });
            });
            return { ...mp, categories };
          });
        return { ...country, marketplaces: countryMarketplaces };
      });
    });
    const seen = new Set();
    return all.filter((c) => { if (seen.has(c.code)) return false; seen.add(c.code); return true; });
  });

  // ── Collection: non-default countries (drives /ca/ /in/ page generation) ──
  eleventyConfig.addCollection('nonDefaultCountryData', async function () {
    const all = await cached('countryData', async () => {
      const [productsResult, countries, marketplaces] = await Promise.all([
        cached('products', require('./_data/products')),
        cached('countries', require('./_data/countries')),
        cached('marketplaces', require('./_data/marketplaces')),
      ]);
      const products = productsResult.products;
      return countries.map((country) => {
        const countryMarketplaces = marketplaces
          .filter((mp) => mp.country?.code === country.code)
          .map((mp) => {
            const mpProducts = products.filter(
              (p) => p.country?.code === country.code && p.marketplace?.slug === mp.slug,
            );
            const categories = {};
            mpProducts.forEach((product) => {
              (product.categories || []).forEach((cat) => {
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(product);
              });
            });
            return { ...mp, categories };
          });
        return { ...country, marketplaces: countryMarketplaces };
      });
    });
    const seen = new Set();
    return all
      .filter((c) => !c.isDefault)
      .filter((c) => { if (seen.has(c.code)) return false; seen.add(c.code); return true; });
  });

  // ── Collection: countryData ───────────────────────────────────────────────
  // Shape: [{ code, name, flag, isDefault, marketplaces: [{ name, slug, domain, categories: { catName: [products] } }] }]
  // Drives: /ca/ and /in/ page generation (Phase 3)
  eleventyConfig.addCollection('countryData', async function () {
    const [productsResult, countries, marketplaces] = await Promise.all([
      cached('products', require('./_data/products')),
      cached('countries', require('./_data/countries')),
      cached('marketplaces', require('./_data/marketplaces')),
    ]);

    const products = productsResult.products;

    return countries.map((country) => {
      const countryMarketplaces = marketplaces
        .filter((mp) => mp.country?.code === country.code)
        .map((mp) => {
          const mpProducts = products.filter(
            (p) => p.country?.code === country.code && p.marketplace?.slug === mp.slug,
          );

          const categories = {};
          mpProducts.forEach((product) => {
            (product.categories || []).forEach((cat) => {
              if (!categories[cat]) categories[cat] = [];
              categories[cat].push(product);
            });
          });

          return { ...mp, categories };
        });

      return { ...country, marketplaces: countryMarketplaces };
    });
  });

  // ── Collection: categoryPages (drives /categories/home/, /ca/categories/home/, etc.) ──
  eleventyConfig.addCollection('categoryPages', async function () {
    const [productsResult, countries, cats] = await Promise.all([
      cached('products', require('./_data/products')),
      cached('countries', require('./_data/countries')),
      cached('categories', require('./_data/categories')),
    ]);
    const products = productsResult.products;
    const pages = [];
    for (const country of countries) {
      const countryProducts = products.filter((p) => p.country?.code === country.code);
      for (const cat of cats) {
        if (!cat.slug) continue;
        const catProducts = countryProducts.filter((p) =>
          (p.categories || []).some((c) => c.toLowerCase() === cat.slug.toLowerCase()),
        );
        if (catProducts.length === 0) continue;
        pages.push({
          catName: cat.slug.toLowerCase(),
          catDisplay: cat.name || cat.slug,
          countryCode: country.code,
          countryName: country.name,
          isDefault: country.isDefault || false,
          pageUrl: country.isDefault
            ? `/categories/${cat.slug.toLowerCase()}/`
            : `/${country.code}/categories/${cat.slug.toLowerCase()}/`,
          products: catProducts,
        });
      }
    }
    // hreflang alternates — only list country variants of this same category that actually exist
    pages.forEach((page) => {
      page.alternates = pages
        .filter((p) => p.catName === page.catName)
        .map((p) => ({code: p.countryCode, url: p.pageUrl, isDefault: p.isDefault}));
    });
    return pages;
  });

  // ── Collection: countryMarketplacePages (drives /ca/marketplaces/*, /in/marketplaces/*) ──
  eleventyConfig.addCollection('countryMarketplacePages', async function () {
    const [productsResult, countries, marketplaces] = await Promise.all([
      cached('products', require('./_data/products')),
      cached('countries', require('./_data/countries')),
      cached('marketplaces', require('./_data/marketplaces')),
    ]);
    const products = productsResult.products;
    const pages = [];
    for (const country of countries.filter((c) => !c.isDefault)) {
      const countryMps = marketplaces.filter((mp) => mp.country?.code === country.code);
      for (const mp of countryMps) {
        const mpProducts = products.filter(
          (p) => p.country?.code === country.code && p.marketplace?.slug === mp.slug,
        );
        const categories = {};
        mpProducts.forEach((product) => {
          (product.categories || []).forEach((cat) => {
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(product);
          });
        });
        pages.push({
          countryCode: country.code,
          countryName: country.name,
          countryFlag: country.flag || '',
          marketplace: { ...mp, categories },
        });
      }
    }
    return pages;
  });

  // ── Collection: marketplaceGroups (US-scoped, drives existing marketplace pages) ──
  eleventyConfig.addCollection('marketplaceGroups', async function () {
    const data = await cached('products', require('./_data/products'));
    const products = data.products.filter((p) => p.country?.code === 'us');
    const groups = {};

    products.forEach((product) => {
      const mkp = product.marketplace?.name || 'Unknown';
      const slug = product.marketplace?.slug || 'unknown';
      if (!groups[mkp]) groups[mkp] = { name: mkp, slug, categories: {} };
      (product.categories || []).forEach((cat) => {
        if (!groups[mkp].categories[cat]) groups[mkp].categories[cat] = [];
        groups[mkp].categories[cat].push(product);
      });
    });

    return Object.values(groups);
  });

  // ── Dev server ────────────────────────────────────────────────────────────
  eleventyConfig.setServerOptions({
    port: 8081,
    middleware: [
      // Mirror the _redirects rules locally
      function (req, res, next) {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(302, { Location: '/us/' });
          res.end();
          return;
        }
        if (req.url === '/new/' || req.url === '/new/index.html') {
          res.writeHead(302, { Location: '/us/new/' });
          res.end();
          return;
        }
        if (req.url.startsWith('/cms')) {
          res.writeHead(302, { Location: 'http://localhost:3333' + req.url });
          res.end();
          return;
        }
        next();
      },
    ],
  });

  return {
    dir: { input: '.', output: '_site', data: '_data' },
    templateFormats: ['html', 'njk', 'md'],
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
  };
};
