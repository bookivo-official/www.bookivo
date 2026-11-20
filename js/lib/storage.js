'use strict';
(function (w) {
  const prefix = 'bookivo_';
  function read(key, fallback) {
    try { const raw = w.localStorage.getItem(prefix + key); return raw === null ? fallback : JSON.parse(raw); }
    catch (_) { return fallback; }
  }
  function write(key, value) {
    try { w.localStorage.setItem(prefix + key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }
  function remove(key) { try { w.localStorage.removeItem(prefix + key); } catch (_) {} }
  function sessionRead(key, fallback) {
    try { const raw = w.sessionStorage.getItem(prefix + key); return raw === null ? fallback : JSON.parse(raw); }
    catch (_) { return fallback; }
  }
  function sessionWrite(key, value) {
    try { w.sessionStorage.setItem(prefix + key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }
  function clearApp() {
    try { Object.keys(w.localStorage).filter(k => k.indexOf(prefix) === 0).forEach(k => w.localStorage.removeItem(k)); }
    catch (_) {}
  }
  function removeLegacy() {
    try { Object.keys(w.localStorage).filter(k => k.indexOf('b99_') === 0).forEach(k => w.localStorage.removeItem(k)); }
    catch (_) {}
  }
  w.Bookivo.Storage = { read, write, remove, sessionRead, sessionWrite, clearApp, removeLegacy };
})(window);

