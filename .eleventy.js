module.exports = function(eleventyConfig) {
  eleventyConfig.addFilter("jsonify", (value) => JSON.stringify(value));
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("assets");

  eleventyConfig.addCollection("customCategories", function(collectionApi) {
    let productsData = [];
    try {
      // Direct path to your data file
      const data = require("./_data/products.json");
      productsData = data.products || [];
      console.log(`[DEBUG] Found ${productsData.length} products for categories.`);
    } catch(e) {
      console.error("[DEBUG] Error loading products.json:", e);
    }
    
    const categorySet = new Set();
    productsData.forEach(product => {
      // Check singular 'category'
      if (product.category) categorySet.add(product.category.toLowerCase().trim());
      
      // Check plural 'categories' (if it exists)
      if (Array.isArray(product.categories)) {
        product.categories.forEach(item => {
          const cat = (typeof item === 'object' && item.category) ? item.category : item;
          if (cat) categorySet.add(cat.toLowerCase().trim());
        });
      }
    });
    
    const uniqueCats = Array.from(categorySet);
    console.log("[DEBUG] Found categories:", uniqueCats);
    return uniqueCats;
  });

  return {
    dir: { input: ".", output: "_site", data: "_data" },
    templateFormats: ["html", "njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};