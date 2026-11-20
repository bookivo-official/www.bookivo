'use strict';
(function (w) {
  const money = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  function rupees(n) { return '₹' + money.format(Math.max(0, Math.round(Number(n) || 0))); }
  function discount(price, mrp) { return mrp > price ? Math.round((mrp - price) / mrp * 100) : 0; }
  function date(value) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }
  w.Bookivo.Format = { rupees, discount, date };
})(window);

