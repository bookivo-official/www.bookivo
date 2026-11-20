'use strict';
(function (w) {
  const store = w.Bookivo.Store.create([], 'cart');
  function cleanIds(ids) { return Array.from(new Set((Array.isArray(ids) ? ids : []).filter(x => typeof x === 'string'))); }
  const CartStore = {
    getItems:() => cleanIds(store.get()),
    add(id) { if (!id) return store.get(); return store.set(ids => cleanIds(ids).concat(cleanIds(ids).includes(id) ? [] : [id])); },
    remove(id) { return store.set(ids => cleanIds(ids).filter(x => x !== id)); },
    has(id) { return cleanIds(store.get()).includes(id); },
    count:() => cleanIds(store.get()).length,
    clear:() => store.set([]),
    subscribe:store.subscribe
  };
  w.Bookivo.CartStore = CartStore;
  w.CartStore = CartStore;
})(window);

