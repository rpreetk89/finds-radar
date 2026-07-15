// assets/js/search-filter.js
// Handles: wishlist cookie, real-time grid filtering (text + category + marketplace), search dropdown
(function () {
  'use strict';

  var COOKIE_KEY = 'findsradar_wishlist';
  var COOKIE_DAYS = 30;

  // ── Cookie helpers ──────────────────────────────────────────────────────────

  function getCookie(name) {
    var m = document.cookie.match('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
    return m ? m[1] : null;
  }

  function setCookie(name, value, days) {
    var exp = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = name + '=' + value + '; expires=' + exp + '; path=/; SameSite=Lax';
  }

  // ── Wishlist ────────────────────────────────────────────────────────────────

  function getWishlist() {
    try { return JSON.parse(decodeURIComponent(getCookie(COOKIE_KEY) || '[]')); }
    catch (e) { return []; }
  }

  function saveWishlist(ids) {
    setCookie(COOKIE_KEY, encodeURIComponent(JSON.stringify(ids)), COOKIE_DAYS);
  }

  function setHeartState(btn, wishlisted) {
    var icon = btn.querySelector('.heart-icon');
    if (!icon) return;
    icon.classList.toggle('is-active', wishlisted);
    btn.setAttribute('aria-label', wishlisted ? 'Remove from wishlist' : 'Save to wishlist');
  }

  window.toggleWishlist = function (e, id) {
    e.stopPropagation();
    var list = getWishlist();
    var idx = list.indexOf(id);
    var adding = idx === -1;
    if (adding) { list.push(id); } else { list.splice(idx, 1); }
    saveWishlist(list);
    document.querySelectorAll('.wishlist-btn[data-id="' + id + '"]').forEach(function (btn) {
      setHeartState(btn, adding);
    });
  };

  function initWishlist() {
    var list = getWishlist();
    document.querySelectorAll('.wishlist-btn[data-id]').forEach(function (btn) {
      setHeartState(btn, list.indexOf(btn.dataset.id) !== -1);
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Category navigation ─────────────────────────────────────────────────────
  // Mirrors the URL contract from .eleventy.js categoryPages: default country
  // has no code prefix, non-default countries are prefixed with /{code}/.

  function getCurrentCountryCode() {
    var seg = window.location.pathname.split('/').filter(Boolean)[0] || '';
    return /^[a-z]{2}$/.test(seg) ? seg : null;
  }

  function isDefaultCountry(code) {
    if (!code) return true;
    var opt = document.querySelector('.country-option[data-country-code="' + code + '"]');
    return opt ? opt.dataset.countryDefault === 'true' : true;
  }

  function categoryUrl(catName) {
    var code = getCurrentCountryCode();
    var slug = catName.toLowerCase();
    return isDefaultCountry(code) ? '/categories/' + slug + '/' : '/' + code + '/categories/' + slug + '/';
  }

  function clearSearch() {
    var input = document.getElementById('grid-search');
    if (input) {
      input.value = '';
      input.dispatchEvent(new Event('input'));
    }
  }
  window._frClearSearch = clearSearch;

  // ── Search dropdown ─────────────────────────────────────────────────────────

  var dropdown = null;

  // Build lookup: lowercase → display name for all categories in __FINDSRADAR_PRODUCTS
  function getCategoryMap() {
    var map = {};
    (window.__FINDSRADAR_PRODUCTS || []).forEach(function (p) {
      (p.categories || []).forEach(function (cat) {
        map[cat.toLowerCase()] = cat;
      });
    });
    return map;
  }

  function getSuggestions(q) {
    var catMap = getCategoryMap();

    // Category suggestions: substring match on display names
    var cats = Object.keys(catMap)
      .filter(function (k) { return k.indexOf(q) !== -1; })
      .map(function (k) { return catMap[k]; })
      .slice(0, 4);

    // Product name suggestions: from cards currently visible on the page
    var seen = {};
    var products = [];
    document.querySelectorAll('.product-card[data-name]:not([data-carousel-clone])').forEach(function (card) {
      var key = card.dataset.name || '';
      if (!seen[key] && key.indexOf(q) !== -1) {
        seen[key] = true;
        var btn = card.querySelector('button:not(.wishlist-btn)');
        products.push(btn ? btn.textContent.trim() : key);
      }
    });
    products = products.slice(0, 5);

    return { cats: cats, products: products };
  }

  function renderDropdown(q) {
    if (!dropdown || !q) { hideDropdown(); return; }
    var s = getSuggestions(q);
    if (!s.cats.length && !s.products.length) { hideDropdown(); return; }

    var html = '';

    if (s.cats.length) {
      html += '<div class="px-4 pt-3 pb-1 text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">Categories</div>';
      s.cats.forEach(function (cat) {
        html += '<button type="button" class="search-suggestion w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors" data-type="category" data-val="' + escHtml(cat) + '">'
          + '<svg class="w-3.5 h-3.5 shrink-0 text-orange-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>'
          + escHtml(cat)
          + '</button>';
      });
    }

    if (s.cats.length && s.products.length) {
      html += '<div class="mx-4 my-1 border-t border-slate-100 dark:border-slate-700"></div>';
    }

    if (s.products.length) {
      html += '<div class="px-4 pt-2 pb-1 text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">Products</div>';
      s.products.forEach(function (name) {
        html += '<button type="button" class="search-suggestion w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors" data-val="' + escHtml(name) + '">'
          + '<svg class="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35"/></svg>'
          + escHtml(name)
          + '</button>';
      });
    }

    html += '<div class="h-1"></div>';
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.search-suggestion').forEach(function (btn) {
      btn.addEventListener('mousedown', function (e) {
        e.preventDefault(); // keep input focused; blur fires after mousedown otherwise
        if (btn.dataset.type === 'category') {
          window.location.href = categoryUrl(btn.dataset.val);
          return;
        }
        var input = document.getElementById('grid-search');
        if (input) {
          input.value = btn.dataset.val;
          input.dispatchEvent(new Event('input'));
          input.focus();
        }
        hideDropdown();
      });
    });
  }

  function hideDropdown() {
    if (dropdown) dropdown.style.display = 'none';
  }

  function initDropdown() {
    var input = document.getElementById('grid-search');
    if (!input) return;

    // Make parent relative so dropdown can anchor to it
    var wrapper = input.parentElement;
    if (wrapper) wrapper.style.position = 'relative';

    dropdown = document.createElement('div');
    dropdown.setAttribute('role', 'listbox');
    dropdown.style.cssText = 'display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:50;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.14)';
    dropdown.className = 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700';
    if (wrapper) wrapper.appendChild(dropdown);

    input.addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      if (q.length >= 1) { renderDropdown(q); } else { hideDropdown(); }
    });

    input.addEventListener('focus', function () {
      var q = this.value.trim().toLowerCase();
      if (q.length >= 1) renderDropdown(q);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { hideDropdown(); clearSearch(); }
    });

    // Blur fires before mousedown on suggestion buttons, so use a small delay
    input.addEventListener('blur', function () {
      setTimeout(hideDropdown, 160);
    });
  }

  // ── Filters ─────────────────────────────────────────────────────────────────

  var activeCategory = '';
  var activeMarketplace = '';

  var searchResultsSection = null;
  var searchResultsRow = null;

  function applyFilters() {
    if (!searchResultsSection) searchResultsSection = document.getElementById('search-results-section');
    if (!searchResultsRow) searchResultsRow = document.getElementById('search-results-row');

    var input = document.getElementById('grid-search');
    var q = input ? input.value.trim().toLowerCase() : '';
    var cards = document.querySelectorAll('.product-card[data-name]:not([data-carousel-clone])');
    var visible = 0;

    // Always reset cards to visible first (needed when clearing search)
    cards.forEach(function (card) { card.style.display = ''; });

    if (q) {
      // ── Search mode: flat results, no category grouping ───────────────────
      // Hide Top 10, New this week, and all category sections
      document.querySelectorAll('section[data-section="top10"], section[data-section="newthisweek"]').forEach(function (s) {
        s.style.display = 'none';
      });
      document.querySelectorAll('section[id^="cat-"]').forEach(function (s) {
        s.style.display = 'none';
      });

      // Collect matching cards into the flat results row
      // Search all real cards (no clones), deduplicate by name so each product appears once
      if (searchResultsRow) searchResultsRow.innerHTML = '';
      var seen = {};

      document.querySelectorAll('.product-card[data-name]:not([data-carousel-clone])').forEach(function (card) {
        var key = card.dataset.name || '';
        if (!key || seen[key]) return;

        var matchText = key.indexOf(q) !== -1
          || (card.dataset.description || '').indexOf(q) !== -1
          || (card.dataset.categories || '').indexOf(q) !== -1;

        var cardCats = (card.dataset.categories || '').split(',').map(function (c) { return c.trim(); });
        var matchCat = !activeCategory || cardCats.indexOf(activeCategory) !== -1;
        var matchMp = !activeMarketplace || (card.dataset.marketplace || '') === activeMarketplace;

        if (matchText && matchCat && matchMp) {
          seen[key] = true;
          if (searchResultsRow) searchResultsRow.appendChild(card.cloneNode(true));
          visible++;
        }
      });

      if (searchResultsSection) searchResultsSection.classList.toggle('hidden', visible === 0);

    } else {
      // ── Browse mode: restore all sections ────────────────────────────────
      if (searchResultsSection) searchResultsSection.classList.add('hidden');
      if (searchResultsRow) searchResultsRow.innerHTML = '';

      document.querySelectorAll('section[data-section="top10"], section[data-section="newthisweek"]').forEach(function (s) {
        s.style.display = '';
      });

      cards.forEach(function (card) {
        var cardCats = (card.dataset.categories || '').split(',').map(function (c) { return c.trim(); });
        var matchCat = !activeCategory || cardCats.indexOf(activeCategory) !== -1;
        var matchMp = !activeMarketplace || (card.dataset.marketplace || '') === activeMarketplace;
        var show = matchCat && matchMp;
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });

      // Category section visibility
      document.querySelectorAll('section[id^="cat-"]').forEach(function (section) {
        var sectionCards = section.querySelectorAll('.product-card:not([data-carousel-clone])');
        if (!sectionCards.length) return;
        var anyVisible = false;
        sectionCards.forEach(function (c) { if (c.style.display !== 'none') anyVisible = true; });
        section.style.display = anyVisible ? '' : 'none';
      });
    }

    // Empty state
    var emptyEl = document.getElementById('filter-empty');
    if (!emptyEl) return;
    if (visible > 0 || (!q && !activeCategory && !activeMarketplace)) {
      emptyEl.classList.add('hidden');
      emptyEl.innerHTML = '';
      return;
    }
    emptyEl.classList.remove('hidden');
    var label = q
      ? 'No finds for <strong class="text-slate-700 dark:text-slate-200">“' + escHtml(q) + '”</strong>'
      : 'No products in this filter.';
    emptyEl.innerHTML = ''
      + '<div class="flex flex-col items-center gap-4">'
      + '<svg class="w-12 h-12 text-slate-200 dark:text-slate-700" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35"/></svg>'
      + '<p class="text-sm text-slate-500 dark:text-slate-400">' + label + '</p>'
      + (q ? '<button onclick="window._frClearSearch()" class="px-5 py-1.5 rounded-full text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors">Clear search</button>' : '')
      + '</div>';
  }

  function deactivateChips(selector) {
    document.querySelectorAll(selector).forEach(function (c) { c.classList.remove('chip-active'); });
  }

  function attachCatChip(chip) {
    chip.addEventListener('click', function () {
      var val = this.dataset.filterCat;
      if (activeCategory === val) { activeCategory = ''; this.classList.remove('chip-active'); }
      else { activeCategory = val; deactivateChips('.filter-chip[data-filter-cat]'); this.classList.add('chip-active'); }
      applyFilters();
    });
  }

  function attachMpChip(chip) {
    chip.addEventListener('click', function () {
      var val = this.dataset.filterMp;
      if (activeMarketplace === val) { activeMarketplace = ''; this.classList.remove('chip-active'); }
      else { activeMarketplace = val; deactivateChips('.filter-chip[data-filter-mp]'); this.classList.add('chip-active'); }
      applyFilters();
    });
  }

  function buildDynamicMpChips() {
    var container = document.getElementById('mp-chip-container');
    if (!container) return;
    var seen = {};
    var chips = [];
    document.querySelectorAll('.product-card[data-marketplace]:not([data-carousel-clone])').forEach(function (card) {
      var slug = card.dataset.marketplace;
      var name = card.dataset.marketplaceName;
      if (slug && !seen[slug]) { seen[slug] = true; chips.push({slug: slug, name: name || slug}); }
    });
    if (chips.length < 2) return;
    container.innerHTML = chips.map(function (mp) {
      return '<button class="filter-chip px-4 py-1.5 rounded-full text-sm font-medium" data-filter-mp="'
        + escHtml(mp.slug) + '">' + escHtml(mp.name) + '</button>';
    }).join('');
    container.querySelectorAll('.filter-chip[data-filter-mp]').forEach(attachMpChip);
  }

  // Triggered from a marketplace badge on a product card — reuses whichever
  // marketplace chip already exists on the current page (static or dynamic).
  // No-op if no matching chip is present (e.g. only one marketplace on this page).
  window.selectMarketplaceFilter = function (slug) {
    var chip = document.querySelector('.filter-chip[data-filter-mp="' + slug + '"]');
    if (!chip) return;
    chip.scrollIntoView({behavior: 'smooth', block: 'center'});
    chip.click();
  };

  function initFilters() {
    var input = document.getElementById('grid-search');
    if (input) input.addEventListener('input', applyFilters);
    document.querySelectorAll('.filter-chip[data-filter-cat]').forEach(attachCatChip);
    document.querySelectorAll('.filter-chip[data-filter-mp]').forEach(attachMpChip);
    buildDynamicMpChips();
    applyFilters();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initWishlist();
    initDropdown();
    initFilters();
  });
})();
