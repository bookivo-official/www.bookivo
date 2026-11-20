'use strict';
(function (w) {
  const B = w.Bookivo;
  async function init() {
    const root = document.getElementById('pageMain');
    const coupons = await B.Api.coupons.list();
    const content = await B.Api.config.getContent();
    const social = content.social || {};
    const links = [
      ['Instagram', social.instagram], ['Telegram', social.telegram], ['X', social.x],
      ['YouTube', social.youtube], ['WhatsApp', social.whatsapp]
    ].filter(([, url]) => !!url);
    root.innerHTML = `<section class="page-heading"><p class="eyebrow">Savings at Bookivo</p><h1>Coupons</h1><p>Find current Bookivo offers here, or check our official channels for coupon announcements. Each offer includes its eligibility and expiry details.</p></section>${coupons.length ? `<div class="coupon-grid">${coupons.map(coupon => `<article class="coupon-card"><span class="eyebrow">${B.Dom.escapeHTML(coupon.percent)}% off</span><strong>${B.Dom.escapeHTML(coupon.code)}</strong><p>${B.Dom.escapeHTML(coupon.description)}</p><small>${B.Dom.escapeHTML(coupon.validity)}</small></article>`).join('')}</div>` : '<div class="empty-state"><h2>No active coupon offers</h2><p>When a Bookivo coupon is available, its code and terms will appear here. You can apply one code at checkout; coupon discounts are capped at 20% per eligible book.</p></div>'}<section class="section social-join"><h2>Follow Bookivo for offer updates</h2><div class="hero-actions">${links.map(([label, url]) => `<a href="${B.Dom.escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`).join('')}</div></section>`;
  }
  B.PageHandlers.coupons = init;
})(window);
