'use strict';
(function (w) {
  const B = w.Bookivo;
  function loadBookPageScript(bookFolder) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(`${bookFolder}/book.js`, document.baseURI).href;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load the Cookbook page interactions.'));
      document.head.appendChild(script);
    });
  }
  async function init() {
    const page = document.getElementById('pageMain');
    const bookId = page.dataset.bookId || 'cookbook';
    const book = await B.Api.books.get(bookId);
    if (!book) throw new Error('This product is missing from the BOOKIVO catalog.');
    const reviews = await B.Api.reviews.list(book.id);
    const rating = B.Rating.summary(reviews);
    const bookFolder = book.folder || 'BOOK-1';
    page.dataset.bookId = book.id;
    page.querySelector('.product-title').textContent = book.title;
    page.querySelectorAll('[data-book-price]').forEach(node => { node.textContent = B.Format.rupees(book.price); });
    page.querySelectorAll('.overall-rating').forEach(node => { node.textContent = rating.count ? rating.average.toFixed(1) : '—'; });
    page.querySelectorAll('.review-count').forEach(node => { node.textContent = String(rating.count); });
    page.querySelectorAll('.rating-row .stars, .reviews-summary .stars').forEach(node => {
      const filled = rating.count ? Math.round(rating.average) : 0;
      node.textContent = '★'.repeat(filled) + '☆'.repeat(5 - filled);
      node.setAttribute('aria-label', rating.count ? `${rating.average} out of 5 stars` : 'No ratings yet');
    });
    const oldPrice = page.querySelector('.price-old');
    const discountBadge = page.querySelector('.price-row .badge');
    const hasDiscount = book.id === 'cookbook' || (Number(book.mrp) > Number(book.price));
    if (oldPrice) { oldPrice.textContent = B.Format.rupees(book.id === 'cookbook' ? 199 : book.mrp); oldPrice.hidden = !hasDiscount; }
    if (discountBadge) { discountBadge.textContent = book.id === 'cookbook' ? '50% OFF' : `${Math.floor((1 - Number(book.price) / Number(book.mrp)) * 100)}% OFF`; discountBadge.hidden = !hasDiscount; }
    document.title = `${book.title} — Bookivo`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = book.subtitle;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = `${book.title} — Bookivo`;
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.content = book.subtitle;
    const schema = document.createElement('script');
    schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: book.title,
      description: book.subtitle,
      brand: { '@type': 'Brand', name: 'Bookivo' },
      offers: { '@type': 'Offer', price: book.price, priceCurrency: 'INR', availability: 'https://schema.org/InStock' }
    });
    document.head.appendChild(schema);
    w.BookivoBookReviews = reviews.map(review => ({
      title: review.title,
      body: review.body,
      name: review.name,
      rating: review.rating
    }));
    w.BookivoBookCanReview = !!B.AuthStore.get() && await B.Api.orders.owns(book.id);
    w.BookivoProduct=book;
    await loadBookPageScript(book.id==='book-3'?'BOOK-2':bookFolder);
    B.ProductOffer.bind(book,page.querySelector('.purchase-row'),page.querySelector('[data-book-price]'));
  }
  B.PageHandlers.book1 = init;
})(window);
