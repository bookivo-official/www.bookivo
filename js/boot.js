'use strict';
(function () {
  const page=document.body.dataset.page||'not-found';
  const pageScript={home:'js/pages/home.js',book:'js/pages/book.js',book1:'js/pages/book1.js',catalogue:'js/pages/catalogue.js',category:'js/pages/catalogue.js','new-releases':'js/pages/catalogue.js',bestsellers:'js/pages/catalogue.js',cart:'js/pages/cart.js',thankyou:'js/pages/thankyou.js',lp:'js/pages/lp.js',login:'js/pages/auth.js',signup:'js/pages/auth.js',account:'js/pages/account.js','my-books':'js/pages/shelf.js',orders:'js/pages/account.js',tickets:'js/pages/account.js',read:'js/pages/reader.js',pages:'js/pages/pages-balance.js',coupons:'js/pages/coupons.js',contact:'js/pages/contact-page.js',about:'js/pages/content.js',faq:'js/pages/content.js',terms:'js/pages/content.js',privacy:'js/pages/content.js','refund-policy':'js/pages/content.js','design-system':'js/pages/design-system.js','not-found':'js/pages/not-found.js'};
  const scripts=['js/components/storefront.generated.js',pageScript[page]||'js/pages/not-found.js'];
  const root=new URL('../',document.currentScript.src);
  function load(path){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.async=false;s.src=new URL(path,root).href;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load '+path));document.head.appendChild(s);});}
  (async()=>{try{await Promise.all(['js/vendor/supabase/supabase.js','supabase-config.js','js/store-status.js',...scripts].map(load));if(!await window.bookivoReady)return;await window.Bookivo.AuthStore.ready;await window.Bookivo.Runtime.start();}catch(error){console.error('[Bookivo] startup failed',error);const main=document.getElementById('pageMain');if(main)main.innerHTML='<div class="empty-state"><h1>We could not load this page</h1><p>Please refresh and try again.</p></div>';}})();
})();

