'use strict';
(function(B){
  const labels={currently_reading:'Currently reading',next_up:'Next up',finished:'Finished'};
  const esc=B.Dom.escapeHTML;
  const percent=r=>r.reading_status==='next_up'?0:Math.round(100*r.last_page/r.book.pages);
  B.PageHandlers['my-books']=async function shelf(){
    if(!B.AuthStore.get()){B.Api.orders.signIn();return;}
    const root=document.querySelector('#pageMain');
    root.innerHTML=`<section class="shelf-room"><header class="shelf-heading"><h1>My Shelf</h1><p>Your personal digital library</p></header>
      <div class="shelf-tools"><div class="shelf-tabs" role="group" aria-label="Library view"><button data-tab="shelves" aria-pressed="true">Shelves</button><button data-tab="all" aria-pressed="false">All Books</button></div>
      <input type="search" aria-label="Search in My Shelf" placeholder="Search in My Shelf"><select aria-label="Sort books"><option value="recent">Recently purchased</option><option value="title">Title</option><option value="opened">Recently opened</option><option value="progress">Reading progress</option></select></div>
      <div data-content aria-live="polite"></div></section>`;
    const slot=root.querySelector('[data-content]'), search=root.querySelector('input'), sort=root.querySelector('select');
    let rows=[],tab='shelves',discovery;
    const full=new Set(),arrivals=new Set(JSON.parse(sessionStorage.getItem('bv_shelf_arrivals')||'[]'));
    function tile(row){
      const book=row.book, started=row.reading_status==='currently_reading';
      return `<a class="shelf-volume ${arrivals.has(book.id)?'arriving':''}" href="read.html?book=${encodeURIComponent(book.id)}" title="${esc(book.title)}"><img src="${esc(book.cover)}" alt="${esc(book.title)}"><span>${started?'Continue · p. '+row.last_page:row.reading_status==='finished'?'Read again':'Start reading'}</span>${started?`<progress value="${row.last_page}" max="${book.pages}" aria-label="Reading progress"></progress>`:''}</a>`;
    }
    function invite(){
      return `<a class="shelf-volume shelf-discovery" href="${esc(discovery.folder)}/index.html" aria-label="Explore ${esc(discovery.title)}, ₹25"><img src="${esc(discovery.cover)}" alt=""><span>Add to your collection · ₹25</span><b>Explore book →</b></a>`;
    }
    function render(){
      const term=search.value.toLocaleLowerCase().trim();
      const filtered=rows.filter(r=>(r.book.title+' '+r.book.subtitle).toLocaleLowerCase().includes(term)).sort((a,b)=>{
        if(sort.value==='title')return a.book.title.localeCompare(b.book.title);
        if(sort.value==='progress')return percent(b)-percent(a);
        const field=sort.value==='opened'?'last_opened_at':'purchased_at';
        return (b[field]||'').localeCompare(a[field]||'');
      });
      const showInvite=discovery && !term && !rows.some(r=>r.book_id===discovery.id);
      const keys=tab==='all'?['all']:Object.keys(labels);
      const groups=keys.map(key=>key==='all'?filtered:filtered.filter(r=>r.reading_status===key));
      let target=groups.findIndex(g=>g.length>0 && g.length<6);
      if(target<0)target=groups.findIndex(g=>g.length<6);
      slot.innerHTML=keys.map((key,i)=>{
        const items=groups[i],expanded=tab==='all'||full.has(key);
        const tiles=(expanded?items:items.slice(0,6)).map(tile);
        if(showInvite && i===target)tiles.push(invite());
        while(tiles.length%6 || !tiles.length)tiles.push('<i aria-hidden="true"></i>');
        const decks=[];
        for(let j=0;j<tiles.length;j+=6)decks.push('<div class="wood-deck">'+tiles.slice(j,j+6).join('')+'</div>');
        return `<section class="shelf-section"><div class="shelf-label"><h2>${labels[key]||'All books'} <small>${items.length}</small></h2>${items.length>6 && tab!=='all'?`<button data-expand="${key}" aria-expanded="${expanded}">${expanded?'Show less':'Full shelf →'}</button>`:''}</div><div class="shelf-scroller">${decks.join('')}</div></section>`;
      }).join('')+(showInvite&&target<0?'<div class="discovery-end">'+invite()+'</div>':'')+
      (!rows.length?'<p class="shelf-empty">Your first purchase will appear here. <a href="books.html">Explore ebooks →</a></p>':!filtered.length?'<p>No books match your search.</p>':'');
    }
    async function refresh(){
      slot.innerHTML='<div class="wood-deck shelf-loading" role="status">Loading your shelf…</div>';
      try{[rows,discovery]=await Promise.all([B.Api.orders.library(),B.Api.books.get('book-2')]);render();sessionStorage.removeItem('bv_shelf_arrivals');}
      catch{slot.innerHTML='<p role="alert">Your shelf could not be loaded. <button data-retry>Try again</button></p>';}
    }
    root.addEventListener('click',e=>{
      const button=e.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-retry')){refresh();return;}
      if(button.dataset.tab){tab=button.dataset.tab;root.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}
      if(button.dataset.expand){const key=button.dataset.expand;full.has(key)?full.delete(key):full.add(key);}
      render();
    });
    search.oninput=render;sort.onchange=render;
    window.addEventListener('pageshow',e=>{if(e.persisted)refresh();});
    await refresh();
  };
})(window.Bookivo);

