'use strict';
(function (w) {
  const B=w.Bookivo; B.PageHandlers=B.PageHandlers||{};
  B.Runtime={async start(){const page=document.body.dataset.page;B.Storage.removeLegacy();if(B.AuthStore.get())sessionStorage.removeItem('bv_after_signin');await B.Shell.init(); if (B.AuthStore.get()) B.Api.pages.getBalance().catch(()=>{});if(page!=='lp'){B.Contact.init();B.Chat.init();}B.Checkout.init();if(B.Accordion)B.Accordion.init();B.Track.event('PageView');const fn=B.PageHandlers[page];if(fn)await fn();}};
})(window);

