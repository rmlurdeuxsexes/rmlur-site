/* Photo grid → full-bleed lightbox, same visual pattern as the shop's PDP overlay. */
document.addEventListener('DOMContentLoaded', () => {
  const photos = window.JASON_PHOTOS || [];
  const grid = document.getElementById('portfolio-grid');
  const empty = document.getElementById('portfolio-empty');
  const overlay = document.getElementById('lightbox-overlay');
  const img = document.getElementById('lightbox-img');
  const back = document.getElementById('lightbox-back');

  empty.hidden = photos.length > 0;

  photos.forEach(p => {
    const cell = document.createElement('div');
    cell.className = 'design-item';
    cell.innerHTML = `<img src="${p.src}" alt="${p.alt || ''}" loading="lazy">`;
    cell.addEventListener('click', () => openLightbox(p));
    grid.appendChild(cell);
  });

  function openLightbox(p) {
    img.src = p.src;
    img.alt = p.alt || '';
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    overlay.hidden = true;
    document.body.style.overflow = '';
  }
  back.addEventListener('click', closeLightbox);
});
