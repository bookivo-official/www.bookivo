'use strict';
(function (w) {
  let timer;
  function init(){const panel=document.getElementById('searchPanel');if(!panel)return;const input=panel.querySelector('input');const results=panel.querySelector('[data-search-results]');const view=panel.querySelector('[data-search-view]');function close(){w.Bookivo.Modal.close(panel);}document.addEventListener('click',e=>{if(e.target.closest('[data-search-open]')){w.Bookivo.Modal.open(panel);input.focus();}if(e.target.closest('[data-search-close]'))close();});input.addEventListener('input',()=>{clearTimeout(timer);const q=input.value.trim();if(view)view.href='books.html?q='+encodeURIComponent(q);if(!q){results.innerHTML='<p class="search-hint">Search titles, authors, categories or topics.</p>';return;}results.innerHTML=w.Bookivo.Skeleton.grid(3);timer=setTimeout(async()=>{const books=await w.Bookivo.Api.books.search(q);results.innerHTML=books.length?w.Bookivo.BookCard.renderGrid(books):'<p class="search-hint">No books found. Try another search.</p>';},220);});panel.querySelector('form').addEventListener('submit',e=>{e.preventDefault();w.location.href='books.html?q='+encodeURIComponent(input.value.trim());});panel.querySelectorAll('[data-search-chip]').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.searchChip;input.dispatchEvent(new Event('input'));}));}
  w.Bookivo.Search={init};
})(window);

