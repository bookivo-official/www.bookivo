'use strict';
(function (w) {
  const sent = [];
  function event(name, data) {
    const payload = Object.assign({ event: name, page: document.body.dataset.page || 'unknown', at: new Date().toISOString() }, data || {});
    sent.push(payload);
    if (w.BOOKIVO_CONFIG && w.BOOKIVO_CONFIG.META_PIXEL_ID && typeof w.fbq === 'function') w.fbq('track', name, data || {});
  }
  w.Bookivo.Track = { event, recent: () => sent.slice() };
  w.trackEvent = function (name, data) { event(name, data); };
})(window);

