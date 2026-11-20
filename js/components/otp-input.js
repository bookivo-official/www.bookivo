'use strict';
(function (w) {
  function mount(container, length) { const n=length||6; container.innerHTML=Array.from({length:n},(_,i)=>`<input type="text" inputmode="numeric" maxlength="1" aria-label="OTP digit ${i+1}" autocomplete="one-time-code">`).join(''); const boxes=Array.from(container.querySelectorAll('input')); boxes.forEach((box,i)=>{box.addEventListener('input',()=>{box.value=box.value.replace(/\D/g,'').slice(-1);if(box.value&&boxes[i+1])boxes[i+1].focus();});box.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!box.value&&boxes[i-1])boxes[i-1].focus();});box.addEventListener('paste',e=>{const text=e.clipboardData.getData('text').replace(/\D/g,'').slice(0,n);if(text){e.preventDefault();text.split('').forEach((x,j)=>{if(boxes[j])boxes[j].value=x;});boxes[Math.min(text.length,n)-1].focus();}});}); return {getValue:()=>boxes.map(b=>b.value).join(''),clear:()=>boxes.forEach(b=>b.value=''),focus:()=>boxes[0]&&boxes[0].focus()}; }
  w.Bookivo.OtpInput={mount};
})(window);

