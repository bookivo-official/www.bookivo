'use strict';
(function (w) {
  let active=null, priorFocus=null;
  function open(id) { const el=typeof id==='string'?document.getElementById(id):id; if(!el)return; priorFocus=document.activeElement; active=el; el.hidden=false; el.classList.add('is-open'); el.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); const target=el.querySelector('[autofocus],input,button,[tabindex="0"]'); if(target)setTimeout(()=>target.focus(),30); }
  function close(id) { const el=id?(typeof id==='string'?document.getElementById(id):id):active; if(!el)return; el.classList.remove('is-open'); el.setAttribute('aria-hidden','true'); el.hidden=true; if(active===el)active=null; if(!document.querySelector('.modal-backdrop.is-open'))document.body.classList.remove('modal-open'); if(priorFocus&&priorFocus.focus)priorFocus.focus(); }
  document.addEventListener('click',e=>{ const closeBtn=e.target.closest('[data-modal-close]'); if(closeBtn){close(closeBtn.closest('.modal-backdrop'));} else if(e.target.classList.contains('modal-backdrop')) close(e.target); });
  document.addEventListener('keydown',e=>{ if(!active)return; if(e.key==='Escape'){close(active);return;} if(e.key==='Tab'){const nodes=Array.from(active.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]')).filter(x=>!x.hidden); if(!nodes.length)return; const first=nodes[0],last=nodes[nodes.length-1]; if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}} });
  w.Bookivo.Modal={open,close};
})(window);

