const fs = require("fs");
const path = require("path");

module.exports = function(eleventyConfig) {
  // 1. REGISTER FILTERS FIRST (Prevents "filter not found" errors)
  eleventyConfig.addFilter("jsonify", (value) => JSON.stringify(value));
  
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

  return {
    dir: { input: ".", output: "_site", data: "_data" },
    templateFormats: ["html", "njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};