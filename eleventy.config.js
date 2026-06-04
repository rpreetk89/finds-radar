module.exports = function(eleventyConfig) {
  // Add a jsonify filter for Nunjucks templates
  eleventyConfig.addFilter("jsonify", function(value) {
    return JSON.stringify(value);
  });
  
   // Ensure the admin dashboard copies over
  eleventyConfig.addPassthroughCopy("admin");

  // Build unique categories cleanly from your array data
  eleventyConfig.addCollection("customCategories", function(collectionApi) {
    let productsData;
    try {
      productsData = require("./_data/products.json").products;
    } catch(e) {
      productsData = [];
    }
    
    const categorySet = new Set();
    if (Array.isArray(productsData)) {
      productsData.forEach(product => {
        if (Array.isArray(product.categories)) {
          product.categories.forEach(cat => {
            if (cat) categorySet.add(cat.toLowerCase().trim());
          });
        }
      });
    }
    return Array.from(categorySet);
  });

  return {
    dir: { input: ".", output: "_site", data: "_data" },
    templateFormats: ["html", "njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};