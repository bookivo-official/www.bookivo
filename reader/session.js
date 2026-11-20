'use strict';
(async function(){
  const status=document.getElementById('readerStatus');
  const context=window.parent!==window && window.parent.BookivoReader;
  if(!context){status.textContent='Open this reader from My Shelf.';return;}
  const cache=new Map(),pending=new Set(),failed=new Set();
  let center=context.start,closed=false;
  const reader={start:center,total:context.total,promptsEnabled:context.bookId==='book-2',prompt:context.prompt,visit};
  const wanted=()=>[center,center+1,center-1,center+2,center-2].filter(p=>p>0&&p<=reader.total);
  function notice(){
    const missing=wanted().filter(p=>failed.has(p) && (p===center || p===center+1));
    status.replaceChildren();
    if(missing.length){
      status.append('Page '+missing.join(', ')+' unavailable. ');
      const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>{failed.clear();pump();};status.append(retry);
    } else if(!cache.has(center))status.textContent='Loading page '+center+'…';
  }
  async function load(page){
    pending.add(page);
    try {
      const blob=await context.image(page);
      if(!closed && wanted().includes(page)){
        const url=URL.createObjectURL(blob);cache.set(page,url);reader.onImage(page,url);
        if(page===center)context.progress(page);
      }
    } catch {if(!closed && wanted().includes(page))failed.add(page);}
    finally {pending.delete(page);if(!closed)pump();}
  }
  function pump(){
    notice();
    for(const p of wanted()){
      if(pending.size>=3)break;
      if(!pending.has(p)&&!cache.has(p)&&!failed.has(p))void load(p);
    }
  }
  function visit(page){
    if(closed)return;
    center=page;
    const active=new Set(wanted());
    for(const [p,url] of cache){
      if(!active.has(p)){reader.onImage(p,null);URL.revokeObjectURL(url);cache.delete(p);}
      else reader.onImage(p,url);
    }
    for(const p of failed)if(!active.has(p))failed.delete(p);
    if(cache.has(page))context.progress(page);
    pump();
  }
  window.addEventListener('pagehide',()=>{closed=true;for(const url of cache.values())URL.revokeObjectURL(url);},{once:true});
  window.startBookivoReader(reader);
})();

