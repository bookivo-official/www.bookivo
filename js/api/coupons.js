'use strict';
(function (w) {
  w.Bookivo.Api.coupons = {
    async validate(code, items, now) { await w.Bookivo.Api.delay(); const result = w.Bookivo.Pricing.calculateOrder({ items, mode:'coupon', couponCode:code, nowIST:now || new Date() }); return { valid:result.discountTotal > 0, result, message:result.warnings[0] || (result.discountTotal ? result.appliedLabel + ' applied' : 'Enter a valid code.') }; },
    async list() { await w.Bookivo.Api.delay(); return w.Bookivo.Data.coupons.slice(); }
  };
})(window);

