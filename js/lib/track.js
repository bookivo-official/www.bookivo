'use strict';
(function (w) {
  const sent = [];
  function event(name, data) {
    const payload = Object.assign({ event: name, page: document.body.dataset.page || 'unknown', at: new Date().toISOString() }, data || {});
    sent.push(payload);
    const stage=name==='PageView'?(document.body.dataset.page?.startsWith('book')?'Product':'Visit'):name;
    if(['Visit','Product','InitiateCheckout','CodeSent','Verified','PaymentStarted'].includes(stage)){
      try{
        const cfg=w.BOOKIVO_SUPABASE_CONFIG, visitor=localStorage.bv_visitor ||= crypto.randomUUID();
        const source=new URLSearchParams(location.search).get('utm_source')?.slice(0,60) || sessionStorage.bv_source || (document.referrer && new URL(document.referrer).origin!==location.origin?new URL(document.referrer).hostname:'Direct');
        sessionStorage.bv_source=source;const device=matchMedia('(max-width:760px)').matches?'Mobile':'Desktop';
        if(data?.content_ids)sessionStorage.bv_tracked_books=JSON.stringify(data.content_ids);
        const number=location.pathname.match(/BOOK-(\d+)\//i)?.[1];
        const books=stage==='Product'?[number==='1'?'cookbook':number?'book-'+number:(new URLSearchParams(location.search).get('slug')||'')]:JSON.parse(sessionStorage.bv_tracked_books||'[]');
        for(const key of new Set(['Visit',stage])){
          const id='bv_track_'+[key,source,device,...books].join(':'), day=new Date(Date.now()+19800000).toISOString().slice(0,10);
          if(sessionStorage[id]===day)continue;
          fetch(cfg.url+'/functions/v1/bookivo-admin',{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'visit',visitor,stage:key,books,source,device}),keepalive:true}).then(r=>{if(r.ok)sessionStorage[id]=day;}).catch(()=>{});
        }
      }catch{}
    }
    if (w.BOOKIVO_CONFIG && w.BOOKIVO_CONFIG.META_PIXEL_ID && typeof w.fbq === 'function') w.fbq('track', name, data || {});
  }
  w.Bookivo.Track = { event, recent: () => sent.slice() };
  w.trackEvent = function (name, data) { event(name, data); };
})(window);

