'use strict';
(function () {
  const page=document.body.dataset.page||'not-found';
  const common=[
    'js/config.js','js/lib/storage.js','js/lib/format.js','js/lib/dom.js','js/lib/track.js','js/lib/pricing.js','js/lib/store.js',
    'js/data/categories.js','js/data/books.js','js/data/coupons.js','js/data/faq.js','js/data/content.js','js/data/legal.js','js/data/disposable-domains.js',
    'js/api/base.js','js/api/auth.js','js/api/books.js','js/api/cart.js','js/api/orders.js','js/api/pages.js','js/api/coupons.js','js/api/reviews.js','js/api/support.js','js/api/chat.js','js/api/config.js',
    'js/stores/auth.js','js/stores/cart.js','js/stores/pages.js','js/stores/ui.js',
    'js/components/toast.js','js/components/modal.js','js/components/rating.js','js/components/accordion.js','js/components/skeleton.js','js/components/bookcard.js','js/components/otp-input.js','js/components/lightbox.js','js/components/gallery.js','js/components/drawer.js','js/components/contact.js','js/components/chat.js','js/components/confetti.js','js/components/scratch-card.js','js/components/search.js','js/components/shell.js',
    'js/pages/checkout.js','js/pages/runtime.js'
  ];
  const lean=['js/config.js','js/lib/storage.js','js/lib/format.js','js/lib/dom.js','js/lib/track.js','js/lib/pricing.js','js/lib/store.js','js/data/categories.js','js/data/books.js','js/data/faq.js','js/data/content.js','js/data/disposable-domains.js','js/api/base.js','js/api/auth.js','js/api/books.js','js/api/cart.js','js/api/orders.js','js/api/pages.js','js/api/coupons.js','js/api/config.js','js/stores/auth.js','js/stores/cart.js','js/stores/pages.js','js/stores/ui.js','js/components/toast.js','js/components/modal.js','js/components/accordion.js','js/components/otp-input.js','js/api/chat.js','js/components/chat.js','js/components/shell.js','js/pages/checkout.js','js/pages/runtime.js'];
  const pageScript={home:'js/pages/home.js',book:'js/pages/book.js',book1:'js/pages/book1.js',catalogue:'js/pages/catalogue.js',category:'js/pages/catalogue.js','new-releases':'js/pages/catalogue.js',bestsellers:'js/pages/catalogue.js',cart:'js/pages/cart.js',thankyou:'js/pages/thankyou.js',lp:'js/pages/lp.js',login:'js/pages/auth.js',signup:'js/pages/auth.js',account:'js/pages/account.js','my-books':'js/pages/shelf.js',orders:'js/pages/account.js',tickets:'js/pages/account.js',read:'js/pages/reader.js',pages:'js/pages/pages-balance.js',coupons:'js/pages/coupons.js',contact:'js/pages/contact-page.js',about:'js/pages/content.js',faq:'js/pages/content.js',terms:'js/pages/content.js',privacy:'js/pages/content.js','refund-policy':'js/pages/content.js','design-system':'js/pages/design-system.js','not-found':'js/pages/not-found.js'};
  const scripts=(page==='lp'?lean:common).concat(pageScript[page]||'js/pages/not-found.js');
  const root=new URL('../',document.currentScript.src);
  function load(path){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(path,root).href;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load '+path));document.head.appendChild(s);});}
  (async()=>{try{await load('js/vendor/supabase/supabase.js');await load('supabase-config.js');for(const path of scripts)await load(path);await window.Bookivo.AuthStore.ready;await window.Bookivo.Runtime.start();}catch(error){console.error('[Bookivo] startup failed',error);const main=document.getElementById('pageMain');if(main)main.innerHTML='<div class="empty-state"><h1>We could not load this page</h1><p>Please refresh and try again.</p></div>';}})();
})();

