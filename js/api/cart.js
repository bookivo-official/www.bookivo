'use strict';
(function (w) {
  w.Bookivo.Api.cart = {
    async get() { return w.Bookivo.CartStore.getItems(); },
    async add(id) { w.Bookivo.CartStore.add(id); return w.Bookivo.CartStore.getItems(); },
    async remove(id) { w.Bookivo.CartStore.remove(id); return w.Bookivo.CartStore.getItems(); },
    async clear() { w.Bookivo.CartStore.clear(); return []; }
  };
})(window);

