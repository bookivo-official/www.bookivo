'use strict';
(function (w) {
  w.Bookivo.Api.cart = {
    async get() { await w.Bookivo.Api.delay(); return w.Bookivo.CartStore.getItems(); },
    async add(id) { await w.Bookivo.Api.delay(100, 250); w.Bookivo.CartStore.add(id); return w.Bookivo.CartStore.getItems(); },
    async remove(id) { await w.Bookivo.Api.delay(100, 250); w.Bookivo.CartStore.remove(id); return w.Bookivo.CartStore.getItems(); },
    async clear() { await w.Bookivo.Api.delay(100, 250); w.Bookivo.CartStore.clear(); return []; }
  };
})(window);

