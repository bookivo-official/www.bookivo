'use strict';
(function (w) {
  const B = w.Bookivo;
  async function init() {
    const root = document.getElementById('pageMain');
    const page = document.body.dataset.page;
    const [content, faq] = await Promise.all([B.Api.config.getContent(), B.Api.config.getFaq()]);

    if (page === 'faq') {
      const groups = [...new Set(faq.map(item => item.group))];
      root.innerHTML = `<section class="page-heading"><p class="eyebrow">Help centre</p><h1>Frequently asked questions</h1><p>Answers about shopping, ebooks, Bookivo Bits, coupons and policies.</p></section><div class="legal-layout"><nav class="legal-toc">${groups.map(group => `<a href="#${B.Dom.slug(group)}">${B.Dom.escapeHTML(group)}</a>`).join('')}</nav><article class="legal-article">${groups.map((group, groupIndex) => `<section id="${B.Dom.slug(group)}"><h2>${B.Dom.escapeHTML(group)}</h2><div class="accordion">${faq.filter(item => item.group === group).map((item, index) => B.Accordion.html({ title: item.q, subtitle: item.a }, groupIndex * 20 + index)).join('')}</div></section>`).join('')}</article></div>`;
      return;
    }

    if (page === 'about') {
      const social = content.social || {};
      const socialLink = (url, label) => `<a href="${B.Dom.escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      root.innerHTML = `<section class="page-heading"><p class="eyebrow">About Bookivo</p><h1>Practical ideas for everyday growth.</h1><p>Our mission is to make Bookivo India's most trusted place for practical, life-changing ebooks.</p></section><section class="author-card"><div class="avatar"><img src="assets/author.png" alt="the_samsonpaul" loading="lazy"></div><div><span class="eyebrow">The author</span><h2>the_samsonpaul</h2><p>${B.Dom.escapeHTML(content.bio)}</p></div></section><section class="section"><h2>What is coming</h2><div class="why-grid"><article class="why-card"><h3>More books</h3><p>New titles across self growth, financial education and self care.</p></article><article class="why-card"><h3>Audiobooks</h3><p>Audio formats may be explored in the future.</p></article><article class="why-card"><h3>Video summaries</h3><p>Short learning summaries may be added in the future.</p></article></div></section><section class="section"><h2>Follow Bookivo</h2><div class="hero-actions">${socialLink(social.instagram, 'Instagram')}${socialLink(social.telegram, 'Telegram')}${socialLink(social.x, 'X')}${socialLink(social.youtube, 'YouTube')}${socialLink(social.whatsapp, 'WhatsApp')}</div></section>`;
      return;
    }

    const legal = page === 'terms' || page === 'privacy' || page === 'refund-policy';
    if (!legal) {
      root.innerHTML = '<div class="empty-state"><h1>Page not found</h1><a href="index.html">Return to Bookivo</a></div>';
      return;
    }
    const policy = B.Data.legal;
    const sections = policy.sections[page].concat([policy.notice]);
    root.innerHTML = `<section class="page-heading"><p class="eyebrow">BOOKIVO policies</p><h1>${B.Dom.escapeHTML(policy.titles[page])}</h1><p>Last updated: 15 November 2026</p></section>${B.config.dev ? '<p class="legal-draft">Policy draft: verify owner, grievance and contact details before launch.</p>' : ''}<div class="legal-layout"><nav class="legal-toc">${sections.map(section => `<a href="#${B.Dom.slug(section.heading)}">${B.Dom.escapeHTML(section.heading)}</a>`).join('')}</nav><article class="legal-article">${sections.map(section => `<section id="${B.Dom.slug(section.heading)}"><h2>${B.Dom.escapeHTML(section.heading)}</h2><p>${B.Dom.escapeHTML(section.body)}</p></section>`).join('')}</article></div>`;
  }
  B.PageHandlers.about = init;
  B.PageHandlers.faq = init;
  B.PageHandlers.terms = init;
  B.PageHandlers.privacy = init;
  B.PageHandlers['refund-policy'] = init;
})(window);
