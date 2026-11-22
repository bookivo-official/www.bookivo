'use strict';
(function (w) {
  w.Bookivo.Api.coupons = {
    async validate(code, items, now) {
      const result=await w.Bookivo.Api.orders.action('coupon',{code,books:items.map(b=>b.id)});
      if(result.valid){const offers=w.bookivoSettings.offers||[];w.bookivoSettings.offers=[...offers.filter(o=>o.code!==result.offer.code),{...offers.find(o=>o.code===result.offer.code),...result.offer}];}
      return result;
    },
    async list() { await w.Bookivo.Api.delay(); return (w.bookivoSettings?.offers||[]).filter(o=>o.listed).map(o=>({...o,validity:o.expires?'Ends '+new Date(o.expires).toLocaleString():'No expiry'})); }
  };
})(window);

