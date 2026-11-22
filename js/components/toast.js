'use strict';
(function (w) {
  let timer;
  function show(message, type) {
    let node = document.getElementById('bookivo-toast');
    if (!node) { node=document.createElement('div'); node.id='bookivo-toast'; node.className='toast'; node.setAttribute('role','status'); node.setAttribute('aria-live','polite'); document.body.appendChild(node); }
    node.textContent=message; node.dataset.type=type||'info'; node.classList.add('is-visible'); clearTimeout(timer); timer=setTimeout(()=>node.classList.remove('is-visible'),3000);
  }
  w.Bookivo.Toast={show}; w.showToast=show;
})(window);

