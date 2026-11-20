'use strict';
(function (w) {
  w.Bookivo.Api = w.Bookivo.Api || {};
  w.Bookivo.Api.delay = function (min, max) { const low = min || 300; const high = max || 800; return new Promise(resolve => setTimeout(resolve, low + Math.random() * (high - low))); };
})(window);

