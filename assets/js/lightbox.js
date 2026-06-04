// assets/js/lightbox.js
(() => {
  const allProducts = window.__FINDSRADAR_PRODUCTS || [];

  function openModal(index) {
    const product = allProducts[index];
    if (!product) return;
    const title = document.getElementById('modal-title');
    const desc = document.getElementById('modal-desc');
    const link = document.getElementById('modal-link');
    const container = document.getElementById('modal-media');

    title.innerText = product.name || "Product";
    desc.innerText = product.description || product.usp || "No description provided.";
    link.href = product.affiliate_link || "#";
    link.innerText = product.affiliate_link ? `Buy on marketplace` : `No link`;
    link.setAttribute('rel', 'noopener noreferrer');

    container.innerHTML = "";
    const media = (product.media && product.media[0]) ? product.media[0] : null;
    if (media) {
      if (media.type === 'video') {
        container.innerHTML = `<video src="${media.url}" controls class="w-full h-full object-cover"></video>`;
      } else {
        container.innerHTML = `<img src="${media.url}" class="w-full h-full object-cover" alt="${product.name || 'Product image'}">`;
      }
    } else {
      container.innerHTML = `<div class="w-full h-full flex items-center justify-center text-slate-400">No media</div>`;
    }

    document.getElementById('lightbox').classList.remove('hidden');
    // focus management
    const closeBtn = document.querySelector('#lightbox button[aria-label=\"Close modal\"]') || document.querySelector('#lightbox button');
        if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    document.getElementById('lightbox').classList.add('hidden');
    const container = document.getElementById('modal-media');
    container.innerHTML = "";
  }

  // keyboard: Esc to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const lb = document.getElementById('lightbox');
      if (lb && !lb.classList.contains('hidden')) closeModal();
    }
  });

  // expose minimal API for templates to call
  window.FindsRadarLightbox = {
    openModal,
    closeModal,
    setProducts: (products) => { window.__FINDSRADAR_PRODUCTS = products; }
  };

  // attach global handlers for any existing inline onclicks that call openModal/closeModal
  window.openModal = (i) => window.FindsRadarLightbox.openModal(i);
  window.closeModal = () => window.FindsRadarLightbox.closeModal();
})();
