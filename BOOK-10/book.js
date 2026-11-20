/* BOOK-10 interactions use the shared BOOKIVO API, cart and checkout. */
(function () {
'use strict';

const pageEl = document.querySelector('.book-page');
const BOOK_ID = (pageEl && pageEl.dataset.bookId) || 'book-1';

/* ---------- Adapter to the shared BOOKIVO cart and checkout ---------- */
const Bookivo = {
  async addToCart() {
    const app = window.Bookivo;
    if (!app || !app.Api || !app.Api.cart) return false;
    await app.Api.cart.add(BOOK_ID);
    app.Track.event('AddToCart', { content_ids: [BOOK_ID] });
    return true;
  },
  buyNow() {
    const app = window.Bookivo;
    if (!app || !app.Checkout) return false;
    app.Checkout.open([BOOK_ID]);
    return true;
  },
  track(eventName) {
    const app = window.Bookivo;
    if (app && eventName === 'product_view') app.Track.event('ViewContent', { content_ids: [BOOK_ID] });
  },
  addReview(review) {
    const app = window.Bookivo;
    if (!app || !app.Api || !app.Api.reviews) return Promise.reject(new Error('Reviews are unavailable right now.'));
    return app.Api.reviews.add(Object.assign({ bookId: BOOK_ID }, review));
  },
  toast(message, type) {
    const app = window.Bookivo;
    if (app && app.Toast) return app.Toast.show(message, type || 'info');
    localToast(message, type);
  }
};

/* Local fallback toast, used only when BOOKIVO.toast isn't provided. */
let toastTimer = null;
function localToast(message, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('toast--success', 'toast--error', 'toast--info');
  toast.classList.add('toast--' + (type || 'success'), 'show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
function showToast(message, type) { Bookivo.toast(message, type); }

/* ============================================
   Data
   ============================================ */
const reviewsData = (window.BookivoBookReviews || []).map(review => Object.assign({}, review));
const testimonialData = reviewsData.slice(0, 6).map(review => ({
  name: review.name,
  rating: Math.max(1,Math.min(5,Number(review.rating)||1)),
  text: review.body
}));

const faqData = [
  { q: 'Are all the recipes really under ₹99?', a: 'The recipes focus on affordable everyday ingredients and practical portions. Ingredient prices vary by location and season, so use the listed costs as a guide and check current local prices.' },
  { q: 'Is this cookbook suitable for complete beginners?', a: 'Yes. The recipes are written with beginner cooks in mind and use clear, step-by-step instructions. Each recipe aims to make preparation easier to follow without requiring advanced equipment.' },
  { q: "What's included in the Bachelor 99 Survival Cookbook?", a: 'The ebook includes 99 Indian recipe ideas with practical ingredient guidance and straightforward cooking steps. It is delivered as a digital PDF for reading on a compatible device.' },
  { q: 'How will I receive my eBook after purchase?', a: 'After successful payment, digital delivery is sent to the email address used at checkout. If you cannot find the message or have trouble opening the file, contact support with your order ID.' }
];

/* Gallery images shared between homepage gallery and fullscreen viewer */
const galleryImages = [
  { src: 'images/Ebook1.png', alt: 'Bachelor 99 Survival Cookbook cover', duration: 3000 },
  { src: 'images/book1.png', alt: 'Recipe preview 1', duration: 5000 },
  { src: 'images/book2.png', alt: 'Recipe preview 2', duration: 5000 },
  { src: 'images/book3.png', alt: 'Recipe preview 3', duration: 5000 },
  { src: 'images/book4.png', alt: 'Recipe preview 4', duration: 5000 },
  { src: 'images/book5.png', alt: 'Recipe preview 5', duration: 5000 },
  { src: 'images/book6.png', alt: 'Recipe preview 6', duration: 5000 },
  { src: 'images/book7.png', alt: 'Recipe preview 7', duration: 5000 }
];

/* ============================================
   Scroll-triggered reveal animations
   ============================================ */
function initializeScrollAnimations(){
  const targets = document.querySelectorAll('[data-reveal]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
  targets.forEach(t => observer.observe(t));
}

/* ============================================
   Fullscreen viewer (used by both the main gallery
   and the "Straight From the Book" showcase grid)
   ============================================ */
const FullscreenViewer = (() => {
  const lightbox = document.getElementById('lightbox');
  const viewport = document.getElementById('lightboxViewport');
  const lightboxImg = document.getElementById('lightboxImg');
  const closeBtn = document.getElementById('lightboxClose');
  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');

  let images = [];
  let currentIndex = 0;
  let scale = 1, panX = 0, panY = 0;
  let isDragging = false, dragStartX = 0, dragStartY = 0;
  let onCloseCallback = null;

  function applyTransform(){
    lightboxImg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }
  function resetTransform(){
    scale = 1; panX = 0; panY = 0;
    applyTransform();
  }

  function render(){
    const img = images[currentIndex];
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || '';
    resetTransform();
  }

  function open(imgList, index, onClose){
    images = imgList;
    currentIndex = index;
    onCloseCallback = onClose || null;
    render();
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function close(){
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if(typeof onCloseCallback === 'function') onCloseCallback();
  }
  function nav(delta){
    currentIndex = (currentIndex + delta + images.length) % images.length;
    render();
  }

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => nav(-1));
  nextBtn.addEventListener('click', () => nav(1));
  lightbox.addEventListener('click', (e) => { if(e.target === lightbox) close(); });

  document.addEventListener('keydown', (e) => {
    if(!lightbox.classList.contains('open')) return;
    if(e.key === 'Escape') close();
    if(e.key === 'ArrowLeft') nav(-1);
    if(e.key === 'ArrowRight') nav(1);
  });

  // Desktop: wheel zoom
  viewport.addEventListener('wheel', (e) => {
    if(!lightbox.classList.contains('open')) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    scale = Math.min(4, Math.max(1, scale + delta));
    if(scale === 1){ panX = 0; panY = 0; }
    applyTransform();
  }, { passive: false });

  // Desktop: click-drag pan when zoomed
  lightboxImg.addEventListener('mousedown', (e) => {
    if(scale <= 1) return;
    isDragging = true;
    dragStartX = e.clientX - panX;
    dragStartY = e.clientY - panY;
  });
  window.addEventListener('mousemove', (e) => {
    if(!isDragging) return;
    panX = e.clientX - dragStartX;
    panY = e.clientY - dragStartY;
    applyTransform();
  });
  window.addEventListener('mouseup', () => { isDragging = false; });

  // Mobile: pinch-to-zoom + double-tap
  let pinchStartDist = 0, pinchStartScale = 1;
  let lastTapTime = 0;

  function getDist(touches){
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  viewport.addEventListener('touchstart', (e) => {
    if(e.touches.length === 2){
      pinchStartDist = getDist(e.touches);
      pinchStartScale = scale;
    } else if(e.touches.length === 1){
      const now = Date.now();
      if(now - lastTapTime < 300){
        scale = scale > 1 ? 1 : 2;
        panX = 0; panY = 0;
        applyTransform();
      }
      lastTapTime = now;
      dragStartX = e.touches[0].clientX - panX;
      dragStartY = e.touches[0].clientY - panY;
      isDragging = scale > 1;
    }
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    if(e.touches.length === 2 && pinchStartDist){
      const dist = getDist(e.touches);
      scale = Math.min(4, Math.max(1, pinchStartScale * (dist / pinchStartDist)));
      if(scale === 1){ panX = 0; panY = 0; }
      applyTransform();
    } else if(e.touches.length === 1 && isDragging){
      panX = e.touches[0].clientX - dragStartX;
      panY = e.touches[0].clientY - dragStartY;
      applyTransform();
    }
  }, { passive: true });

  viewport.addEventListener('touchend', () => {
    isDragging = false;
    pinchStartDist = 0;
  });

  return { open, close, get isOpen(){ return lightbox.classList.contains('open'); } };
})();

/* ============================================
   Main product gallery — click zones + autoplay
   ============================================ */
function initializeGallery(){
  const mainImage = document.getElementById('mainImage');
  const thumbs = Array.from(document.querySelectorAll('.thumb'));
  const prevBtn = document.getElementById('galPrev');
  const nextBtn = document.getElementById('galNext');
  const zoneLeft = document.getElementById('zoneLeft');
  const zoneCenter = document.getElementById('zoneCenter');
  const zoneRight = document.getElementById('zoneRight');

  let currentIndex = 0;
  let autoplayTimer = null;
  let autoplayPaused = false;

  function setImage(index, { userInitiated = false } = {}){
    currentIndex = (index + galleryImages.length) % galleryImages.length;
    const img = galleryImages[currentIndex];
    mainImage.style.opacity = 0;
    setTimeout(() => {
      mainImage.src = img.src;
      mainImage.alt = img.alt;
      mainImage.style.opacity = 1;
    }, 150);
    thumbs.forEach((t, i) => t.classList.toggle('active', i === currentIndex));
    if(FullscreenViewer.isOpen){
      // keep fullscreen viewer in sync if it happens to be open on this gallery
    }
    if(userInitiated) restartAutoplay();
  }

  function scheduleNext(){
    clearTimeout(autoplayTimer);
    if(autoplayPaused || document.hidden) return;
    const duration = galleryImages[currentIndex].duration || 5000;
    autoplayTimer = setTimeout(() => {
      setImage(currentIndex + 1);
      scheduleNext();
    }, duration);
  }
  function restartAutoplay(){
    clearTimeout(autoplayTimer);
    scheduleNext();
  }
  function pauseAutoplay(){ autoplayPaused = true; clearTimeout(autoplayTimer); }
  function resumeAutoplay(){ autoplayPaused = false; scheduleNext(); }

  thumbs.forEach((thumb, i) => thumb.addEventListener('click', () => setImage(i, { userInitiated: true })));
  prevBtn.addEventListener('click', () => setImage(currentIndex - 1, { userInitiated: true }));
  nextBtn.addEventListener('click', () => setImage(currentIndex + 1, { userInitiated: true }));

  // Left/right/center click zones on the main image
  zoneLeft.addEventListener('click', () => setImage(currentIndex - 1, { userInitiated: true }));
  zoneRight.addEventListener('click', () => setImage(currentIndex + 1, { userInitiated: true }));
  zoneCenter.addEventListener('click', () => {
    pauseAutoplay();
    FullscreenViewer.open(galleryImages, currentIndex, () => {
      resumeAutoplay();
    });
  });
  // Keep the fullscreen viewer's index in sync when it navigates
  document.getElementById('lightboxNext').addEventListener('click', () => {});
  document.getElementById('lightboxPrev').addEventListener('click', () => {});

  // Pause autoplay when the tab is hidden, resume when visible
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){ clearTimeout(autoplayTimer); }
    else if(!autoplayPaused){ scheduleNext(); }
  });

  scheduleNext();
}

/* ============================================
   Before / After comparison slider
   ============================================ */
function initializeBeforeAfterSlider(){
  const stage = document.getElementById('baStage');
  if(!stage) return;
  const frame = document.getElementById('baFrame');
  const beforeWrap = document.getElementById('baBeforeWrap');
  const divider = document.getElementById('baDivider');
  const handle = document.getElementById('baHandle');

  let percent = 50; // starts centered so both Before and After are visible on load
  let isDragging = false;

  function syncFrameWidth(){
    frame.style.setProperty('--ba-frame-w', stage.offsetWidth + 'px');
  }

  function setPercent(p){
    percent = Math.min(100, Math.max(0, p));
    beforeWrap.style.width = percent + '%';
    divider.style.left = percent + '%';
    handle.setAttribute('aria-valuenow', String(Math.round(percent)));
  }

  function percentFromClientX(clientX){
    const rect = stage.getBoundingClientRect();
    const x = clientX - rect.left;
    return (x / rect.width) * 100;
  }

  function startDrag(clientX, pointerId, capture){
    isDragging = true;
    if(capture && handle.setPointerCapture){
      try{ handle.setPointerCapture(pointerId); }catch(err){}
    }
    setPercent(percentFromClientX(clientX));
  }
  function handleMove(e){
    if(!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    setPercent(percentFromClientX(clientX));
    if(e.cancelable) e.preventDefault();
  }
  function stopDrag(){ isDragging = false; }

  handle.addEventListener('pointerdown', (e) => {
    startDrag(e.clientX, e.pointerId, true);
    e.preventDefault();
  });
  divider.addEventListener('pointerdown', (e) => {
    startDrag(e.clientX, e.pointerId, false);
    e.preventDefault();
  });
  window.addEventListener('pointermove', handleMove, { passive: false });
  window.addEventListener('pointerup', stopDrag);
  window.addEventListener('pointercancel', stopDrag);

  // Also let clicking anywhere on the stage jump the divider there
  stage.addEventListener('pointerdown', (e) => {
    if(handle.contains(e.target) || divider.contains(e.target)) return;
    startDrag(e.clientX, e.pointerId, false);
  });

  // Keyboard accessibility
  handle.addEventListener('keydown', (e) => {
    if(e.key === 'ArrowLeft'){ setPercent(percent - 5); e.preventDefault(); }
    if(e.key === 'ArrowRight'){ setPercent(percent + 5); e.preventDefault(); }
  });

  window.addEventListener('resize', syncFrameWidth, { passive: true });
  syncFrameWidth();
  setPercent(50);
}

/* ============================================
   Showcase grid — opens the fullscreen viewer
   ============================================ */
function initializeShowcase(){
  const items = Array.from(document.querySelectorAll('.showcase-item'));
  const images = items.map(item => ({
    src: item.dataset.src,
    alt: item.querySelector('img').alt
  }));
  items.forEach((item, i) => {
    item.addEventListener('click', () => FullscreenViewer.open(images, i));
  });
}

/* ============================================
   Accordions
   ============================================ */
function initializeAccordions(){
  const items = document.querySelectorAll('.accordion-item');
  items.forEach(item => {
    const trigger = item.querySelector('.accordion-trigger');
    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach(i => { i.classList.remove('open'); i.querySelector('.accordion-trigger').setAttribute('aria-expanded', 'false'); });
      if(!isOpen){
        item.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/* ============================================
   Testimonial carousel
   ============================================ */
function initializeTestimonials(){
  const section = document.querySelector('.testimonial-section');
  if (!testimonialData.length) { if (section) section.hidden = true; return; }
  const track = document.getElementById('testimonialTrack');
  track.innerHTML = testimonialData.map(t => `
    <div class="t-card">
      <span class="stars" aria-label="${t.rating} out of 5">${"★".repeat(t.rating)}${"☆".repeat(5-t.rating)}</span>
      <p>"${escapeHTML(t.text)}"</p>
      <p class="t-name">${escapeHTML(t.name)}${t.city ? ` · ${escapeHTML(t.city)}` : ''}</p>
    </div>
  `).join('');

  const prevBtn = document.getElementById('testPrev');
  const nextBtn = document.getElementById('testNext');

  function scrollByCard(direction){
    const card = track.querySelector('.t-card');
    if(!card) return;
    const gap = 20;
    const amount = (card.offsetWidth + gap) * direction;
    track.scrollBy({ left: amount, behavior: 'smooth' });
  }
  prevBtn.addEventListener('click', () => scrollByCard(-1));
  nextBtn.addEventListener('click', () => scrollByCard(1));
}

/* ============================================
   Reviews list + add review form
   ============================================ */
function initializeReviews(){
  const list = document.getElementById('reviewsList');
  const writeReview = document.getElementById('writeReview');
  if (writeReview) writeReview.hidden = !window.BookivoBookCanReview;

  function renderReviews(){
    if (!reviewsData.length) {
      list.innerHTML = '<p class="empty-reviews">No reviews yet. Be the first to share your experience after buying this ebook.</p>';
      return;
    }
    list.innerHTML = reviewsData.map(r => {
      const rating = Math.min(5, Math.max(1, parseInt(r.rating, 10) || 5));
      const filled = '★'.repeat(rating);
      const empty = '☆'.repeat(5 - rating);
      return `
      <div class="review-item" data-reveal>
        <span class="stars" aria-hidden="true"><span class="stars-filled">${filled}</span><span class="stars-empty">${empty}</span></span>
        <h4>${escapeHTML(r.title)}</h4>
        <p>${escapeHTML(r.body)}</p>
        <p class="rev-meta">${escapeHTML(r.name)} · Verified buyer</p>
      </div>
    `;
    }).join('');
    // Re-observe newly injected reveal items
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){ entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.1 });
    list.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
  }
  renderReviews();

  document.getElementById('addReviewBtn').addEventListener('click', () => {
    if (!window.BookivoBookCanReview) {
      showToast('You must buy this book before you can review it.', 'error');
      return;
    }
    document.getElementById('writeReview').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Star selector
  let selectedRating = 0;
  const starButtons = document.querySelectorAll('#starSelector button');
  starButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!window.BookivoBookCanReview) {
        showToast('You must buy this book before you can review it.', 'error');
        return;
      }
      selectedRating = parseInt(btn.dataset.star, 10);
      starButtons.forEach(b => b.classList.toggle('active', parseInt(b.dataset.star, 10) <= selectedRating));
    });
  });

  // Form validation + submission
  const form = document.getElementById('reviewForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.BookivoBookCanReview) {
      showToast('You must buy this book before you can review it.', 'error');
      return;
    }
    const title = document.getElementById('reviewTitle');
    const body = document.getElementById('reviewBody');
    let valid = !!title.value.trim() && !!body.value.trim() && selectedRating > 0;

    [title, body].forEach(field => {
      const row = field.closest('.form-row');
      if(!field.value.trim()){
        row.classList.add('error');
        valid = false;
      } else {
        row.classList.remove('error');
      }
    });

    if(!valid){
      showToast('Choose a rating and complete the review fields.', 'error');
      return;
    }
    try {
      await Bookivo.addReview({ rating: selectedRating, title: title.value.trim(), body: body.value.trim() });
      window.location.reload();
    } catch (error) {
      showToast(error.message || 'The review could not be saved.', 'error');
    }
  });
}

function escapeHTML(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================
   Sticky mobile purchase bar
   ============================================ */
function initializeMobilePurchaseBar(){
  const bar = document.getElementById('mobilePurchaseBar');
  const trigger = document.getElementById('product');
  if(!trigger) return;

  let viewTracked = false;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      bar.classList.toggle('visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
      if (entry.isIntersecting && !viewTracked) {
        viewTracked = true;
        Bookivo.track('product_view');
      }
    });
  }, { threshold: 0 });
  observer.observe(trigger);
}


