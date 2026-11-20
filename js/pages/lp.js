'use strict';
(function (w) {
  const B=w.Bookivo;
  async function init(){const book=await B.Api.books.get('road-to-5cr');if(book){document.querySelector('[data-lp-price]').textContent=B.Format.rupees(book.price);document.querySelector('[data-lp-mrp]').textContent=B.Format.rupees(book.mrp);document.querySelectorAll('[data-buy-road]').forEach(btn=>btn.addEventListener('click',()=>B.Checkout.open([book])));}const faq=await B.Api.config.getFaq();const slot=document.querySelector('[data-lp-faq]');if(slot)slot.innerHTML=faq.slice(0,4).map((q,i)=>B.Accordion.html({title:q.q,subtitle:q.a},i+100)).join('');}
  B.PageHandlers.lp=init;
})(window);


