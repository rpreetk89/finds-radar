const fs = require("fs");
const path = require("path");

module.exports = function(eleventyConfig) {
  // 1. REGISTER FILTERS FIRST (Prevents "filter not found" errors)
  eleventyConfig.addFilter("jsonify", (value) => JSON.stringify(value));
  
  eleventyConfig.addFilter("limit", (array, limit) => {
  return array.slice(0, limit);
});

  eleventyConfig.addFilter("split", function(value, delimiter) {
    return value.split(delimiter);
  });

  // Static assets
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("assets");

  // HELPER: Get official category names from your /categories folder files
  const getOfficialCategories = () => {
    const dir = "categories";
    if (!fs.existsSync(dir)) return [];
    
    return fs.readdirSync(dir)
      .filter(file => file.endsWith(".json"))
      .map(file => {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
          // Return the category name in lowercase for matching
          return content.name ? content.name.toLowerCase().trim() : null;
        } catch (e) {
          return null;
        }
      })
      .filter(name => name !== null);
  };

  // 2. Custom Categories Collection (STRICT FILTERING)
// Replace this block in your .eleventy.js
eleventyConfig.addCollection("customCategories", function(collectionApi) {
  const dir = "categories";
  if (!fs.existsSync(dir)) return [];
  
  // Return the list of file names directly
  return fs.readdirSync(dir)
    .filter(file => file.endsWith(".json"))
    .map(file => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        // Return the name so your templates can use it
        return content.name.toLowerCase().trim();
      } catch (e) {
        console.error(`Error reading ${file}:`, e);
        return null;
      }
    })
    .filter(name => name !== null);
});

  // 3. Marketplaces Collection
  eleventyConfig.addCollection("marketplaces", function() {
    const dir = "marketplaces";
    if (!fs.existsSync(dir)) return [];
    
    return fs.readdirSync(dir)
      .filter(file => file.endsWith(".json"))
      .map(file => {
        const content = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        return { data: content };
      });
  });

  // 4. NEW: Marketplace-Category Grouping Collection
  // This groups products into a structured object so we don't have to filter in HTML
// Replace the old marketplaceCategories collection with this:
// Add this new collection to .eleventy.js
eleventyConfig.addCollection("marketplaceGroups", function() {
  const products = JSON.parse(fs.readFileSync(path.join(__dirname, "_data/products.json"), "utf8")).products;
  const groups = {};

  products.forEach(product => {
    const mkp = product.marketplace || "Unknown";
    if (!groups[mkp]) groups[mkp] = { name: mkp, categories: {} };
    
    product.usage_category.forEach(cat => {
      if (!groups[mkp].categories[cat]) groups[mkp].categories[cat] = [];
      groups[mkp].categories[cat].push(product);
    });
  });
  return Object.values(groups);
});

  return {
    dir: { input: ".", output: "_site", data: "_data" },
    templateFormats: ["html", "njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};