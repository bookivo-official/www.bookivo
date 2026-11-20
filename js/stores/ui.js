'use strict';
(function (w) {
  const store = w.Bookivo.Store.create({ drawer:false, search:false, chat:false });
  w.Bookivo.UiStore = { get:store.get, set:store.set, subscribe:store.subscribe };
})(window);

