module.exports = function(eleventyConfig) {
  // Force Eleventy to process .html and .njk files as dynamic templates
  return {
    dir: {
      input: ".",
      output: "_site",
      data: "_data"
    },
    templateFormats: ["html", "njk", "md"],
    htmlTemplateEngine: "njk", // 👈 This forces EVERY .html file to read Nunjucks code loops automatically!
    markdownTemplateEngine: "njk"
  };
};