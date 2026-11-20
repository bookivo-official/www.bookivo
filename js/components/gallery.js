'use strict';
(function (w) {
  function bind(root,images) { root.addEventListener('click',e=>{const thumb=e.target.closest('[data-gallery-index]');if(!thumb)return;w.Bookivo.Lightbox.open(images,Number(thumb.dataset.galleryIndex));}); }
  w.Bookivo.Gallery={bind};
})(window);

