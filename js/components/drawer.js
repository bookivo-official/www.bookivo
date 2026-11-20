'use strict';
(function (w) {
  function open(id){const el=document.getElementById(id);if(el){el.hidden=false;el.classList.add('is-open');el.setAttribute('aria-hidden','false');}}
  function close(id){const el=document.getElementById(id);if(el){el.classList.remove('is-open');el.setAttribute('aria-hidden','true');setTimeout(()=>{if(!el.classList.contains('is-open'))el.hidden=true;},180);}}
  w.Bookivo.Drawer={open,close};
})(window);

