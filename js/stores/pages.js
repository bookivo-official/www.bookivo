'use strict';
(function (w) {
  const stored = 0;
  const store = w.Bookivo.Store.create(Math.max(0, Number(stored) || 0));
  w.Bookivo.PagesStore = { get:store.get, set:store.set, subscribe:store.subscribe };
})(window);

