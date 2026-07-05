// Bookmarklet source for capturing a product from Amazon/Flipkart while browsing.
// Run `node scripts/build-bookmarklet.js` after editing this file to regenerate
// the javascript: URI to paste into a browser bookmark.
//
// Output is one CSV row matching the BulkImport tool's expected columns
// (studio/plugins/BulkImport.tsx): name, description, affiliate_link,
// categories, marketplace_slug, country_code, image_url, featured, status.
// description and categories are left blank — those need human judgment.
// FindsRadar doesn't display price anywhere, so it's not captured here.
//
// Selectors are best-effort against known Amazon/Flipkart markup. Flipkart's
// class names are hashed and change periodically — if capture comes back
// empty on a real page, inspect the page and update the selectors below.
(function () {
  var MARKETPLACES = [
    { domain: 'amazon.ca', slug: 'amazon-ca', country: 'ca' },
    { domain: 'amazon.in', slug: 'amazon-in', country: 'in' },
    { domain: 'amazon.com', slug: 'amazon-us', country: 'us' },
    { domain: 'flipkart.com', slug: 'flipkart-in', country: 'in' },
    { domain: 'temu.com', slug: 'temu-us', country: 'us' },
  ];

  function text(sel) {
    var el = document.querySelector(sel);
    return el && el.textContent ? el.textContent.trim() : '';
  }

  function attr(sel, name) {
    var el = document.querySelector(sel);
    return el ? (el.getAttribute(name) || '') : '';
  }

  function firstNonEmpty() {
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i]) return arguments[i];
    }
    return '';
  }

  var host = location.hostname;
  var mp = null;
  for (var i = 0; i < MARKETPLACES.length; i++) {
    if (host.indexOf(MARKETPLACES[i].domain) !== -1) { mp = MARKETPLACES[i]; break; }
  }

  var name = firstNonEmpty(
    text('#productTitle'),
    text('.B_NuCI'),
    text('.VU-ZEz'),
    attr('meta[property="og:title"]', 'content'),
    document.title
  );

  // Amazon thumbnail URLs carry a size modifier like "._AC_UL320_SR320,320_.jpg" —
  // stripping it yields the unscaled full-size image.
  function amazonFullSize(src) {
    return src ? src.replace(/\._[A-Za-z0-9,_]+_(?=\.)/, '') : src;
  }

  function allAttrs(sel, name) {
    var els = document.querySelectorAll(sel);
    var out = [];
    for (var i = 0; i < els.length; i++) {
      var v = els[i].getAttribute(name);
      if (v) out.push(v);
    }
    return out;
  }

  var MAX_IMAGES = 6;
  var images = [];
  function addImage(src) {
    var full = amazonFullSize(src);
    if (full && images.indexOf(full) === -1 && images.length < MAX_IMAGES) images.push(full);
  }

  // Prefer the full-size hero image, then thumbnail-strip images (converted to
  // full-size), then any og:image tags as a last resort.
  addImage(firstNonEmpty(attr('#landingImage', 'data-old-hires'), attr('#landingImage', 'src')));
  allAttrs('#altImages img', 'src').forEach(addImage);
  allAttrs('img._396cs4', 'src').forEach(addImage);
  allAttrs('img._2r_T1I', 'src').forEach(addImage);
  allAttrs('meta[property="og:image"]', 'content').forEach(addImage);

  var image = images.join('|');
  var url = location.href;

  function csvField(v) {
    return '"' + String(v || '').replace(/"/g, '""') + '"';
  }

  var row = [
    csvField(name),
    csvField(''),
    csvField(url),
    csvField(''),
    csvField(mp ? mp.slug : ''),
    csvField(mp ? mp.country : ''),
    csvField(image),
    csvField('false'),
    csvField('draft'),
  ].join(',');

  var summary = name +
    '\n' + images.length + ' image(s) captured' +
    '\nImported as Draft — review and publish in Studio.' +
    (mp ? '' : '\n\n(marketplace not recognized — fill marketplace_slug/country_code manually)') +
    (images.length ? '' : '\n(no image found — add one manually)');

  function fallbackPrompt() {
    window.prompt('Copy this row (already selected — Ctrl/Cmd+C, then Enter):', row);
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(row).then(function () {
      alert('Copied to clipboard:\n\n' + summary + '\n\nPaste as a new line into your running product list, then into Bulk Import.');
    }).catch(fallbackPrompt);
  } else {
    fallbackPrompt();
  }
})();
