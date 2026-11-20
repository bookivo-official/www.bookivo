'use strict';
(function (w) {
  w.Bookivo.Api.config = { async getAnnouncement() { await w.Bookivo.Api.delay(100,250); return w.Bookivo.Data.content.announcement; }, async getContent() { await w.Bookivo.Api.delay(100,250); return Object.assign({},w.Bookivo.Data.content); }, async getFaq() { await w.Bookivo.Api.delay(100,250); return w.Bookivo.Data.faq.slice(); } };
})(window);

