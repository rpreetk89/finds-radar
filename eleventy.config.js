module.exports = function(eleventyConfig) {
  
  // Force Eleventy to copy your CMS admin dashboard into the deployment folder
  eleventyConfig.addPassthroughCopy("admin");

  // Custom collection to gather unique categories from products.json safely
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
          product.categories.forEach(cat => categorySet.add(cat.toLowerCase().trim()));
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