/* ============================================
   Quantity selector + purchase buttons
   ============================================ */
function initializePurchase(){
  const addButton = document.getElementById('addToCartBtn');
  const buyButton = document.getElementById('buyNowBtn');
  const inCart = window.Bookivo.CartStore.has(BOOK_ID);
  if (inCart) {
    addButton.textContent = 'In Cart ✓';
    addButton.disabled = true;
  }
  function unavailable(){
    showToast('Cart is not available right now. Please refresh and try again.', 'error');
  }
  function buyNow(){
    if (!Bookivo.buyNow()) unavailable();
  }

  addButton.addEventListener('click', async () => {
    addButton.disabled = true;
    try {
      if (await Bookivo.addToCart()) {
        addButton.textContent = 'In Cart ✓';
        showToast('Added to cart.', 'success');
      } else unavailable();
    } catch (error) {
      addButton.disabled = false;
      showToast(error.message || 'Could not add this ebook to the cart.', 'error');
    }
  });
  buyButton.addEventListener('click', buyNow);
  document.getElementById('mpbBuyBtn').addEventListener('click', buyNow);
  document.getElementById('getCookbookBtn').addEventListener('click', () => {
    document.getElementById('product').scrollIntoView({ behavior: 'smooth' });
  });
}

/* ============================================
   Init
   ============================================ */
function init(){
  Bookivo.track('visit');
  initializeGallery();
  initializeBeforeAfterSlider();
  initializeShowcase();
  initializePurchase();
  initializeAccordions();
  initializeTestimonials();
  initializeReviews();
  initializeMobilePurchaseBar();
  initializeScrollAnimations();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();



