// Regenerates the bookmarklet URI from scripts/add-product-bookmarklet.js.
// Run: node scripts/build-bookmarklet.js
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'add-product-bookmarklet.js');
const outPath = path.join(__dirname, 'add-product-bookmarklet.bookmarklet.txt');

const src = fs.readFileSync(srcPath, 'utf8');
const minified = src
  .replace(/\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .trim();

const bookmarklet = 'javascript:' + encodeURIComponent(minified);
fs.writeFileSync(outPath, bookmarklet);

console.log(`Wrote ${bookmarklet.length} chars to ${path.relative(process.cwd(), outPath)}`);
console.log('Open that file, copy its contents, and paste as the URL of a new browser bookmark.');
