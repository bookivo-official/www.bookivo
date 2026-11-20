'use strict';
(function (w) {
  function create(initialValue, persistKey) {
    let state = initialValue;
    const listeners = new Set();
    if (persistKey) state = w.Bookivo.Storage.read(persistKey, initialValue);
    function publish() { listeners.forEach(fn => fn(state)); }
    return {
      get: () => state,
      set(next) { state = typeof next === 'function' ? next(state) : next; if (persistKey) w.Bookivo.Storage.write(persistKey, state); publish(); return state; },
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    };
  }
  w.Bookivo.Store = { create };
})(window);

