'use strict';
(function (w) {
  const B = w.Bookivo;
  B.PageHandlers = B.PageHandlers || {};
  B.Runtime = {
    async start() {
      const page = document.body.dataset.page;
      B.Storage.removeLegacy();
      if (B.AuthStore.get()) sessionStorage.removeItem('bv_after_signin');
      if (page !== 'read') {
        await B.Shell.init();
        if (B.AuthStore.get()) B.Api.pages.getBalance().catch(() => {});
        if (page !== 'lp') B.Contact.init();
        B.Chat.init();
        B.Checkout.init();
        B.Accordion?.init();
      }
      B.Track.event('PageView');
      if (B.PageHandlers[page]) await B.PageHandlers[page]();
      B.ensureProfileName?.().catch(()=>{});
    }
  };
})(window);
