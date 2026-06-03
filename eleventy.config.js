module.exports = function(eleventyConfig) {
  // Create a smart collection that extracts all unique categories from products.json
  eleventyConfig.addCollection("dynamicCategories", function(collectionApi) {
    // Look inside your _data/products.json file
    const products = collectionApi.getAll()[0].data.products || [];
    const categorySet = new Set();

    // Loop through each product and grab its categories array
    products.forEach(product => {
      if (Array.isArray(product.categories)) {
        product.categories.forEach(cat => categorySet.add(cat.trim().toLowerCase()));
      }
    });

    // Return a clean array of unique tag strings like ['gadgets', 'travel', 'home']
    return Array.from(categorySet);
  });
};