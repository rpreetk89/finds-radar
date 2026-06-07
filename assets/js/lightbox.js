// assets/js/lightbox.js
(() => {
  let currentProduct = null;
  let currentMediaIndex = 0;

  function renderMedia() {
    const container = document.getElementById('modal-media');
    const prevBtn = document.getElementById('prev-media');
    const nextBtn = document.getElementById('next-media');
    
    // Safety check
    if (!currentProduct || !currentProduct.media || currentProduct.media.length === 0) return;

    const media = currentProduct.media[currentMediaIndex];
    
    // Clear and render media (Images Only)
    container.innerHTML = `<img src="${media.url}" class="w-full h-full object-contain" alt="${currentProduct.name}">`;

    // Handle button visibility logic
    if (prevBtn) prevBtn.style.display = currentMediaIndex > 0 ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = currentMediaIndex < currentProduct.media.length - 1 ? 'flex' : 'none';
  }

  function openModal(item) {
    currentProduct = item; 
    currentMediaIndex = 0;

    document.getElementById('modal-title').innerText = currentProduct.name;
    document.getElementById('modal-desc').innerText = currentProduct.description || "";
    
    const link = document.getElementById('modal-link');
    link.href = currentProduct.affiliate_link || "#";

    document.getElementById('lightbox').classList.remove('hidden');
    
    if (currentProduct.media && currentProduct.media.length > 0) {
      renderMedia();
    }
  }

  function closeModal() {
    document.getElementById('lightbox').classList.add('hidden');
    document.getElementById('modal-media').innerHTML = ""; 
    currentProduct = null;
  }

  // Navigation Logic
  window.changeMedia = (direction) => {
    if (!currentProduct) return;
    currentMediaIndex += direction;
    // Boundary checks
    if (currentMediaIndex < 0) currentMediaIndex = 0;
    if (currentMediaIndex >= currentProduct.media.length) currentMediaIndex = currentProduct.media.length - 1;
    renderMedia();
  };

  // Keyboard: Esc to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const lb = document.getElementById('lightbox');
      if (lb && !lb.classList.contains('hidden')) closeModal();
    }
  });

  // Expose API
  window.openModal = openModal;
  window.closeModal = closeModal;
})();