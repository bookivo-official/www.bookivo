'use strict';
(function (w) {
  const books = w.Bookivo.Data.books;
  function match(book, q) { const text = [book.title, book.subtitle, book.author, book.category].concat(book.tags || []).join(' ').toLowerCase(); return text.includes(q.toLowerCase()); }
  w.Bookivo.Api.books = {
    async categories() { await w.Bookivo.Api.delay(100,250); return w.Bookivo.Data.categories.slice(); },
    async list(filters) { await w.Bookivo.Api.delay(); let list = books.filter(book => book.catalog !== false); const f = filters || {}; if (f.category) list = list.filter(b => b.category.toLowerCase() === f.category.toLowerCase() || w.Bookivo.Dom.slug(b.category) === f.category); if (f.badge) list = list.filter(b => b.badges.includes(f.badge)); if (f.q) list = list.filter(b => match(b, f.q)); if (f.maxPrice) list = list.filter(b => b.price <= Number(f.maxPrice)); if (f.sort === 'price-low') list.sort((a,b) => a.price-b.price); if (f.sort === 'price-high') list.sort((a,b) => b.price-a.price); if (f.sort === 'newest') list.sort((a,b) => new Date(b.releasedAt)-new Date(a.releasedAt)); if (f.sort === 'popular') list.sort((a,b) => Number(b.badges.includes('bestseller'))-Number(a.badges.includes('bestseller'))); return list; },
    async get(slug) { await w.Bookivo.Api.delay(); return books.find(b => b.slug === slug || b.id === slug) || null; },
    async search(query) { await w.Bookivo.Api.delay(180, 320); const q = String(query || '').trim(); return q ? books.filter(b => b.catalog !== false && match(b, q)).slice(0, 6) : []; }
  };
})(window);

