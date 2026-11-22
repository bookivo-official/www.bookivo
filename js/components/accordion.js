'use strict';
(function (w) {
  function init(root) { (root||document).addEventListener('click',e=>{const b=e.target.closest('[data-accordion-trigger]');if(!b)return;const item=b.closest('.accordion-item');const panel=item&&item.querySelector('.accordion-panel');if(!item||!panel)return;const open=!item.classList.contains('is-open');document.querySelectorAll('.accordion-item.is-open').forEach(other=>{other.classList.remove('is-open');other.querySelector('[data-accordion-trigger]')?.setAttribute('aria-expanded','false');const body=other.querySelector('.accordion-panel');if(body)body.hidden=true;});item.classList.toggle('is-open',open);b.setAttribute('aria-expanded',String(open));panel.hidden=!open;}); }
  let counter=0;
  function html(item,index) { index=++counter; return `<div class="accordion-item"><button class="accordion-trigger" data-accordion-trigger aria-expanded="false" aria-controls="acc-${index}">${w.Bookivo.Dom.escapeHTML(item.title||item.q)}<span aria-hidden="true">+</span></button><div class="accordion-panel" id="acc-${index}" hidden>${w.Bookivo.Dom.escapeHTML(item.subtitle||item.a||'')}</div></div>`; }
  w.Bookivo.Accordion={init,html};
})(window);

