'use strict';
(function (w) {
  function open(images,index) { const box=document.getElementById('bookivo-lightbox'); if(!box)return;const img=box.querySelector('img');let list=images||[];let i=index||0;function render(){img.src=list[i];img.alt='Book preview';}box.hidden=false;render();box.querySelector('[data-prev]').onclick=()=>{i=(i+list.length-1)%list.length;render();};box.querySelector('[data-next]').onclick=()=>{i=(i+1)%list.length;render();};w.Bookivo.Modal.open(box); }
  w.Bookivo.Lightbox={open};
})(window);

