(function(){
 const cfg=window.BOOKIVO_SUPABASE_CONFIG,root=new URL('../',document.currentScript.src);
 async function check(){const r=await fetch(cfg.url+'/rest/v1/rpc/bv_public_settings',{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('Store settings unavailable');window.bookivoSettings=await r.json();if(window.bookivoSettings.disabled){location.replace(new URL('unavailable.html',root));return false;}return true;}
 window.bookivoReady=check().catch(()=>check());window.bookivoReady.catch(()=>{});window.addEventListener('focus',()=>check().catch(()=>{}));setInterval(()=>{if(!document.hidden)check().catch(()=>{});},30000);
})();