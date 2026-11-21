'use strict';
(function (w) {
  function bucketKey(user) { return 'chat_usage_'+(user ? user.id : 'guest'); }
  function usage(user) { const now=Date.now(); const current=w.Bookivo.Storage.read(bucketKey(user), {start:now,count:0}); if(now-current.start>=3600000) return {start:now,count:0}; return current; }
  const B = w.Bookivo;
  B.Api = B.Api || {};
  function chatUser() {
    if (B.AuthStore) return B.AuthStore.get();
    const id = B.Storage.sessionRead('prime_account', null);
    return id ? {id} : null;
  }
  B.Api.chat = { async send(text,history=[]) { const user=chatUser(); const state=usage(user); if(state.count>=20) throw new Error('You have reached the hourly limit. Please try again later or contact support.'); const config=w.BOOKIVO_SUPABASE_CONFIG;
    const response=await fetch(config.url+'/functions/v1/bookivo-store',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'prime',text,history:history.slice(-6).map(m=>({role:m.role==='bot'?'assistant':'user',content:m.text}))})});
    const data=await response.json();if(!response.ok)throw Error(data.error||'PRIME could not respond. Please use Contact Us.');
    state.count++; w.Bookivo.Storage.write(bucketKey(user),state); return { reply:data.reply, left:20-state.count }; }, async remaining() { const user=chatUser(); return 20-usage(user).count; } };
})(window);

