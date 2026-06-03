module.exports = function(eleventyConfig) {
  
  // Force Eleventy to copy your CMS admin dashboard into the deployment folder
  eleventyConfig.addPassthroughCopy("admin");

  // Custom collection to gather unique categories safely splitting comma strings
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
        if (product.categories) {
          // If the CMS saves it as a single string like "home, travel", split it!
          const rawCategories = Array.isArray(product.categories) 
            ? product.categories 
            : String(product.categories).split(",");

          rawCategories.forEach(cat => {
            if (cat) categorySet.add(cat.toLowerCase().trim());
          });
        }
      });
    }
    return Array.from(categorySet);
  });

  return {
    dir: {
      input: ".",
      output: "_site",
      data: "_data"
    },
    templateFormats: ["html", "njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};