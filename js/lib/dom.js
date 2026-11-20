'use strict';
(function (w) {
  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.from((root || document).querySelectorAll(selector)); }
  function params() { return new URLSearchParams(w.location.search); }
  function setQuery(key, value) { const p = params(); if (value) p.set(key, value); else p.delete(key); w.history.replaceState({}, '', w.location.pathname + (p.toString() ? '?' + p : '')); }
  function slug(value) { return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  w.Bookivo.Dom = { escapeHTML, $, $$, params, setQuery, slug };
})(window);

