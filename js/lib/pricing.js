'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.Bookivo = root.Bookivo || {}; root.Bookivo.Pricing = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  const COUPONS = Object.freeze({ BOOKIVO: 2, WELCOME10: 10, NEWYEAR15: 15, FESTIVE20: 20 });
  const SCRATCH_ODDS = Object.freeze([{ pages: 8, weight: 10 }, { pages: 10, weight: 50 }, { pages: 12, weight: 25 }, { pages: 16, weight: 15 }]);
  function clampPercent(value) { return Math.max(0, Math.min(20, Number(value) || 0)); }
  function getISTDate(date) {
    const d = new Date(date);
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const part = type => Number(parts.find(p => p.type === type).value);
    return { year: part('year'), month: part('month'), day: part('day') };
  }
  function is19thIST(date) { return getISTDate(date).day === 19; }
  function calculateOrder(input) {
    const items = Array.isArray(input.items) ? input.items : [];
    const mode = input.mode || 'none';
    const now = input.nowIST == null ? new Date(0) : input.nowIST;
    const subtotal = items.reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.price) || 0)), 0);
    const warnings = [];
    let couponRate = 0;
    let label = '';
    let requestedPages = 0;
    const code = String(input.couponCode || '').trim().toUpperCase();
    if (mode === 'coupon') {
      if (code === 'TODAY_IS_19') {
        if (is19thIST(now)) { couponRate = 19; label = '19th-day code, 19%'; }
        else warnings.push('This code works only on the 19th of every month');
      } else if (Object.prototype.hasOwnProperty.call(COUPONS, code)) {
        if(code==='BOOKIVO' && !items.some(book=>book.price>100)) warnings.push('BOOKIVO applies to ebooks priced above ₹100.');
        couponRate = clampPercent(COUPONS[code]); label = `Coupon ${code}, ${couponRate}%`;
      } else if (/^BOOKIVO\d{3,}$/.test(code)) {
        couponRate = 5; label = 'Partner code, 5%';
      } else if (code) warnings.push('We could not find that coupon code');
    } else if (mode === 'pages') {
      requestedPages = Math.max(0, Math.floor(Number(input.pagesToUse) || 0));
      const balance = Math.max(0, Math.floor(Number(input.pagesBalance) || 0));
      const maxAllowed = items.reduce((sum, item) => {
        const price = Math.max(0, Math.floor(Number(item.price) || 0));
        return sum + (price > 99 ? Math.floor(price * 0.19) : 0);
      }, 0);
      requestedPages = Math.min(requestedPages, balance, maxAllowed);
      label = requestedPages ? 'Bookivo Pages' : '';
    }
    let pagesLeft = requestedPages;
    let pagesUsed = 0;
    const lines = items.map(item => {
      const price = Math.max(0, Math.floor(Number(item.price) || 0));
      let discount = 0;
      if (couponRate && String(input.couponCode).trim().toUpperCase()==='BOOKIVO') discount = price > 100 ? Math.round(price * 2) / 100 : 0;
      else if (mode === 'coupon' && couponRate) discount = Math.floor(price * clampPercent(couponRate) / 100);
      if (mode === 'pages' && price > 99) {
        discount = Math.min(pagesLeft, Math.floor(price * 0.19));
        pagesLeft -= discount; pagesUsed += discount;
      }
      discount = Math.min(discount, Math.floor(price * clampPercent(20) / 100));
      return { id: item.id, title: item.title, price, discount, total: price - discount };
    });
    const discountTotal = lines.reduce((sum, line) => sum + line.discount, 0);
    return { lines, subtotal, discountTotal, total: subtotal - discountTotal, appliedLabel: discountTotal ? label : '', pagesUsed, warnings };
  }
  function pagesEarned(items) { return (items || []).reduce((sum, item) => sum + (Number(item.price) > 249 ? 50 : 0), 0); }
  return { COUPONS, SCRATCH_ODDS, getISTDate, is19thIST, clampPercent, calculateOrder, pagesEarned };
});

