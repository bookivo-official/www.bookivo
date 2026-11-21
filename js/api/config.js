'use strict';
(function (w) {
  w.Bookivo.Api.config = { async getAnnouncement() { return w.Bookivo.Data.content.announcement; }, async getContent() { return Object.assign({},w.Bookivo.Data.content); }, async getFaq() { return w.Bookivo.Data.faq.slice(); } };
})(window);

