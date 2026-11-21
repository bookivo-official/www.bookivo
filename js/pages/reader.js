'use strict';
(function(B){
  B.PageHandlers.read=async function(){
    const root=document.querySelector('#pageMain');
    if(!B.AuthStore.get()){B.Api.orders.signIn();return;}
    const id=new URLSearchParams(location.search).get('book');
    const local=await B.Api.books.get(id);
    if(!local){root.innerHTML='<p>Book unavailable. <a href="my-books.html">My Shelf</a></p>';return;}
    let entry;
    try{[entry]=await B.Api.orders.library(local.id);}catch{
      root.innerHTML='<p role="alert">Your library could not be reached. <button onclick="location.reload()">Retry</button></p>';return;
    }
    if(!entry){
      root.innerHTML='<section class="empty-state"><h1>This book is not on your shelf</h1><a class="btn btn-primary">Explore book</a></section>';
      root.querySelector('a').href=local.folder?local.folder+'/index.html':'books.html';return;
    }
    const book=entry.book, bucket=B.supabase.storage.from('bookivo-private-books');
    root.innerHTML=`<section class="library-reader"><header><a href="my-books.html">← My Shelf</a><strong>${B.Dom.escapeHTML(book.title)}</strong><button data-unread>Mark unread</button><button data-finish hidden>Mark finished</button></header><p role="status" data-save></p><div data-stage></div></section>`;
    const note=root.querySelector('[data-save]'), finish=root.querySelector('[data-finish]');
    let revision=entry.revision, pending,writing=false,locked=false,timer,lastKey='',exiting=false;
    async function drain(){
      if(writing||locked)return;
      writing=true;
      try{
        while(pending&&!locked){
          const write=pending;pending=null;
          try{
            const saved=await B.Api.orders.action('progress',{book:book.id,revision,...write});revision=saved.revision;
            if(write.state==='next_up'||write.state==='finished'){location.assign('my-books.html');return;}
            note.textContent='';
          }catch(error){locked=true;pending=null;note.textContent=error.message+' Reload the reader to continue saving.';}
        }
      }finally{writing=false;}
    }
    function save(page,state='currently_reading'){
      if(locked || exiting || lastKey===page+state)return;
      lastKey=page+state;pending={page,state};clearTimeout(timer);
      if(state!=='currently_reading'){exiting=true;void drain();}else timer=setTimeout(drain,420);
    }
    let last=entry.last_page, prompts;
    window.BookivoReader={start:last,total:book.pages,bookId:book.id,
      setExpanded(expanded){
        root.querySelector('[data-stage]').classList.toggle('page-expanded',expanded);
        root.querySelector('header').inert=expanded;
      },
      async image(page){
        if(!Number.isInteger(page)||page<1||page>book.pages)throw Error('Invalid page');
        return B.Api.orders.result(bucket.download(book.storage_prefix+'/images/page'+page+'.png'));
      },
      async prompt(page){
        if(book.id!=='book-2'||page<5||page>29)return null;
        if(!prompts)prompts=await (await B.Api.orders.result(bucket.download(book.storage_prefix+'/prompts.json'))).text().then(JSON.parse);
        return prompts[page];
      },
      progress(page){last=page;finish.hidden=page!==book.pages;save(page);}
    };
    finish.onclick=()=>{if(last===book.pages)save(last,'finished');};
    root.querySelector('[data-unread]').onclick=()=>save(1,'next_up');
    const frame=document.createElement('iframe');
    frame.title=book.title;frame.src='reader/index.html';frame.allow='clipboard-write; fullscreen';
    root.querySelector('[data-stage]').append(frame);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)void drain();});
    window.addEventListener('pagehide',()=>{void drain();});
    B.AuthStore.subscribe(()=>{if(B.AuthStore.get()?.id!==entry.user_id){frame.remove();location.replace('my-books.html');}});
  };
})(window.Bookivo);

